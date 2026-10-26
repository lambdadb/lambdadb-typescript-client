import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestError, HTTPClient, LambdaDBClient } from "../dist/esm/index.js";
import { ListDocsRequest$outboundSchema, ListDocsExtendedRequestBody$outboundSchema } from "../dist/esm/models/operations/listdocs.js";

// docs ce2d8f7bd8ee2ab4f240be022085aab37cca0b91; backend 0a54b6ecb483ce7df9677ba2071a491f9f9879c9.
function setup(respond = () => ({ total: 0, docs: [], isDocsInline: true })) {
  const calls = [];
  const client = new LambdaDBClient({ baseUrl: "https://api.test", projectName: "test-project", projectApiKey: "test-key",
    httpClient: new HTTPClient({ fetcher: async (request) => {
      const call = { method: request.method, url: new URL(request.url), body: request.method === "GET" ? undefined : await request.json() };
      calls.push(call);
      const response = respond(call, calls.length);
      return response instanceof Response ? response : new Response(JSON.stringify(response), { headers: { "content-type": "application/json" } });
    } }) });
  return { docs: client.collection("read-contract").docs, calls };
}

for (const safe of [false, true]) {
  test(`List nullable routing and unchanged GET defaults (safe=${safe})`, async () => {
    const { docs, calls } = setup();
    const method = safe ? "listSafe" : "list";
    for (const input of [{ size: null }, { pageToken: null }, { filter: null }, { size: null, pageToken: null, filter: null }]) {
      const result = await docs[method](input);
      if (safe) assert.equal(result.ok, true);
      assert.equal(calls.at(-1).method, "POST");
      assert.deepEqual(calls.at(-1).body, { ...input, includeVectors: false });
    }
    await docs[method]();
    assert.equal(calls.at(-1).method, "GET");
    assert.equal(calls.at(-1).url.searchParams.has("size"), false);
    for (const size of [101, 1000]) {
      await docs[method]({ size });
      assert.equal(calls.at(-1).method, "GET");
      assert.equal(calls.at(-1).url.searchParams.get("size"), String(size));
      await docs[method]({ size, filter: {} });
      assert.equal(calls.at(-1).method, "POST");
      assert.deepEqual(calls.at(-1).body, { size, filter: {}, includeVectors: false });
    }
  });
  test(`Fetch preserves 1000 IDs and server validation (safe=${safe})`, async () => {
    const ids = Array.from({ length: 1000 }, (_, i) => String(i));
    const { docs, calls } = setup(() => ({ total: 0, took: 0, docs: [], isDocsInline: true }));
    await docs[safe ? "fetchSafe" : "fetch"]({ ids });
    assert.deepEqual(calls[0].body.ids, ids);
    const failing = setup(() => new Response(JSON.stringify({ message: "Invalid read request" }), { status: 400, headers: { "content-type": "application/json" } }));
    for (const input of [{ ids: [...ids, "extra"] }, { ids: [" ", "same", "same"] }, { ids: [] }]) {
      if (safe) {
        const result = await failing.docs.fetchSafe(input);
        assert.equal(result.ok, false);
        assert.ok(result.error instanceof BadRequestError);
      } else await assert.rejects(failing.docs.fetch(input), BadRequestError);
      assert.deepEqual(failing.calls.at(-1).body.ids, input.ids);
    }
    for (const input of [{ size: 1001 }, { size: 0, filter: {} }]) {
      if (safe) {
        const result = await failing.docs.listSafe(input);
        assert.equal(result.ok, false);
        assert.ok(result.error instanceof BadRequestError);
      } else await assert.rejects(failing.docs.list(input), BadRequestError);
    }
  });
}

test("List pagination retains initial nulls and follows returned tokens", async () => {
  const { docs, calls } = setup((_, n) => ({ total: 2, docs: [{ collection: "read-contract", doc: { id: String(n) } }],
    isDocsInline: true, ...(n === 1 ? { nextPageToken: "next" } : {}) }));
  const result = await docs.listAll({ size: null, pageToken: null, filter: null });
  assert.equal(result.docs.length, 2);
  assert.deepEqual(calls.map(c => c.body.pageToken), [null, "next"]);
  assert.ok(calls.every(c => c.method === "POST" && c.body.size === null && c.body.filter === null));
});

test("Low-level GET remains non-nullable and POST retains omitted options", () => {
  assert.equal(ListDocsRequest$outboundSchema.safeParse({ collectionName: "test", size: null }).success, false);
  assert.deepEqual(ListDocsExtendedRequestBody$outboundSchema.parse({}), { includeVectors: false });
});
