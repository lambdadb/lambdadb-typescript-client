import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HTTPClient, LambdaDBClient, ResourceNotFoundError } from "../../dist/esm/index.js";

const options = { timeoutMs: 30_000, retries: { strategy: "none" } };
const embedding = { provider: "openai", model: "text-embedding-3-small", sourceField: "body" };

test("native embedding-only input and legacy true flag work on the deployed server", { timeout: 240_000 }, async (t) => {
  for (const name of ["LAMBDADB_BASE_URL", "LAMBDADB_PROJECT_NAME", "LAMBDADB_PROJECT_API_KEY"]) {
    assert.ok(process.env[name], `Missing ${name}`);
  }
  const created = [];
  const httpClient = new HTTPClient();
  httpClient.addHook("response", async (response) => {
    if (response.status === 201) {
      const body = await response.clone().json();
      if (body.collection?.collectionName) created.push(body.collection.collectionName);
    }
  });
  const client = new LambdaDBClient({ baseUrl: process.env.LAMBDADB_BASE_URL,
    projectName: process.env.LAMBDADB_PROJECT_NAME, projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY, httpClient });
  t.after(async () => {
    for (const name of created) {
      const collection = client.collection(name);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const removed = await collection.deleteSafe(options);
          if (!removed.ok && !(removed.error instanceof ResourceNotFoundError)) throw removed.error;
          const result = await collection.getSafe(options);
          if (!result.ok && !(result.error instanceof ResourceNotFoundError)) throw result.error;
          assert.equal(result.ok, false);
          console.info(`[live] Deleted ${name}; absence verified (404)`);
          break;
        } catch (error) {
          if (attempt === 2 || ![429, 503].includes(error?.statusCode)) {
            throw new Error(`Native embedding cleanup failed: ${error?.name}; HTTP ${error?.statusCode ?? "unavailable"}`);
          }
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
      }
    }
  });
  let stage = "create Collection";
  try {
    for (const legacy of [false, true]) {
      const name = `ts-native-${randomUUID()}`;
      const vector = { type: "vector", embedding, ...(legacy ? { managedEmbedding: true } : {}) };
      const configs = { body: { type: "text" }, vector };
      await client.createCollection({ collectionName: name, indexConfigs: configs }, options);
      const collection = client.collection(name);
      stage = "read normalized metadata";
      const metadata = (await collection.get(options)).collection;
      assert.equal(metadata.indexConfigs.vector.managedEmbedding, true);
      assert.equal(metadata.indexConfigs.vector.embedding.dimensions, 1536);
      assert.equal(metadata.indexConfigs.vector.embedding.similarity, "cosine");
      stage = "update using embedding-only input";
      await collection.update({ indexConfigs: { body: { type: "text" }, vector: { type: "vector", embedding } } }, options);
      stage = "generate document embedding";
      await collection.docs.upsert({ docs: [{ id: "one", body: "Restore a collection version using a saved branch." }] }, options);
      stage = "wait for placement";
      const deadline = Date.now() + 90_000;
      while (true) {
        const result = await collection.querySafe({ query: { queryString: { query: "body:restore" } }, consistentRead: true }, options);
        if (result.ok && result.value.docs.length === 1) break;
        if (!result.ok && ![404, 503].includes(result.error?.statusCode)) throw result.error;
        assert.ok(Date.now() < deadline, "Timed out waiting for document visibility");
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
      stage = "ordinary KNN without candidateSize";
      const ordinary = await collection.query({ query: {
        knn: { field: "vector", queryText: "How do I restore a saved version?", k: 30 },
      }, size: 1, consistentRead: true }, options);
      assert.equal(ordinary.docs[0]?.doc.id, "one");
      stage = "Bayesian queryText embedding";
      const response = await collection.query({ query: { bayesian: [
        { queryString: { query: "body:restore" } },
        { knn: { field: "vector", queryText: "How do I restore a saved version?", k: 30 } },
      ] }, candidateSize: 30, size: 1, consistentRead: true }, options);
      assert.equal(response.docs.length, 1);
      assert.equal(response.docs[0].doc.id, "one");
      assert.ok(Number.isFinite(response.docs[0].score));
      console.info(`[live] Native embedding create/update, OpenAI document/query embeddings and Bayesian search passed; legacy=${legacy}`);
    }
  } catch (error) {
    throw new Error(`${stage}: ${error?.name}; HTTP ${error?.statusCode ?? "unavailable"}; ${error instanceof assert.AssertionError ? error.message.split("\n")[0] : "details suppressed"}`);
  }
});
