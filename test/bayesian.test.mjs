import assert from "node:assert/strict";
import test from "node:test";
import { HTTPClient, LambdaDBClient, BadRequestError, SDKValidationError } from "../dist/esm/index.js";
import { queryCollectionRequestBodyToJSON } from "../dist/esm/models/operations/querycollection.js";

const lexical = { bool: [{ queryString: { query: "body:restore" }, occur: "SHOULD" }] };
const vector = { knn: { field: "embedding", queryVector: [1, 0], k: 30,
  filter: { queryString: { query: "status:active" } } } };
const query = { bayesian: [lexical, vector] };
const rerank = { provider: "typesafe", model: "jev-1.13.0", queryText: "Restore a version", fields: ["body"] };
const options = { retries: { strategy: "none" } };

test("Bayesian serialization preserves signals, filters and budgets without fusion or rerank defaults", () => {
  for (const extra of [{}, { size: 10, candidateSize: 30 }, { rerank }, { rerank: null, candidateSize: 30 }]) {
    const wire = JSON.parse(queryCollectionRequestBodyToJSON({ query, ...extra }));
    assert.deepEqual(wire, { query, ...extra, consistentRead: false, includeVectors: false });
  }
});

for (const safe of [false, true]) {
  test(`explicit Bayesian candidate budget reaches HTTP unchanged, safe=${safe}`, async () => {
    let body;
    const client = new LambdaDBClient({ baseUrl: "https://api.test", projectName: "project", projectApiKey: "test-key",
      httpClient: new HTTPClient({ fetcher: async (request) => {
        body = await request.json();
        return new Response(JSON.stringify({ took: 0, total: 0, docs: [], isDocsInline: true }), {
          headers: { "content-type": "application/json" },
        });
      } }) });
    const input = { query, size: 10, candidateSize: 30 };
    const collection = client.collection("items");
    const result = safe ? await collection.querySafe(input, options) : await collection.query(input, options);
    if (safe) assert.equal(result.ok, true);
    assert.deepEqual(body, { ...input, consistentRead: false, includeVectors: false });
  });

  test(`Bayesian + rerank reaches HTTP and preserves response scores, safe=${safe}`, async () => {
    const calls = [];
    const response = { took: 1, total: 1, isDocsInline: true, maxScore: 0.9,
      docs: [{ collection: "items", score: 0.9, retrievalScore: 0.7, doc: { id: "one" } }],
      rerank: { status: "applied", provider: "typesafe", model: "jev-1.13.0", candidateCount: 2, scoredCount: 2, took: 1 } };
    const client = new LambdaDBClient({ baseUrl: "https://api.test", projectName: "project", projectApiKey: "test-key",
      httpClient: new HTTPClient({ fetcher: async (request) => {
        calls.push(await request.json());
        return new Response(JSON.stringify(response), { headers: { "content-type": "application/json" } });
      } }) });
    const handle = client.collection("items");
    const input = { query, size: 1, rerank };
    const result = safe ? await handle.querySafe(input, options) : await handle.query(input, options);
    if (safe) assert.equal(result.ok, true);
    assert.deepEqual(safe ? result.value : result, response);
    assert.deepEqual(calls, [{ ...input, consistentRead: false, includeVectors: false }]);
  });
}

test("Bayesian scoring follows composite precedence and excludes filter-only descendants", () => {
  for (const q of [
    { bayesian: [{ queryString: { query: "*:*" }, occur: "FILTER" }, { ...vector, occur: "MUST_NOT" }] },
    { bayesian: null, ...vector }, { rrf: [], ...query },
  ]) assert.throws(() => queryCollectionRequestBodyToJSON({ query: q, rerank }));
  assert.doesNotThrow(() => queryCollectionRequestBodyToJSON({ query: { ...query, mm: [] }, rerank }));
});

test("Bayesian contract errors remain server errors, preserving the free-form query API", async () => {
  let calls = 0;
  const client = new LambdaDBClient({ baseUrl: "https://api.test", projectName: "project", projectApiKey: "test-key",
    httpClient: new HTTPClient({ fetcher: async () => {
      calls++;
      return new Response(JSON.stringify({ message: "Invalid Bayesian query" }), {
        status: 400, headers: { "content-type": "application/json" },
      });
    } }) });
  const handle = client.collection("items");
  for (const invalid of [
    { bayesian: [vector] }, { bayesian: [vector, vector, vector] },
    { bayesian: [{ ...vector, boost: 1 }, lexical] },
    { bayesian: [{ bool: [{ bool: [{ ...vector, boost: 1 }] }] }, lexical] },
    { bool: [query] },
  ]) {
    const result = await handle.querySafe({ query: invalid }, options);
    assert.equal(result.ok, false);
    assert.ok(result.error instanceof BadRequestError);
    assert.equal(result.error instanceof SDKValidationError, false);
  }
  assert.equal(calls, 5);
});
