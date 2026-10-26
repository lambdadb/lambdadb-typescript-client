import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { BadRequestError, HTTPClient, LambdaDBClient, ResourceNotFoundError } from "../../dist/esm/index.js";

const padVector = (values) => [...values, ...Array(64 - values.length).fill(0)];
const options = { timeoutMs: 30_000, retries: { strategy: "none" } };
const delay = () => new Promise((resolve) => setTimeout(resolve, 2_000));
function safeError(error, stage) {
  const message = typeof error?.data$?.message === "string"
    ? error.data$.message.replaceAll(process.env.LAMBDADB_PROJECT_API_KEY, "[redacted]")
      .replace(/https?:\/\/\S+/g, "[URL redacted]") : "";
  return new Error(`${stage}: ${error?.name ?? "Error"}; HTTP ${error?.statusCode ?? "unavailable"}${message ? `; ${message}` : ""}`);
}

test("live query limits return 1000 distinct documents and reject 1001", { timeout: 420_000 }, async (t) => {
  for (const name of ["LAMBDADB_BASE_URL", "LAMBDADB_PROJECT_NAME", "LAMBDADB_PROJECT_API_KEY"]) {
    assert.ok(process.env[name], `Missing ${name}; load the intended test environment`);
  }
  const url = new URL(process.env.LAMBDADB_BASE_URL);
  const projectName = process.env.LAMBDADB_PROJECT_NAME;
  const server = url.pathname.replace(/\/+$/, "") === `/projects/${encodeURIComponent(projectName)}`
    ? { serverURL: url.toString() } : { baseUrl: url.toString(), projectName };
  const collectionName = `ts-query-limits-${randomUUID()}`;
  let creating = false;
  let created = false;
  const httpClient = new HTTPClient();
  httpClient.addHook("response", (response) => {
    if (creating && response.status === 201) created = true;
  });
  const client = new LambdaDBClient({ ...server, projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY, httpClient });
  const collection = client.collection(collectionName);
  console.info(`[live] Environment ${url.origin}; project ${projectName}; collection ${collectionName}`);
  t.after(async () => {
    if (!created) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const removed = await collection.deleteSafe(options);
        if (!removed.ok && !(removed.error instanceof ResourceNotFoundError)) throw removed.error;
        const result = await collection.getSafe(options);
        if (result.ok) throw new Error("Collection still exists after deletion");
        if (!(result.error instanceof ResourceNotFoundError)) throw result.error;
        console.info(`[live] Deleted ${collectionName}; absence verified (404)`);
        return;
      } catch (error) {
        if (attempt === 2 || ![429, 503].includes(error?.statusCode)) throw safeError(error, "Collection cleanup");
        await delay();
      }
    }
  });

  let stage = "create Collection";
  try {
    creating = true;
    await client.createCollection({ collectionName, tags: { purpose: "sdk-query-limits-smoke" }, indexConfigs: {
      body: { type: "text" }, embedding: { type: "vector", dimensions: 64, similarity: "cosine" },
    } }, options);
    creating = false;
    stage = "write 1000 documents";
    const docs = Array.from({ length: 1000 }, (_, index) => ({
      id: `limit-${index}`, body: "restore", embedding: padVector([1, (index + 1) / 2000]),
    }));
    const expectedIds = new Set(docs.map((doc) => doc.id));
    await collection.docs.upsert({ docs }, options);
    const lexical = { queryString: { query: "body:restore" } };
    const vector = { knn: { field: "embedding", queryVector: padVector([1, 0]), k: 1000 } };
    const input = { size: 1000, query: lexical, fields: { include: ["id"] }, consistentRead: true };
    stage = "wait for 1000 visible documents";
    const deadline = Date.now() + 180_000;
    while (true) {
      const result = await collection.querySafe(input, options);
      if (result.ok && result.value.docs.length === 1000) break;
      if (!result.ok && ![404, 429, 503].includes(result.error?.statusCode)) throw result.error;
      assert.ok(Date.now() < deadline, "Timed out waiting for 1000 visible documents");
      await delay();
    }

    for (const [label, extra] of [
      ["lexical", { query: lexical }],
      ["KNN", { query: vector }],
      ["Bayesian", { query: { bayesian: [lexical, vector] }, candidateSize: 1000 }],
    ]) {
      for (const safe of [false, true]) {
        stage = `${label} returns 1000 documents, safe=${safe}`;
        const request = { ...input, ...extra };
        const result = safe ? await collection.querySafe(request, options) : await collection.query(request, options);
        if (safe && !result.ok) throw result.error;
        const response = safe ? result.value : result;
        assert.equal(response.total, 1000);
        assert.equal(response.docs.length, 1000);
        assert.deepEqual(new Set(response.docs.map(({ doc }) => doc.id)), expectedIds);
        assert.ok(response.docs.every((hit) => Number.isFinite(hit.score)));
        console.info(`[live] ${label}, safe=${safe}: returned all 1000 distinct documents`);
      }
    }

    stage = "reject counts above 1000 on the server";
    for (const request of [
      { ...input, size: 1001 },
      { ...input, query: { knn: { ...vector.knn, k: 1001 } } },
      { ...input, query: { bayesian: [lexical, vector] }, candidateSize: 1001 },
    ]) {
      const result = await collection.querySafe(request, options);
      assert.equal(result.ok, false);
      assert.ok(result.error instanceof BadRequestError);
      assert.equal(result.error.statusCode, 400);
    }
    console.info("[live] size, knn.k and Bayesian candidateSize above 1000 returned HTTP 400");
  } catch (error) {
    if (error instanceof assert.AssertionError) throw new Error(`${stage}: ${error.message.split("\n")[0]}`);
    throw safeError(error, stage);
  } finally { creating = false; }
});
