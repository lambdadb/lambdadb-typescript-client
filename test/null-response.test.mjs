import assert from "node:assert/strict";
import test from "node:test";

import { LambdaDBClient } from "../dist/esm/index.js";
import { HTTPClient } from "../dist/esm/lib/http.js";
import { ResponseValidationError } from "../dist/esm/models/errors/responsevalidationerror.js";
import { QueryCollectionResponse$inboundSchema } from "../dist/esm/models/operations/querycollection.js";

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("response schemas accept null for optional response fields", () => {
  const parsed = QueryCollectionResponse$inboundSchema.parse({
    took: 1,
    maxScore: null,
    total: 1,
    docs: [{ collection: "items", score: null, doc: { id: "a" } }],
    isDocsInline: false,
    docsUrl: null,
  });

  assert.equal(parsed.maxScore, undefined);
  assert.equal(parsed.docsUrl, undefined);
  assert.equal(parsed.docs[0].score, undefined);
});

test("safe methods return ResponseValidationError for invalid JSON bodies", async () => {
  const httpClient = new HTTPClient({
    fetcher: async () =>
      new Response("{", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });
  const client = new LambdaDBClient({ httpClient, projectApiKey: "test-key" });

  const result = await client.listCollectionsSafe();

  assert.equal(result.ok, false);
  assert.ok(result.error instanceof ResponseValidationError);
  assert.equal(result.error.rawValue, "{");
});

test("docsUrl fetches treat null document payloads as an empty docs array", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse(null);

  try {
    const httpClient = new HTTPClient({
      fetcher: async () =>
        jsonResponse({
          total: 1,
          docs: [],
          isDocsInline: false,
          docsUrl: "https://example.test/docs.json",
        }),
    });
    const client = new LambdaDBClient({ httpClient, projectApiKey: "test-key" });

    const result = await client.collection("items").docs.listSafe();

    assert.equal(result.ok, true);
    assert.deepEqual(result.value.docs, []);
    assert.equal(result.value.isDocsInline, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
