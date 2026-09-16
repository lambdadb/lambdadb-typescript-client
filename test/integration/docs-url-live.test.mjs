import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

import {
  HTTPClient,
  LambdaDBClient,
  ResourceNotFoundError,
} from "../../dist/esm/index.js";

// lambdadb d1a76659884a9ed09283a0b2e2989897dc799247:
// MAX_RESULT_PAYLOAD_SIZE is 6 MiB * 0.95; each document may be up to 5 MiB.
const payload = "x".repeat(3 * 1024 * 1024);
const ids = ["offload-1", "offload-2"];
const digest = (value) => createHash("sha256").update(value).digest("hex");

function serverOptions() {
  for (const name of ["LAMBDADB_BASE_URL", "LAMBDADB_PROJECT_NAME", "LAMBDADB_PROJECT_API_KEY"]) {
    assert.ok(process.env[name], `Missing ${name}; load the intended environment's .env.local`);
  }
  const raw = process.env.LAMBDADB_BASE_URL;
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  const projectName = process.env.LAMBDADB_PROJECT_NAME;
  return url.pathname.replace(/\/+$/, "") === `/projects/${encodeURIComponent(projectName)}`
    ? { serverURL: url.toString() }
    : { baseUrl: url.toString(), projectName };
}

async function eventually(operation, description, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (await operation()) return;
    assert.ok(Date.now() < deadline, `Timed out waiting for ${description}`);
    await delay(2_000);
  }
}

test("live Query, Fetch, and List download server arrays, including Safe methods", {
  timeout: 900_000,
}, async (t) => {
  let observing = false;
  let wireResponse;
  let downloads = 0;
  const httpClient = new HTTPClient();
  httpClient.addHook("response", async (response) => {
    if (observing && response.ok) wireResponse = await response.clone().json();
  });
  const transferClient = new HTTPClient();
  transferClient.addHook("beforeRequest", (request) => {
    assert.equal(request.method, "GET");
    // Compare without printing the signed URL on assertion failure.
    assert.ok(request.url === wireResponse?.docsUrl, "Download must use the unchanged docsUrl");
    for (const header of ["x-api-key", "authorization", "x-sdk-smoke"]) {
      assert.ok(!request.headers.has(header), `Download must not forward ${header}`);
    }
  });
  transferClient.addHook("response", async (response) => {
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(await response.clone().json()), "Server docsUrl must contain a JSON array");
    downloads++;
  });

  const client = new LambdaDBClient({
    ...serverOptions(),
    projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY,
    httpClient,
    transferClient,
  });
  const collectionName = `ts-offload-${randomUUID()}`;
  const collection = client.collection(collectionName);
  const options = { timeoutMs: 30_000, headers: { "x-sdk-smoke": "api-only" } };
  await client.createCollection({
    collectionName,
    description: "TypeScript docsUrl live smoke",
    tags: { purpose: "sdk-smoke" },
    indexConfigs: { marker: { type: "keyword" } },
  }, options);
  console.info(`[live] Created ${collectionName}`);

  t.after(async () => {
    observing = false;
    await collection.delete(options);
    await eventually(async () => {
      const result = await collection.getSafe(options);
      if (result.ok) return false;
      if (!(result.error instanceof ResourceNotFoundError)) throw result.error;
      return true;
    }, "Collection cleanup", 30_000);
    console.info(`[live] Deleted ${collectionName}; absence verified`);
  });

  // Keep each write below the request limit while the combined result exceeds it.
  for (const id of ids) {
    await collection.docs.upsert({ docs: [{ id, marker: "offload", payload }] }, options);
  }
  // Poll a small projection until both writes are committed; List has no consistentRead.
  await eventually(async () => {
    const response = await collection.docs.list({
      size: ids.length, fields: { include: ["id"] },
    }, options);
    return response.docs.length === ids.length;
  }, "committed documents", 300_000);
  console.info("[live] Both documents are committed; testing 6 MiB result downloads");

  const query = { size: ids.length, query: { queryString: { query: "*:*" } } };
  const extended = { size: ids.length, fields: { include: ["id", "payload"] } };
  const cases = [
    ["query", () => collection.query(query, options)],
    ["querySafe", () => collection.querySafe(query, options)],
    ["fetch", () => collection.docs.fetch({ ids }, options)],
    ["fetchSafe", () => collection.docs.fetchSafe({ ids }, options)],
    ["list", () => collection.docs.list({ size: ids.length }, options)],
    ["listSafe", () => collection.docs.listSafe({ size: ids.length }, options)],
    ["extended list", () => collection.docs.list(extended, options)],
    ["extended listSafe", () => collection.docs.listSafe(extended, options)],
  ];
  for (const [name, invoke] of cases) {
    wireResponse = undefined;
    downloads = 0;
    observing = true;
    const result = await invoke();
    observing = false;
    if (name.endsWith("Safe")) {
      assert.equal(result.ok, true, `${name} must succeed`);
    }
    const response = name.endsWith("Safe") ? result.value : result;
    assert.equal(wireResponse?.isDocsInline, false, `${name} must actually offload`);
    assert.equal(wireResponse.docs.length, 0);
    assert.equal(downloads, 1, `${name} must download exactly once`);
    assert.equal(response.isDocsInline, true);
    assert.equal(response.total, ids.length);
    assert.deepEqual(response.docs.map(({ doc }) => doc.id).sort(), ids);
    for (const { doc } of response.docs) {
      assert.equal(doc.payload.length, payload.length);
      assert.equal(digest(doc.payload), digest(payload), `${name} must preserve the full payload`);
    }
    console.info(`[live] ${name}: server offload, array download, full content, and header isolation passed`);
  }
});
