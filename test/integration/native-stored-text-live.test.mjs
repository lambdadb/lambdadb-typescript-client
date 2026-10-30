import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { BadRequestError, LambdaDBClient, ResourceNotFoundError } from "../../dist/esm/index.js";
import { rerankQuery } from "./rerank-retry.mjs";

// Opt-in provider smoke: lambdadb ff13daf3f4ed40487b2b13522a141265c2f459ab (#481).
// Verify externally visible results, not provider call counts or billing.
const options = { timeoutMs: 30_000, retries: { strategy: "none" } };
const originalText = "Restore a collection version using a saved branch.";
const changedText = "Tomorrow will be sunny with light winds.";

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
  return new Error(`${stage}: ${error?.name ?? "Error"}; HTTP ${error?.statusCode ?? "unavailable"}; details suppressed`);
}

for (const mode of ["unindexed-top-level", "unindexed-nested", "keyword"]) {
  test(`live native stored strings: ${mode}`, { timeout: 240_000 }, async (t) => {
    const client = new LambdaDBClient({ ...serverOptions(), projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY });
    const collectionName = `ts-stored-${randomUUID()}`;
    const collection = client.collection(collectionName);
    const nested = mode === "unindexed-nested";
    const sourceField = nested ? "article.body" : "body";
    const source = (body) => nested ? { article: { body } } : { body };
    const text = (doc) => nested ? doc.article?.body : doc.body;
    const indexConfigs = { ...(mode === "keyword" ? { body: { type: "keyword" } } : {}),
      vector: { type: "vector", embedding: { provider: "openai", model: "text-embedding-3-small", sourceField } } };
    let stage = "create Collection";
    t.after(async () => {
      // The unique name belongs to this test, including an uncertain create outcome.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const removed = await collection.deleteSafe(options);
          if (!removed.ok && !(removed.error instanceof ResourceNotFoundError)) throw removed.error;
          const absent = await collection.getSafe(options);
          if (!absent.ok && !(absent.error instanceof ResourceNotFoundError)) throw absent.error;
          assert.equal(absent.ok, false, "Temporary Collection must be absent");
          console.info(`[live] ${mode}: deleted ${collectionName}; absence verified (404)`);
          return;
        } catch (error) {
          if (attempt === 2 || ![429, 503].includes(error?.statusCode)) throw safeError(error, "cleanup");
          await delay(2_000);
        }
      }
    });

    async function readOne() {
      const response = await collection.query({ query: { queryString: { query: "*:*" } },
        size: 2, consistentRead: true, includeVectors: true }, options);
      assert.equal(response.docs.length, 1, "Exactly one fixture document must be visible");
      return response.docs[0].doc;
    }

    try {
      await client.createCollection({ collectionName, indexConfigs }, options);
      const metadata = (await collection.get(options)).collection;
      assert.equal(metadata.indexConfigs.vector.embedding.sourceField, sourceField);
      assert.equal(metadata.indexConfigs.vector.managedEmbedding, true);
      assert.equal(metadata.indexConfigs.vector.embedding.dimensions, 1536);
      if (mode === "keyword") assert.equal(metadata.indexConfigs.body.type, "keyword");
      else assert.equal(metadata.indexConfigs.body, undefined);
      assert.equal(metadata.indexConfigs.article, undefined);
      await collection.update({ indexConfigs }, options);

      stage = "write source and preserve unrelated JSON";
      const sibling = { values: [1, true, null], wrapper: { text: "ordinary stored JSON" } };
      await collection.docs.upsert({ docs: [{ id: "one", ...source(originalText), sibling }] }, options);
      stage = "wait for placement and document visibility";
      const deadline = Date.now() + 90_000;
      while (true) {
        const result = await collection.querySafe({ query: { queryString: { query: "*:*" } },
          size: 2, consistentRead: true }, options);
        if (result.ok && result.value.docs.length === 1) break;
        if (!result.ok && ![404, 503].includes(result.error?.statusCode)) throw result.error;
        assert.ok(Date.now() < deadline, "Timed out waiting for document visibility");
        await delay(2_000);
      }
      const initial = await readOne();
      assert.equal(text(initial), originalText);
      assert.deepEqual(initial.sibling, sibling);
      assert.ok(Array.isArray(initial.vector), "Generated vector must be returned with includeVectors");
      assert.equal(initial.vector.length, 1536);

      stage = "KNN queryText and reranking of stored source with public projection";
      const reranked = await rerankQuery((request) => collection.query(request, options), { size: 1, consistentRead: true,
        query: { knn: { field: "vector", queryText: "Restore a collection version", k: 10 } },
        rerank: { provider: "typesafe", model: "jev-1.13.0", queryText: "Restore a collection version",
          fields: [sourceField, "sibling.wrapper.text"] }, fields: { include: ["id"] } }, `Typesafe stored text ${mode}`);
      assert.equal(reranked.rerank?.status, "applied");
      assert.equal(reranked.rerank.scoredCount, 1);
      assert.equal(reranked.docs.length, 1);
      assert.deepEqual(reranked.docs[0].doc, { id: "one" });
      assert.ok(Number.isFinite(reranked.docs[0].retrievalScore));
      assert.ok(reranked.docs[0].score >= 0 && reranked.docs[0].score <= 1);

      stage = "unchanged, omitted, empty-ancestor and sibling patches";
      const patches = [{ id: "one", note: "source omitted" }, { id: "one", ...source(originalText) },
        ...(nested ? [{ id: "one", article: {} }, { id: "one", article: { title: "changed sibling" } }] : [])];
      for (const patch of patches) {
        await collection.docs.update({ docs: [patch] }, options);
        const unchanged = await readOne();
        assert.equal(text(unchanged), originalText);
        assert.deepEqual(unchanged.vector, initial.vector);
        assert.deepEqual(unchanged.sibling, sibling);
      }
      if (nested) assert.equal((await readOne()).article.title, "changed sibling");

      stage = "changed source regenerates its vector";
      await collection.docs.update({ docs: [{ id: "one", ...source(changedText) }] }, options);
      const changed = await readOne();
      assert.equal(text(changed), changedText);
      assert.equal(changed.vector.length, 1536);
      assert.notDeepEqual(changed.vector, initial.vector);
      assert.deepEqual(changed.sibling, sibling);

      stage = "invalid stored sources remain HTTP 400 without committing";
      for (const invalid of [null, [], 7, false, { text: "invalid wrapper" }]) {
        const result = await collection.docs.updateSafe({ docs: [{ id: "one", ...source(invalid) }] }, options);
        assert.equal(result.ok, false, "Non-string source must be rejected");
        assert.ok(result.error instanceof BadRequestError);
        assert.equal(result.error.statusCode, 400);
      }
      assert.deepEqual(await readOne(), changed);

      stage = "full replacement omits source and old vector";
      await collection.docs.upsert({ docs: [{ id: "one", note: "replacement" }] }, options);
      assert.deepEqual(await readOne(), { id: "one", note: "replacement" });
      console.info(`[live] ${mode}: source, vector, patches, validation, rerank and projection passed`);
    } catch (error) {
      throw safeError(error, `${mode}: ${stage}`);
    }
  });
}
