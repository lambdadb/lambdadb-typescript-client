import assert from "node:assert/strict";
import test from "node:test";
import { HTTPClient, LambdaDBClient, SDKValidationError, ServiceUnavailableError } from "../dist/esm/index.js";
import { queryCollectionRequestBodyToJSON, queryCollectionResponseFromJSON } from "../dist/esm/models/operations/querycollection.js";

const query = { knn: { field: "embedding", queryVector: [1, 0], k: 20 } };
const rerank = { provider: "typesafe", model: "jev-1.13.0", queryText: "Restore a version", fields: ["title", "body"] };
const metadata = { status: "applied", provider: "typesafe", model: "jev-1.13.0", candidateCount: 3, scoredCount: 3, took: 12, criteriaVersion: "default-relevance-v1" };
const docs = [
  { collection: "items", score: 0.800000020000003, retrievalScore: 0.1, doc: { id: "one", title: "Restore" } },
  { collection: "items", score: 0, retrievalScore: -3.25, doc: { id: "two" } },
];
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const options = { retries: { strategy: "none" } };
function collection(reply, download = () => json(docs)) {
  const calls = [];
  const client = new LambdaDBClient({
    baseUrl: "https://api.test", projectName: "project", projectApiKey: "project-key",
    httpClient: new HTTPClient({ fetcher: async (request) => {
      calls.push(await request.json());
      return reply();
    } }),
    transferClient: new HTTPClient({ fetcher: (request) => {
      assert.equal(request.headers.get("x-api-key"), null);
      return download();
    } }),
  });
  return { handle: client.collection("items"), calls };
}

for (const extra of [
  {}, { candidateSize: null, onFailure: null, criteria: null },
  { candidateSize: 20, onFailure: "returnOriginal", criteria: ["Not useful", "Useful"] },
  { fields: Array.from({ length: 8 }, (_, i) => `f${i}`), queryText: "  Restore  ", criteria: ["Low", "Medium", "High"] },
  { candidateSize: 100, onFailure: "error", criteria: Array.from({ length: 10 }, (_, i) => `Level ${i}`) },
  { criteria: ["é".repeat(1024), "b".repeat(2048), "c".repeat(2048), "d".repeat(2048)] },
]) {
  test(`rerank request preserves fields, optional/null values, criteria and k: ${JSON.stringify(Object.keys(extra))}`, async () => {
    const input = { query, size: 10, rerank: { ...rerank, ...extra } };
    const { handle, calls } = collection(() => json({ took: 15, total: 2, docs, isDocsInline: true, rerank: metadata, maxScore: docs[0].score }));
    await handle.query(input, options);
    assert.deepEqual(calls[0], { ...input, consistentRead: false, includeVectors: false });
    assert.deepEqual(input.query, query);
    assert.equal(calls[0].query.knn.k, 20);
    assert.equal(calls[0].rerank.candidateSize, extra.candidateSize);
  });
}

test("legacy and explicit null rerank requests preserve wire behavior and facet-only support", () => {
  for (const extra of [{}, { rerank: null }]) {
    assert.deepEqual(JSON.parse(queryCollectionRequestBodyToJSON({ query, ...extra })), {
      query, ...extra, consistentRead: false, includeVectors: false,
    });
    assert.doesNotThrow(() => queryCollectionRequestBodyToJSON({ size: 0, facets: { tags: {} }, ...extra }));
  }
});

const invalidConfigs = [
  ...["provider", "model", "queryText", "fields"].map((key) => ({ [key]: undefined })),
  { provider: "cohere" }, { model: "unknown" }, { queryText: "" }, { queryText: "\u3000" },
  { queryText: "é".repeat(4097) }, { fields: [] }, { fields: ["body", "body"] },
  { fields: ["body..title"] }, { fields: [" "] }, { fields: Array.from({ length: 9 }, (_, i) => `f${i}`) },
  ...[0, 9, 101, 1.5, "50"].map((candidateSize) => ({ candidateSize })),
  { onFailure: "ignore" }, ...[[], ["one"], ["a", "a"], ["a", " "], ["a", null], [{}, {}],
    Array.from({ length: 11 }, (_, i) => `${i}`), ["é".repeat(1025), "b"],
    Array.from({ length: 5 }, (_, i) => `${i}${"é".repeat(1000)}`)].map((criteria) => ({ criteria })),
  { weights: [0, 1] }, { threshold: 0.5 }, { apiKey: "not-a-client-option" },
];
const invalidInputs = [
  ...invalidConfigs.map((extra) => ({ query, size: 10, rerank: { ...rerank, ...extra } })),
  ...[0, -1, 101].map((size) => ({ query, size, facets: { tags: {} }, rerank })),
  { rerank }, { query: {}, rerank }, { query: { bool: [{ queryString: { query: "q" }, occur: "filter" }] }, rerank },
  { query: { bool: [{ knn: query.knn, occur: "MUST_NOT" }] }, rerank },
  { query, rerank, sort: [] }, { query, rerank, sort: [{ title: "asc" }] },
];
for (const safe of [false, true]) {
  test(`invalid rerank inputs fail before HTTP, safe=${safe}`, async () => {
    const { handle, calls } = collection(() => json({ took: 0, total: 0, docs: [], isDocsInline: true }));
    for (const input of invalidInputs) {
      if (safe) {
        const result = await handle.querySafe(input, options);
        assert.equal(result.ok, false, JSON.stringify(input));
        assert.ok(result.error instanceof SDKValidationError);
      } else {
        await assert.rejects(handle.query(input, options), SDKValidationError);
      }
    }
    assert.equal(calls.length, 0);
  });
}

test("query default size and candidate cap stay on the server; scoring bool/hybrid/sparse queries pass unchanged", () => {
  for (const scoring of [
    query, { queryString: { query: "restore", defaultField: "body" } },
    { sparseVector: { field: "sparse", queryVector: { indices: [1], values: [1] } } },
    ...["bool", "rrf", "mm", "l2"].map((key) => ({ [key]: [query, { queryString: { query: "restore" } }] })),
  ]) {
    const wire = JSON.parse(queryCollectionRequestBodyToJSON({ query: scoring, rerank }));
    assert.deepEqual(wire.query, scoring);
    assert.equal("size" in wire, false);
    assert.equal("candidateSize" in wire.rerank, false);
  }
  assert.throws(() => queryCollectionRequestBodyToJSON({ query, rerank: { ...rerank, candidateSize: 9 } }));
  assert.doesNotThrow(() => queryCollectionRequestBodyToJSON({ query, size: 75, rerank }));
  assert.doesNotThrow(() => queryCollectionRequestBodyToJSON({ query, size: 100, rerank: { ...rerank, candidateSize: 100 } }));
});

test("undefined optional composite keys preserve scoring queries through serialization", async () => {
  const optional = { bool: undefined, rrf: undefined, mm: undefined, l2: undefined };
  for (const scoring of [
    query,
    { queryString: { query: "restore", defaultField: "body" } },
    ...["bool", "rrf", "mm", "l2"].map((key) => ({ [key]: [{ ...optional, ...query }] })),
  ]) {
    for (const safe of [false, true]) {
      const { handle, calls } = collection(() => json({ took: 0, total: 0, docs: [], isDocsInline: true }));
      const input = { query: { ...optional, ...scoring }, rerank };
      if (safe) assert.equal((await handle.querySafe(input, options)).ok, true);
      else await handle.query(input, options);
      assert.deepEqual(calls[0].query, JSON.parse(JSON.stringify(scoring)));
    }
  }
  // A present composite still takes precedence over other scoring alternatives.
  for (const value of [null, [], [{ ...query, occur: "FILTER" }]]) {
    assert.throws(() => queryCollectionRequestBodyToJSON({ query: { bool: value, ...query }, rerank }));
  }
});

for (const safe of [false, true]) {
  for (const download of [false, true]) {
    test(`scores, ordering, applied metadata and facets survive query/download, safe=${safe}, download=${download}`, async () => {
      for (const criteriaVersion of ["default-relevance-v1", "custom"]) {
        const reply = { took: 15, total: 2, docs: download ? [] : docs, isDocsInline: !download,
          ...(download ? { docsUrl: "https://files.test/docs" } : {}), maxScore: docs[0].score,
          rerank: { ...metadata, criteriaVersion, resolvedModel: "jev-1.13.0" },
          facets: { tags: { buckets: [{ value: "restore", count: 500 }] } } };
        const { handle } = collection(() => json(reply));
        const input = { query: { queryString: { query: "restore" } }, rerank, facets: { tags: {} } };
        const result = safe ? await handle.querySafe(input, options) : await handle.query(input, options);
        if (safe) assert.equal(result.ok, true);
        const response = safe ? result.value : result;
        assert.deepEqual(response.docs, docs);
        assert.equal(response.maxScore, docs[0].score);
        assert.deepEqual(response.rerank, reply.rerank);
        assert.deepEqual(response.facets, reply.facets);
        assert.equal(response.docs[1].score, 0);
        assert.equal("retrievalScore" in response.docs[0].doc, false);
        assert.equal("rerankScore" in response.docs[0], false);
        assert.equal("rubricVersion" in response.rerank, false);
      }
    });
  }
}

test("legacy, zero, skipped and fallback responses preserve omission and retrieval scores", () => {
  const base = { took: 0, total: 0, docs: [], isDocsInline: true };
  for (const reply of [
    base,
    { ...base, total: 1, maxScore: 0, docs: [{ collection: "items", score: 0, retrievalScore: 0, doc: {} }], rerank: { ...metadata, candidateCount: 1, scoredCount: 1 } },
    { ...base, rerank: { status: "skipped", provider: "typesafe", model: "jev-1.13.0", candidateCount: 0, scoredCount: 0, took: 0, reason: "noCandidates" } },
    ...["timeout", "rateLimit", "unavailable", "invalidResponse", "credentials"].map((reason) => ({
      ...base, total: 1, maxScore: 3.25, docs: [{ collection: "items", score: 3.25, doc: {} }],
      rerank: { ...metadata, status: "fallback", scoredCount: 0, criteriaVersion: undefined, reason },
    })),
  ]) {
    const parsed = queryCollectionResponseFromJSON(JSON.stringify(reply));
    assert.equal(parsed.ok, true);
    assert.deepEqual(JSON.parse(JSON.stringify(parsed.value)), JSON.parse(JSON.stringify(reply)));
  }
});

test("metadata required fields match the DTO while nullable optional fields normalize to undefined", () => {
  const base = { took: 1, total: 0, docs: [], isDocsInline: true, rerank: { ...metadata, resolvedModel: null, reason: null, criteriaVersion: null } };
  const result = queryCollectionResponseFromJSON(JSON.stringify(base));
  assert.equal(result.ok, true);
  assert.equal(result.value.rerank.criteriaVersion, undefined);
  for (const key of ["status", "provider", "model", "candidateCount", "scoredCount", "took"]) {
    const invalid = structuredClone(base);
    delete invalid.rerank[key];
    assert.equal(queryCollectionResponseFromJSON(JSON.stringify(invalid)).ok, false, key);
  }
});

for (const safe of [false, true]) {
  test(`returnOriginal does not implement client fallback for server errors, safe=${safe}`, async () => {
    const { handle, calls } = collection(() => json({ message: "Rerank failed: unavailable" }, 503));
    const input = { query, rerank: { ...rerank, onFailure: "returnOriginal" } };
    if (safe) {
      const result = await handle.querySafe(input, options);
      assert.equal(result.ok, false);
      assert.ok(result.error instanceof ServiceUnavailableError);
    } else {
      await assert.rejects(handle.query(input, options), ServiceUnavailableError);
    }
    assert.equal(calls.length, 1);
  });
}
