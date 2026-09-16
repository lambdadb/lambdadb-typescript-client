import assert from "node:assert/strict";
import test from "node:test";

import {
  HTTPClient,
  LambdaDBClient,
  UnexpectedClientError,
} from "../dist/esm/index.js";

const docsUrl = "https://download.test/results?signature=unchanged%2Bvalue";
// Server contract: lambdadb d1a76659884a9ed09283a0b2e2989897dc799247,
// QueryCoordinatorService.responsePayload serializes response.getDocs() directly.
const docs = [{ collection: "items", doc: { _id: "one", title: "Test" }, score: 1 }];
const metadata = { took: 7, total: 1, nextPageToken: "next-page" };
const query = { query: { matchAll: {} } };
const methods = [
  ["query", "POST", "/query", (c, o) => c.query(query, o)],
  ["querySafe", "POST", "/query", (c, o) => c.querySafe(query, o)],
  ["fetch", "POST", "/docs/fetch", (c, o) => c.docs.fetch({ ids: ["one"] }, o)],
  ["fetchSafe", "POST", "/docs/fetch", (c, o) => c.docs.fetchSafe({ ids: ["one"] }, o)],
  ["list", "GET", "/docs", (c, o) => c.docs.list({ size: 1 }, o)],
  ["listSafe", "GET", "/docs", (c, o) => c.docs.listSafe({ size: 1 }, o)],
  ["extended list", "POST", "/docs/list", (c, o) => c.docs.list({ fields: { include: ["title"] } }, o)],
  ["extended listSafe", "POST", "/docs/list", (c, o) => c.docs.listSafe({ fields: { include: ["title"] } }, o)],
];

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
}

function createClient(download, api = () => jsonResponse({
  ...metadata, docs: [], isDocsInline: false, docsUrl,
})) {
  return new LambdaDBClient({
    baseUrl: "https://api.test",
    projectName: "test",
    projectApiKey: "test-api-key",
    httpClient: new HTTPClient({ fetcher: api }),
    transferClient: new HTTPClient({ fetcher: download }),
  }).collection("items");
}

for (const [name, method, path, invoke] of methods) {
  test(`${name} downloads arrays and retains legacy payload support and request options`, async () => {
    for (const payload of [docs, [], { docs }, { docs: null }, null]) {
      const controller = new AbortController();
      let downloads = 0;
      let apiCalls = 0;
      let downloadSignal;
      const collection = createClient((request) => {
        downloads++;
        assert.equal(request.url, docsUrl);
        assert.equal(request.method, "GET");
        assert.equal(request.headers.get("x-api-key"), null);
        assert.equal(request.headers.get("authorization"), null);
        assert.equal(request.headers.get("x-api-only"), null);
        downloadSignal = request.signal;
        return jsonResponse(payload);
      }, (request) => {
        apiCalls++;
        assert.equal(request.method, method);
        assert.equal(new URL(request.url).pathname, `/projects/test/collections/items${path}`);
        assert.equal(request.headers.get("x-api-key"), "test-api-key");
        assert.equal(request.headers.get("x-api-only"), "preserved");
        return jsonResponse({ ...metadata, docs: [], isDocsInline: false, docsUrl });
      });
      const result = await invoke(collection, {
        headers: { "x-api-only": "preserved", authorization: "api-only" },
        ...(Array.isArray(payload)
          ? { signal: controller.signal }
          : { fetchOptions: { signal: controller.signal } }),
      });
      if (name.endsWith("Safe")) assert.equal(result.ok, true);
      const response = name.endsWith("Safe") ? result.value : result;
      assert.deepEqual(response.docs, Array.isArray(payload) ? payload : payload?.docs ?? []);
      assert.equal(response.isDocsInline, true);
      assert.equal(response.docsUrl, docsUrl);
      assert.equal(response.total, metadata.total);
      if (name.includes("list")) assert.equal(response.nextPageToken, metadata.nextPageToken);
      else assert.equal(response.took, metadata.took);
      assert.equal(apiCalls, 1);
      assert.equal(downloads, 1);
      controller.abort();
      assert.equal(downloadSignal.aborted, true);
    }
  });

  test(`${name} preserves download errors`, async () => {
    const cases = [
      [() => jsonResponse("invalid"), /^Unexpected document payload shape from URL$/],
      [() => jsonResponse({ docs: "invalid" }), /^Unexpected docs payload shape from URL$/],
      [() => new Response("{"), /^Failed to parse documents from URL as JSON: SyntaxError:/],
      [() => new Response("expired", { status: 403, statusText: "Forbidden" }),
        /^Failed to fetch documents from URL: 403 Forbidden - expired$/],
    ];
    for (const [download, message] of cases) {
      const collection = createClient(download);
      if (name.endsWith("Safe")) {
        const result = await invoke(collection);
        assert.equal(result.ok, false);
        assert.ok(result.error instanceof UnexpectedClientError);
        assert.match(result.error.message, message);
      } else {
        await assert.rejects(() => invoke(collection), { name: "UnexpectedClientError", message });
      }
    }
  });
}

test("listAll downloads arrays across pages and preserves the page token", async () => {
  let apiCalls = 0;
  let downloads = 0;
  const collection = createClient(() => {
    downloads++;
    return jsonResponse([{ doc: { _id: String(downloads) } }]);
  }, (request) => {
    assert.equal(new URL(request.url).searchParams.get("pageToken"), apiCalls === 0 ? null : "next-page");
    apiCalls++;
    return jsonResponse({
      total: 2, docs: [], isDocsInline: false, docsUrl,
      nextPageToken: apiCalls === 1 ? "next-page" : null,
    });
  });
  assert.deepEqual(await collection.docs.listAll(), {
    docs: [{ doc: { _id: "1" } }, { doc: { _id: "2" } }], total: 2,
  });
  assert.equal(apiCalls, 2);
  assert.equal(downloads, 2);
});
