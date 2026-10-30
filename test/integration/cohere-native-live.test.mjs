import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { crc32, deflateSync } from "node:zlib";
import { BadRequestError, LambdaDBClient, ResourceNotFoundError } from "../../dist/esm/index.js";
import { rerankQuery } from "./rerank-retry.mjs";

// Opt-in provider smoke: lambdadb f9d34b8f78ae829ae34d5065d29a42f3574983e1 api/openapi.json (#483).
// Verify externally visible results, not provider call counts or billing.
const options = { timeoutMs: 60_000, retries: { strategy: "none" } };
const dimensions = 256;
function serverOptions() {
  for (const name of ["LAMBDADB_BASE_URL", "LAMBDADB_PROJECT_NAME", "LAMBDADB_PROJECT_API_KEY"]) {
    assert.ok(process.env[name], `Missing ${name}; load the intended environment's .env.local`);
  }
  const raw = process.env.LAMBDADB_BASE_URL;
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  const projectName = process.env.LAMBDADB_PROJECT_NAME;
  return url.pathname.replace(/\/+$/, "") === `/projects/${encodeURIComponent(projectName)}`
    ? { serverURL: url.toString() } : { baseUrl: url.toString(), projectName };
}

function safeError(error, stage) {
  if (error instanceof assert.AssertionError) return error;
  // Server validation messages carry no credentials; URLs are removed defensively.
  const message = error?.statusCode >= 400 && error?.statusCode < 500
    ? `; ${String(error.message).replace(/https?:\/\/\S+/g, "<url>").slice(0, 300)}` : "";
  return new Error(`${stage}: ${error?.name ?? "Error"}; HTTP ${error?.statusCode ?? "unavailable"}${message}`);
}

// A small solid-color RGB PNG data URI, generated rather than committed.
function png(r, g, b, size = 16) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [r, g, b]).flat())]);
  const data = deflateSync(Buffer.concat(Array.from({ length: size }, () => row)));
  const file = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", data), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${file.toString("base64")}`;
}

// The unique name belongs to its test, including an uncertain create outcome.
async function removeCollection(collection, name) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const removed = await collection.deleteSafe(options);
      if (!removed.ok && !(removed.error instanceof ResourceNotFoundError)) throw removed.error;
      const absent = await collection.getSafe(options);
      if (!absent.ok && !(absent.error instanceof ResourceNotFoundError)) throw absent.error;
      assert.equal(absent.ok, false, "Temporary Collection must be absent");
      console.info(`[live] deleted ${name}; absence verified (404)`);
      return;
    } catch (error) {
      if (attempt === 2 || ![429, 503].includes(error?.statusCode)) throw safeError(error, "cleanup");
      await delay(2_000);
    }
  }
}

function assertBadRequest(result, label) {
  assert.equal(result.ok, false, `${label} must be rejected`);
  assert.ok(result.error instanceof BadRequestError, `${label} must be BadRequestError`);
  assert.equal(result.error.statusCode, 400);
}

async function waitFor(collection, count) {
  const deadline = Date.now() + 90_000;
  while (true) {
    const result = await collection.querySafe({ query: { queryString: { query: "*:*" } },
      size: 10, consistentRead: true, includeVectors: true }, options);
    if (result.ok && result.value.docs.length === count) {
      return Object.fromEntries(result.value.docs.map(({ doc }) => [doc.id, doc]));
    }
    if (!result.ok && ![404, 503].includes(result.error?.statusCode)) throw result.error;
    assert.ok(Date.now() < deadline, `Timed out waiting for ${count} documents`);
    await delay(2_000);
  }
}

const unit = (index) => Array.from({ length: dimensions }, (_, i) => (i === index ? 1 : 0));

test("live Cohere embeddings, typed query inputs, direct vectors and reranking", { timeout: 300_000 }, async (t) => {
  const client = new LambdaDBClient({ ...serverOptions(), projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY });
  const collectionName = `ts-cohere-${randomUUID()}`;
  const collection = client.collection(collectionName);
  const sources = [{ field: "product.description", type: "text" }, { field: "product.images", type: "image" }];
  const indexConfigs = { productVector: { type: "vector", embedding: {
    provider: "cohere", model: "embed-v5.0-fast", dimensions, sources,
  } } };
  let stage = "create Collection";
  t.after(() => removeCollection(collection, collectionName));

  try {
    await client.createCollection({ collectionName, indexConfigs }, options);
    const metadata = (await collection.get(options)).collection.indexConfigs.productVector;
    assert.deepEqual(metadata.embedding.sources, sources);
    assert.equal(metadata.embedding.sourceField, undefined);
    assert.equal(metadata.embedding.provider, "cohere");
    assert.equal(metadata.embedding.dimensions, dimensions);
    assert.equal(metadata.embedding.similarity, "cosine");

    stage = "write text, image, mixed and direct-vector documents";
    const red = png(220, 20, 20);
    const direct = unit(0);
    const docs = [
      { id: "mixed", product: { description: "Red waterproof jacket for hiking", images: [red] } },
      { id: "text", product: { description: "Database backup and point-in-time restore guide" } },
      // Reranking needs selected text on every candidate; caption is not an embedding source.
      { id: "image", product: { images: red }, caption: "Plain red square" },
      { id: "direct", product: { description: "Vector supplied by the caller" }, productVector: direct },
    ];
    await collection.docs.upsert({ docs }, options);
    const stored = await waitFor(collection, docs.length);
    for (const id of ["mixed", "text", "image"]) {
      assert.equal(stored[id].productVector?.length, dimensions, `${id} must have a generated vector`);
    }
    assert.deepEqual(stored.image.product.images, red, "Stored data URI must be unchanged");
    assert.deepEqual(stored.direct.productVector, direct, "Direct vector must be retained");

    stage = "KNN queryText, queryInputs and native queryVector";
    const knn = async (input) => (await collection.query({ size: 4, consistentRead: true,
      query: { knn: { field: "productVector", k: 4, ...input } }, fields: { include: ["id"] } }, options)).docs;
    assert.equal((await knn({ queryText: "how do I restore a database backup" }))[0].doc.id, "text");
    const mixed = await knn({ queryInputs: [{ type: "text", value: "red jacket" }, { type: "image", value: red }] });
    assert.ok(["mixed", "image"].includes(mixed[0].doc.id), `Unexpected mixed top hit ${mixed[0].doc.id}`);
    const imageOnly = await knn({ queryInputs: [{ type: "image", value: red }] });
    assert.ok(["mixed", "image"].includes(imageOnly[0].doc.id), `Unexpected image top hit ${imageOnly[0].doc.id}`);
    assert.equal((await knn({ queryVector: direct }))[0].doc.id, "direct");

    stage = "Cohere reranking";
    for (const model of ["rerank-v5.0-fast", "rerank-v5.0-pro"]) {
      const reranked = await rerankQuery((request) => collection.query(request, options), { size: 3, consistentRead: true,
        query: { knn: { field: "productVector", queryText: "restore a database", k: 4 } },
        rerank: { provider: "cohere", model, queryText: "restore a database backup", fields: ["product.description", "caption"] },
        fields: { include: ["id"] } }, `Cohere ${model}`);
      assert.equal(reranked.rerank?.status, "applied", `${model} must apply`);
      assert.equal(reranked.rerank.provider, "cohere");
      assert.equal(reranked.rerank.model, model);
      assert.equal(reranked.rerank.criteriaVersion, "cohere-relevance-v1");
      assert.equal(reranked.docs[0].doc.id, "text");
      for (const hit of reranked.docs) {
        assert.ok(hit.score >= 0 && hit.score <= 1);
        assert.ok(Number.isFinite(hit.retrievalScore));
      }
    }

    stage = "partial updates: metadata, source change, explicit vector and source removal";
    const read = async () => waitFor(collection, docs.length);
    await collection.docs.update({ docs: [{ id: "direct", note: "metadata only" }] }, options);
    assert.deepEqual((await read()).direct.productVector, direct, "Metadata-only update must retain a direct vector");
    await collection.docs.update({ docs: [{ id: "direct", product: { description: "Waterproof hiking boots" } }] }, options);
    const regenerated = (await read()).direct.productVector;
    assert.equal(regenerated?.length, dimensions);
    assert.notDeepEqual(regenerated, direct, "Changed source without a vector must regenerate");
    const supplied = unit(1);
    await collection.docs.update({ docs: [{ id: "text", productVector: supplied }] }, options);
    assert.deepEqual((await read()).text.productVector, supplied, "Supplied vector must take precedence");
    await collection.docs.update({ docs: [{ id: "text", note: "metadata only" }] }, options);
    const text = (await read()).text;
    assert.deepEqual(text.productVector, supplied, "Later metadata-only update must retain a supplied vector");
    assert.equal(text.product.description, docs[1].product.description);
    await collection.docs.update({ docs: [{ id: "image", product: { images: [] } }] }, options);
    const removed = (await read()).image;
    assert.deepEqual(removed.product.images, []);
    assert.equal(removed.productVector, undefined, "Removing the last source must remove the inherited vector");

    stage = "bulk upsert with caller vectors and empty image sources";
    await collection.docs.bulkUpsertDocs({ docs: [
      { id: "bulk", product: { description: "Imported with a precomputed vector" }, productVector: direct },
      { id: "bulk-empty", product: { images: [] } },
    ] }, options);
    const afterBulk = await waitFor(collection, docs.length + 2);
    assert.deepEqual(afterBulk.bulk.productVector, direct);
    assert.equal(afterBulk["bulk-empty"].productVector, undefined);

    stage = "bulk upsert rejects a present source without its vector before commit";
    const rejected = await collection.docs.bulkUpsertDocsSafe({ docs: [
      { id: "bulk-valid", product: { description: "Valid record" }, productVector: direct },
      { id: "bulk-missing", product: { description: "Needs automatic embedding" } },
    ] }, options);
    assertBadRequest(rejected, "Bulk source without vector");
    const afterRejected = await waitFor(collection, docs.length + 2);
    assert.equal(afterRejected["bulk-valid"], undefined, "No document from a rejected bulk payload may commit");
    console.info("[live] Cohere create/get, writes, queries, rerank, updates and bulk import passed");
  } catch (error) {
    throw safeError(error, stage);
  }
});

test("live embedding source forms and server-validated provider rules", { timeout: 300_000 }, async (t) => {
  const client = new LambdaDBClient({ ...serverOptions(), projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY });
  const names = [];
  const handle = () => {
    const name = `ts-sources-${randomUUID()}`;
    names.push(name);
    return { name, collection: client.collection(name) };
  };
  t.after(async () => {
    for (const name of names) await removeCollection(client.collection(name), name);
  });
  const vector = (embedding) => ({ productVector: { type: "vector", embedding } });
  const openai = { provider: "openai", model: "text-embedding-3-small" };
  const cohere = { provider: "cohere", model: "embed-v5.0-fast" };
  let stage = "server-validated provider rules";

  try {
    // The SDK deliberately leaves these OpenAPI provider conditions to the server.
    for (const [label, embedding] of [
      ["OpenAI image source", { ...openai, sources: [{ field: "image", type: "image" }] }],
      ["OpenAI two text sources", { ...openai, sources: [{ field: "a", type: "text" }, { field: "b", type: "text" }] }],
      ["Cohere unsupported dimensions", { ...cohere, dimensions: 1000, sources: [{ field: "body", type: "text" }] }],
      ["Cohere unknown model", { ...cohere, model: "embed-v4.0", sources: [{ field: "body", type: "text" }] }],
      ["duplicate source paths", { ...cohere, sources: [{ field: "body", type: "text" }, { field: "body", type: "image" }] }],
      ["blank source path", { ...cohere, sources: [{ field: " ", type: "text" }] }],
    ]) {
      const { name } = handle();
      assertBadRequest(await client.createCollectionSafe({ collectionName: name, indexConfigs: vector(embedding) }, options), label);
    }

    stage = "Cohere legacy sourceField";
    const legacy = handle();
    await client.createCollection({ collectionName: legacy.name,
      indexConfigs: vector({ ...cohere, sourceField: "body" }) }, options);
    const legacyEmbedding = (await legacy.collection.get(options)).collection.indexConfigs.productVector.embedding;
    assert.equal(legacyEmbedding.sourceField, "body");
    assert.equal(legacyEmbedding.sources, undefined);
    assert.equal(legacyEmbedding.dimensions, 2048, "Cohere must default to 2048 dimensions");

    stage = "OpenAI single text sources form";
    const { name, collection } = handle();
    const sources = [{ field: "article.body", type: "text" }];
    await client.createCollection({ collectionName: name, indexConfigs: vector({ ...openai, sources }) }, options);
    const embedding = (await collection.get(options)).collection.indexConfigs.productVector.embedding;
    assert.deepEqual(embedding.sources, sources);
    assert.equal(embedding.sourceField, undefined);
    assert.equal(embedding.dimensions, 1536);
    await collection.docs.upsert({ docs: [
      { id: "restore", article: { body: "Restore a collection from a saved branch." } },
      { id: "weather", article: { body: "Tomorrow will be sunny with light winds." } },
    ] }, options);
    const stored = await waitFor(collection, 2);
    assert.equal(stored.restore.productVector?.length, 1536);
    const result = await collection.query({ size: 2, consistentRead: true, fields: { include: ["id"] },
      query: { knn: { field: "productVector", k: 2, queryInputs: [{ type: "text", value: "restore a collection" }] } } }, options);
    assert.equal(result.docs[0].doc.id, "restore");
    stage = "OpenAI rejects image query inputs";
    assertBadRequest(await collection.querySafe({ query: { knn: { field: "productVector", k: 2,
      queryInputs: [{ type: "image", value: png(0, 0, 255) }] } } }, options), "OpenAI image query input");
    console.info("[live] source forms, OpenAI sources and provider validation passed");
  } catch (error) {
    throw safeError(error, stage);
  }
});
