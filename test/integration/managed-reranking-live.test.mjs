import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HTTPClient, LambdaDBClient, ResourceNotFoundError } from "../../dist/esm/index.js";

// Opt-in paid-provider smoke through LambdaDB only; no Jev key is accepted.
const options = { timeoutMs: 30_000, retries: { strategy: "none" } };
function safeError(error, stage = "cleanup") {
  if (error instanceof assert.AssertionError) return error;
  const message = typeof error?.data$?.message === "string"
    ? error.data$.message.replaceAll(process.env.LAMBDADB_PROJECT_API_KEY, "[redacted]")
      .replace(/https?:\/\/\S+/g, "[URL redacted]")
    : "";
  return new Error(`${stage}: ${error?.name ?? "Error"}; HTTP ${error?.statusCode ?? "unavailable"}${message ? `; ${message}` : ""}`);
}

// Run explicitly with the intended environment; missing credentials are a failure.
test("live managed reranking defaults, custom criteria, scores, projection and cleanup", {
  timeout: 360_000,
}, async (t) => {
  for (const name of ["LAMBDADB_BASE_URL", "LAMBDADB_PROJECT_NAME", "LAMBDADB_PROJECT_API_KEY"]) {
    assert.ok(process.env[name], `Missing ${name}; load the intended environment's .env.local`);
  }
  const raw = process.env.LAMBDADB_BASE_URL;
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  const projectName = process.env.LAMBDADB_PROJECT_NAME;
  const server = url.pathname.replace(/\/+$/, "") === `/projects/${encodeURIComponent(projectName)}`
    ? { serverURL: url.toString() } : { baseUrl: url.toString(), projectName };
  const collectionName = `ts-rerank-${randomUUID()}`;
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
    } catch (error) {
      throw safeError(error);
    }
  });
  let stage = "create Collection";
  try {
    creating = true;
    await client.createCollection({ collectionName, tags: { purpose: "sdk-release-smoke" },
      indexConfigs: { title: { type: "text" }, body: { type: "text" } } }, options);
    creating = false;
    stage = "write fixture documents";
    await collection.docs.upsert({ docs: [
      { id: "restore", title: "Restore a version", body: "Create a branch from a previous snapshot to restore collection data." },
      { id: "backup", title: "Keep backups", body: "Use tags to retain immutable collection snapshots for later recovery." },
      { id: "weather", title: "Weather forecast", body: "Tomorrow will be sunny with light winds." },
      { id: "recipe", title: "Bread recipe", body: "Mix flour, water and yeast, then bake the dough." },
    ] }, options);
    const input = { size: 4, consistentRead: true, query: { queryString: { query: "*:*" } }, fields: { include: ["id", "title"] } };
    stage = "baseline retrieval";
    // New Collection placement can lag creation. Poll only ordinary retrieval;
    // never retry paid reranking requests or hide permanent API errors.
    const deadline = Date.now() + 90_000;
    let baseline;
    let attempts = 0;
    while (true) {
      attempts++;
      const result = await collection.querySafe(input, options);
      if (result.ok && result.value.docs.length === 4) {
        baseline = result.value;
        break;
      }
      if (!result.ok && ![404, 503].includes(result.error?.statusCode)) throw result.error;
      assert.ok(Date.now() < deadline, "Timed out waiting for Collection placement and four visible documents");
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    console.info(`[live] Baseline retrieval ready after ${attempts} attempts`);
    assert.equal(baseline.docs.length, 4);
    assert.equal(baseline.rerank, undefined);
    assert.ok(baseline.docs.every((hit) => hit.retrievalScore === undefined));
    const scores = new Map(baseline.docs.map((hit) => [hit.doc.id, hit.score]));
    const rerank = { provider: "typesafe", model: "jev-1.13.0", queryText: "How do I restore a previous collection version?", fields: ["title", "body"] };
    const cases = [
      ["default", {}, "default-relevance-v1"],
      ["null", { criteria: null, candidateSize: null, onFailure: null }, "default-relevance-v1"],
      ["custom2", { criteria: ["Does not answer the query.", "Answers the query directly."] }, "custom"],
      ["custom3", { criteria: ["Unrelated to the query.", "Partly answers the query.", "Answers the query fully."] }, "custom"],
      ["custom10", { criteria: Array.from({ length: 10 }, (_, i) => `Relevance level ${i}: ${i} of 9 query requirements are addressed.`) }, "custom"],
    ];
    for (const [index, [label, extra, version]] of cases.entries()) {
      stage = `rerank ${label}`;
      const request = { ...input, size: 2, rerank: { ...rerank, ...extra } };
      let response;
      if (index % 2 === 0) response = await collection.query(request, options);
      else {
        const safe = await collection.querySafe(request, options);
        if (!safe.ok) throw safe.error;
        response = safe.value;
      }
      assert.equal(response.total, 2);
      assert.equal(response.docs.length, 2);
      assert.equal(response.rerank?.status, "applied");
      assert.equal(response.rerank.provider, "typesafe");
      assert.equal(response.rerank.model, "jev-1.13.0");
      assert.equal(response.rerank.candidateCount, 4);
      assert.equal(response.rerank.scoredCount, 4);
      assert.equal(response.rerank.criteriaVersion, version);
      assert.equal(response.rerank.reason, undefined);
      assert.ok(Number.isInteger(response.rerank.took) && response.rerank.took >= 0);
      assert.equal(response.maxScore, Math.max(...response.docs.map((hit) => hit.score)));
      for (const [position, hit] of response.docs.entries()) {
        assert.ok(Number.isFinite(hit.score) && hit.score >= 0 && hit.score <= 1);
        assert.equal(hit.retrievalScore, scores.get(hit.doc.id));
        assert.ok(position === 0 || response.docs[position - 1].score >= hit.score);
        assert.deepEqual(Object.keys(hit.doc).sort(), ["id", "title"]);
        assert.equal("rerankScore" in hit, false);
      }
      assert.equal("rubricVersion" in response.rerank, false);
      console.info(`[live] ${label}: applied; candidate/scored=4/4, final size=2; scores, order and projection passed`);
    }
    stage = "empty candidates";
    const empty = await collection.query({ ...input, query: { queryString: { query: "zzzxqv", defaultField: "body" } }, rerank }, options);
    assert.deepEqual(empty.docs, []);
    assert.equal(empty.maxScore, undefined);
    assert.equal(empty.rerank.status, "skipped");
    assert.equal(empty.rerank.reason, "noCandidates");
    assert.equal(empty.rerank.candidateCount, 0);
    assert.equal(empty.rerank.scoredCount, 0);
    assert.equal(empty.rerank.criteriaVersion, undefined);
    stage = "explicit null rerank";
    const legacy = await collection.query({ ...input, rerank: null }, options);
    assert.deepEqual(legacy.docs, baseline.docs);
    assert.equal(legacy.rerank, undefined);
    console.info("[live] Empty candidates skip reranking; explicit null preserves baseline");
  } catch (error) {
    throw safeError(error, stage);
  } finally {
    creating = false;
  }
});
