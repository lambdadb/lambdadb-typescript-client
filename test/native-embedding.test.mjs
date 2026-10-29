import assert from "node:assert/strict";
import test from "node:test";
import { HTTPClient, LambdaDBClient } from "../dist/esm/index.js";
import { indexConfigsUnionToJSON, indexConfigsUnionFromJSON,
  indexConfigsNativeEmbeddingVectorToJSON, indexConfigsNativeEmbeddingVectorFromJSON,
  indexConfigsManagedEmbeddingVectorToJSON } from "../dist/esm/models/index.js";

const native = { type: "vector", embedding: {
  provider: "openai", model: "text-embedding-3-small", sourceField: "body",
} };

const options = { retries: { strategy: "none" } };
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});

// Stored source contract: lambdadb ff13daf3f4ed40487b2b13522a141265c2f459ab.
for (const safe of [false, true]) {
  test(`source paths need no inferred indexes in Collection create/get/update, safe=${safe}`, async () => {
    for (const [sourceField, sources] of [
      ["body", {}], ["article.body", {}],
      ["article.body", { article: { type: "object", objectIndexConfigs: {} } }],
      ["body", { body: { type: "keyword" } }],
    ]) {
      const vector = { ...native, embedding: { ...native.embedding, sourceField } };
      const indexConfigs = { ...sources, vector };
      const stored = { ...indexConfigs, vector: { ...vector, managedEmbedding: true,
        embedding: { ...vector.embedding, dimensions: 1536, similarity: "cosine" } } };
      const collection = { projectName: "project", collectionName: "native-source",
        description: "", tags: {}, defaultBranchName: "main", snapshotRetentionInDays: 30,
        indexConfigs: stored, numPartitions: 1, numDocs: 0, createdAt: 0, updatedAt: 0 };
      const calls = [];
      const client = new LambdaDBClient({ baseUrl: "https://api.test", projectName: "project",
        projectApiKey: "test-key", httpClient: new HTTPClient({ fetcher: async (request) => {
          calls.push({ method: request.method, body: request.method === "GET" ? null : await request.json() });
          return json({ collection }, request.method === "POST" ? 201 : 200);
        } }) });
      const input = { collectionName: "native-source", indexConfigs };
      if (safe) assert.equal((await client.createCollectionSafe(input, options)).ok, true);
      else await client.createCollection(input, options);
      const handle = client.collection("native-source");
      const read = safe ? await handle.getSafe(options) : await handle.get(options);
      if (safe) assert.equal(read.ok, true);
      assert.deepEqual((safe ? read.value : read).collection.indexConfigs, stored);
      const updated = safe ? await handle.updateSafe({ indexConfigs }, options)
        : await handle.update({ indexConfigs }, options);
      if (safe) assert.equal(updated.ok, true);
      assert.deepEqual((safe ? updated.value : updated).collection.indexConfigs, stored);
      assert.deepEqual(calls, [
        { method: "POST", body: input }, { method: "GET", body: null },
        { method: "PATCH", body: { indexConfigs } },
      ]);
      assert.equal(vector.managedEmbedding, undefined);
      assert.equal(vector.embedding.dimensions, undefined);
    }
  });

  test(`writes preserve original stored JSON and partial patches without local merging, safe=${safe}`, async () => {
    const calls = [];
    const client = new LambdaDBClient({ baseUrl: "https://api.test", projectName: "project",
      projectApiKey: "test-key", httpClient: new HTTPClient({ fetcher: async (request) => {
        calls.push({ path: new URL(request.url).pathname, body: await request.json() });
        return json({ message: "accepted" }, 202);
      } }) });
    const handle = client.collection("native-source");
    const docs = [{ id: "one", article: { body: "stored text", title: "original" },
      sibling: { array: [1, true, null], object: { text: "ordinary JSON" } } }];
    const original = structuredClone(docs);
    if (safe) assert.equal((await handle.docs.upsertSafe({ docs }, options)).ok, true);
    else await handle.docs.upsert({ docs }, options);
    const patches = [
      { id: "one", note: "source omitted" }, { id: "one", article: {} },
      { id: "one", article: { title: "changed sibling" } },
      { id: "one", article: { body: "stored text" } },
      { id: "one", article: { body: "changed text" } },
      // The SDK preserves explicit null; the server decides whether the source is valid.
      { id: "one", article: { body: null } },
    ];
    for (const patch of patches) {
      if (safe) assert.equal((await handle.docs.updateSafe({ docs: [patch] }, options)).ok, true);
      else await handle.docs.update({ docs: [patch] }, options);
    }
    // A full replacement missing its source is also sent unchanged.
    if (safe) assert.equal((await handle.docs.upsertSafe({ docs: [{ id: "one" }] }, options)).ok, true);
    else await handle.docs.upsert({ docs: [{ id: "one" }] }, options);
    assert.deepEqual(calls, [
      { path: "/projects/project/collections/native-source/docs/upsert", body: { docs: original } },
      ...patches.map((patch) => ({
        path: "/projects/project/collections/native-source/docs/update", body: { docs: [patch] },
      })),
      { path: "/projects/project/collections/native-source/docs/upsert", body: { docs: [{ id: "one" }] } },
    ]);
    assert.deepEqual(docs, original);
  });
}

test("native embedding serializes without inferred flags or model defaults and retains explicit legacy flags", () => {
  assert.deepEqual(JSON.parse(indexConfigsNativeEmbeddingVectorToJSON(native)), native);
  assert.deepEqual(JSON.parse(indexConfigsUnionToJSON(native)), native);
  const legacy = { ...native, managedEmbedding: true };
  assert.deepEqual(JSON.parse(indexConfigsUnionToJSON(legacy)), legacy);
  assert.deepEqual(JSON.parse(indexConfigsManagedEmbeddingVectorToJSON(legacy)), legacy);
  for (const value of [native, legacy]) {
    assert.deepEqual(indexConfigsNativeEmbeddingVectorFromJSON(JSON.stringify(value)).value, value);
    assert.deepEqual(indexConfigsUnionFromJSON(JSON.stringify(value)).value, value);
  }
});

test("native embedding retains vector conflicts, strict public fields, and caller-provided vector support", () => {
  for (const value of [{ ...native, managedEmbedding: false }, { ...native, dimensions: 1536 },
    { ...native, similarity: "cosine" }, { ...native, nativeEmbedding: true },
    { ...native, embedding: { ...native.embedding, unknown: true } }]) {
    assert.throws(() => indexConfigsUnionToJSON(value));
  }
  for (const value of [{ type: "vector", dimensions: 64 }, { type: "vector", dimensions: 64, managedEmbedding: false }]) {
    assert.deepEqual(JSON.parse(indexConfigsUnionToJSON(value)), { ...value, similarity: "cosine" });
  }
  assert.throws(() => indexConfigsManagedEmbeddingVectorToJSON(native));
});

// Cohere and ordered sources: lambdadb 1c3e7d453cca296a7b2af85a375b4c5016504101 api/openapi.json.
const cohere = { type: "vector", embedding: {
  provider: "cohere", model: "embed-v5.0-pro", dimensions: 1024,
  sources: [{ field: "product.description", type: "text" }, { field: "product.images", type: "image" }],
} };

test("ordered sources and Cohere settings round-trip without reordering or defaults", () => {
  const sixteen = Array.from({ length: 16 }, (_, i) => ({ field: `part${i}`, type: i % 2 ? "image" : "text" }));
  for (const embedding of [
    cohere.embedding,
    { ...cohere.embedding, sourceField: null },
    { ...native.embedding, sourceField: undefined, sources: [{ field: "body", type: "text" }] },
    { ...native.embedding, sources: null },
    { ...cohere.embedding, sources: sixteen },
  ]) {
    const value = { type: "vector", embedding };
    const wire = JSON.parse(JSON.stringify(value));
    assert.deepEqual(JSON.parse(indexConfigsNativeEmbeddingVectorToJSON(value)), wire);
    assert.deepEqual(JSON.parse(indexConfigsUnionToJSON(value)), wire);
  }
  const stored = { ...cohere, managedEmbedding: true, embedding: { ...cohere.embedding, similarity: "cosine" } };
  assert.deepEqual(indexConfigsUnionFromJSON(JSON.stringify(stored)).value, stored);
  // Optional null source forms normalize to undefined in responses.
  const parsed = indexConfigsUnionFromJSON(JSON.stringify({ ...stored,
    embedding: { ...stored.embedding, sourceField: null } })).value;
  assert.equal(parsed.embedding.sourceField, undefined);
  assert.deepEqual(parsed.embedding.sources, cohere.embedding.sources);
});

test("embedding source shape and exclusivity fail locally; path and model rules stay on the server", () => {
  const { sourceField: _unused, ...withoutSource } = native.embedding;
  for (const embedding of [
    withoutSource, { ...withoutSource, sourceField: null, sources: null },
    { ...cohere.embedding, sourceField: "body" }, { ...cohere.embedding, sources: [] },
    { ...cohere.embedding, sources: Array.from({ length: 17 }, (_, i) => ({ field: `f${i}`, type: "text" })) },
    { ...cohere.embedding, sources: [{ field: "body", type: "audio" }] },
    { ...cohere.embedding, sources: [{ field: "body" }] },
    { ...cohere.embedding, sources: [{ field: "body", type: "text", weight: 1 }] },
    { ...cohere.embedding, sources: { field: "body", type: "text" } },
    { ...cohere.embedding, provider: "voyage" },
  ]) {
    assert.throws(() => indexConfigsUnionToJSON({ type: "vector", embedding }), JSON.stringify(embedding));
  }
  // Duplicate/blank paths, provider-model pairs and provider dimension sets are server-validated.
  for (const embedding of [
    { ...cohere.embedding, sources: [{ field: "body", type: "text" }, { field: "body", type: "image" }] },
    { ...cohere.embedding, sources: [{ field: " ", type: "text" }] },
    { ...cohere.embedding, model: "text-embedding-3-small", dimensions: 1000 },
    { ...native.embedding, sourceField: undefined, sources: cohere.embedding.sources },
  ]) {
    const value = { type: "vector", embedding };
    assert.deepEqual(JSON.parse(indexConfigsUnionToJSON(value)), JSON.parse(JSON.stringify(value)));
  }
});

for (const safe of [false, true]) {
  test(`native KNN query inputs and direct vectors pass through unchanged, safe=${safe}`, async () => {
    const calls = [];
    const client = new LambdaDBClient({ baseUrl: "https://api.test", projectName: "project",
      projectApiKey: "test-key", httpClient: new HTTPClient({ fetcher: async (request) => {
        calls.push(await request.json());
        return json({ took: 0, total: 0, docs: [], isDocsInline: true });
      } }) });
    const handle = client.collection("products");
    const queries = [
      { knn: { field: "vector", k: 10, queryInputs: [
        { type: "text", value: "red shoes" }, { type: "image", value: "https://example.com/shoe.png" },
      ] } },
      { knn: { field: "vector", k: 10, queryInputs: [{ type: "image", value: "data:image/png;base64,AA==" }] } },
      { knn: { field: "vector", k: 10, queryVector: [0.1, 0.2] } },
    ];
    for (const query of queries) {
      const result = safe ? await handle.querySafe({ query }, options) : await handle.query({ query }, options);
      if (safe) assert.equal(result.ok, true);
    }
    assert.deepEqual(calls.map((call) => call.query), queries);
  });
}
