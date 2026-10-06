import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { BadRequestError, HTTPClient, LambdaDBClient, ResourceNotFoundError } from "../../dist/esm/index.js";

const options = { timeoutMs: 30_000, retries: { strategy: "none" } };
// Never expose SDK request/response objects, credentials, or signed URLs in failures.
function safeError(error, stage) {
  const message = typeof error?.data$?.message === "string"
    ? error.data$.message.replaceAll(process.env.LAMBDADB_PROJECT_API_KEY, "[redacted]")
      .replace(/https?:\/\/\S+/g, "[URL redacted]") : "";
  return new Error(`${stage}: ${error?.name ?? "Error"}; HTTP ${error?.statusCode ?? "unavailable"}${message ? `; ${message}` : ""}`);
}
const lexical = { queryString: { query: "body:restore AND status:active" } };
const vector = { knn: { field: "embedding", queryVector: [1, 0], k: 30,
  filter: { queryString: { query: "status:active" } } } };
const query = { bayesian: [lexical, vector] };
const ids = (response) => response.docs.map((hit) => hit.doc.id);

test("live Bayesian fusion, legacy methods, validation and applied managed reranking", { timeout: 420_000 }, async (t) => {
  for (const name of ["LAMBDADB_BASE_URL", "LAMBDADB_PROJECT_NAME", "LAMBDADB_PROJECT_API_KEY"]) {
    assert.ok(process.env[name], `Missing ${name}; load the intended test environment`);
  }
  const url = new URL(process.env.LAMBDADB_BASE_URL);
  const projectName = process.env.LAMBDADB_PROJECT_NAME;
  const server = url.pathname.replace(/\/+$/, "") === `/projects/${encodeURIComponent(projectName)}`
    ? { serverURL: url.toString() } : { baseUrl: url.toString(), projectName };
  const collectionName = `ts-bayesian-${randomUUID()}`;
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
    try {
      await collection.delete(options);
      const result = await collection.getSafe(options);
      assert.equal(result.ok, false);
      assert.ok(result.error instanceof ResourceNotFoundError);
      console.info(`[live] Deleted ${collectionName}; absence verified (404)`);
    } catch (error) { throw safeError(error, "Collection cleanup"); }
  });
  let stage = "create Collection";
  try {
    creating = true;
    await client.createCollection({ collectionName, tags: { purpose: "sdk-bayesian-smoke" }, indexConfigs: {
      body: { type: "text" }, status: { type: "keyword" },
      embedding: { type: "vector", dimensions: 2, similarity: "cosine" },
    } }, options);
    creating = false;
    stage = "write documents";
    await collection.docs.upsert({ docs: [
      { id: "both", body: "Restore a previous collection version using a branch.", status: "active", embedding: [1, 0] },
      { id: "lexical", body: "Restore collection data from a saved snapshot.", status: "active" },
      { id: "vector", body: "Keep backups with tags for future recovery.", status: "active", embedding: [0.8, 0.2] },
      { id: "inactive", body: "Restore old collection data.", status: "inactive", embedding: [1, 0] },
      { id: "unrelated", body: "Bake bread with flour and water.", status: "active" },
    ] }, options);
    const input = { query, size: 5, consistentRead: true };
    stage = "consistent read and Collection placement";
    const waitFor = async (request, expected, milliseconds) => {
      const deadline = Date.now() + milliseconds;
      while (true) {
        const result = await collection.querySafe(request, options);
        if (result.ok && result.value.docs.length === expected) return result.value;
        if (!result.ok && ![404, 503].includes(result.error?.statusCode)) throw result.error;
        assert.ok(Date.now() < deadline, "Timed out waiting for expected visible documents");
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    };
    const baseline = await waitFor(input, 3, 90_000);
    assert.deepEqual(new Set(ids(baseline)), new Set(["both", "lexical", "vector"]));
    assert.equal(ids(baseline)[0], "both");
    assert.ok(baseline.docs.every((hit) => Number.isFinite(hit.score) && hit.retrievalScore === undefined));
    assert.equal(baseline.rerank, undefined);
    console.info("[live] Bayesian lexical/vector signals and filters passed");

    stage = "default read snapshot";
    const defaultRead = await waitFor({ query, size: 5 }, 3, 180_000);
    assert.deepEqual(defaultRead.docs, baseline.docs);
    console.info("[live] Default read and consistent read match");

    stage = "budgets and Boolean child";
    const limited = await collection.query({ ...input, size: 1 }, options);
    assert.deepEqual(ids(limited), ids(baseline).slice(0, 1));
    const bool = await collection.query({ ...input, query: { bayesian: [{ bool: [lexical] }, vector] } }, options);
    assert.deepEqual(bool.docs, baseline.docs);
    const capped = await collection.query({ ...input, query: { bayesian: [lexical, { knn: { ...vector.knn, k: 1 } }] } }, options);
    assert.deepEqual(new Set(ids(capped)), new Set(["both", "lexical"]));
    console.info("[live] Result size, knn.k and Boolean signal passed");

    stage = "empty signals";
    const emptyLexical = { queryString: { query: "body:zzzxqv" } };
    const emptyVector = { knn: { ...vector.knn, filter: { queryString: { query: "status:missing" } } } };
    const oneSided = await collection.query({ ...input, query: { bayesian: [emptyLexical, vector] } }, options);
    assert.deepEqual(new Set(ids(oneSided)), new Set(["both", "vector"]));
    assert.ok(oneSided.docs.every((hit) => Number.isFinite(hit.score)));
    const empty = await collection.query({ ...input, query: { bayesian: [emptyLexical, emptyVector] } }, options);
    assert.deepEqual(empty.docs, []);

    stage = "server contract validation";
    const invalid = [
      { bayesian: [] }, { bayesian: [lexical] }, { bayesian: [lexical, vector, lexical] },
      { bayesian: [{ ...lexical, boost: 1 }, vector] },
      { bayesian: [lexical, { ...vector, boost: 0.7 }] },
      { bayesian: [{ bool: [{ bool: [{ ...lexical, boost: 1 }] }] }, vector] },
      { bool: [query] },
    ];
    for (const invalidQuery of invalid) {
      const result = await collection.querySafe({ ...input, query: invalidQuery }, options);
      assert.equal(result.ok, false);
      assert.ok(result.error instanceof BadRequestError);
      assert.equal(result.error.statusCode, 400);
    }
    console.info("[live] Empty signals and seven server-side contract rejections passed");

    stage = "existing hybrid methods";
    for (const method of ["rrf", "mm", "l2"]) {
      const legacy = await collection.query({ ...input, query: { [method]: [lexical, vector] } }, options);
      assert.deepEqual(new Set(ids(legacy)), new Set(ids(baseline)));
      assert.ok(legacy.docs.every((hit) => Number.isFinite(hit.score)));
    }
    console.info("[live] Existing RRF, Min-Max and L2 accepted without changed inputs");

    stage = "Bayesian + managed reranking";
    const scores = new Map(baseline.docs.map((hit) => [hit.doc.id, hit.score]));
    const rerank = { provider: "typesafe", model: "jev-1.13.0",
      queryText: "How do I restore a previous collection version?", fields: ["body"] };
    // Provider calls run once each; no retry or fallback can masquerade as applied reranking.
    for (const safe of [false, true]) {
      const request = { ...input, size: 2, rerank };
      const result = safe ? await collection.querySafe(request, options) : await collection.query(request, options);
      if (safe && !result.ok) throw result.error;
      const response = safe ? result.value : result;
      assert.equal(response.rerank?.status, "applied");
      assert.equal(response.rerank.provider, "typesafe");
      assert.equal(response.rerank.model, "jev-1.13.0");
      assert.equal(response.rerank.candidateCount, 3);
      assert.equal(response.rerank.scoredCount, 3);
      assert.equal(response.docs.length, 2);
      assert.equal(response.total, 2);
      for (const [index, hit] of response.docs.entries()) {
        assert.ok(Number.isFinite(hit.score) && hit.score >= 0 && hit.score <= 1);
        assert.equal(hit.retrievalScore, scores.get(hit.doc.id));
        if (index > 0) assert.ok(response.docs[index - 1].score >= hit.score);
      }
      console.info(`[live] Bayesian + rerank applied, safe=${safe}; candidate/scored=3/3; final size=2; retrieval scores preserved`);
    }
    stage = "empty Bayesian + rerank";
    const skipped = await collection.query({ ...input, query: { bayesian: [emptyLexical, emptyVector] }, rerank }, options);
    assert.equal(skipped.rerank?.status, "skipped");
    assert.equal(skipped.rerank.reason, "noCandidates");
    assert.equal(skipped.rerank.candidateCount, 0);
    assert.deepEqual(skipped.docs, []);
    const nullRerank = await collection.query({ ...input, rerank: null }, options);
    assert.deepEqual(nullRerank.docs, baseline.docs);
    assert.equal(nullRerank.rerank, undefined);
    console.info("[live] Empty Bayesian skips reranking; null rerank preserves fusion");
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw new Error(`${stage}: ${error.message.split("\n")[0]}`);
    }
    throw safeError(error, stage);
  } finally { creating = false; }
});
