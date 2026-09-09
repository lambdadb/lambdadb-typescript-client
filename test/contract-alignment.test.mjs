import assert from "node:assert/strict";
import test from "node:test";

import {
  BadGatewayError,
  CatalogConflictError,
  DATA_VERSIONING_CONTRACT_REVISION,
  GatewayTimeoutError,
  HTTPClient,
  LambdaDBClient,
  LambdaDBError,
  PayloadTooLargeError,
  ResourceAlreadyExistsError,
  ResponseValidationError,
  SDKValidationError,
  ServiceUnavailableError,
  TooManyRequestsError,
  tagTarget,
} from "../dist/esm/index.js";

const BASE_URL = "https://api.test";
const COLLECTION_NAME = "contract-items";
const INDEX_CONFIGS = { title: { type: "text" } };
const NO_RETRIES = { retries: { strategy: "none" } };

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

async function capture(request) {
  return {
    body: await request.clone().text(),
    headers: Object.fromEntries(request.headers.entries()),
    method: request.method,
    url: new URL(request.url),
  };
}

function createClient(apiHandler, transferHandler) {
  const apiCalls = [];
  const transferCalls = [];
  const httpClient = new HTTPClient({
    fetcher: async (request) => {
      const call = await capture(request);
      apiCalls.push(call);
      return apiHandler(call, apiCalls.length - 1);
    },
  });
  const transferClient = new HTTPClient({
    fetcher: async (request) => {
      const call = await capture(request);
      transferCalls.push(call);
      return transferHandler?.(call, transferCalls.length - 1)
        ?? new Response(null, { status: 200 });
    },
  });
  return {
    apiCalls,
    transferCalls,
    client: new LambdaDBClient({
      baseUrl: BASE_URL,
      projectName: "project-one",
      projectApiKey: "api-key",
      httpClient,
      transferClient,
    }),
  };
}

function createdCollection(tags) {
  return {
    collection: {
      collectionName: COLLECTION_NAME,
      description: "",
      tags,
      defaultBranchName: "main",
      snapshotRetentionInDays: 30,
      createdAt: 1788825600000,
    },
  };
}

function collectionResponse() {
  return {
    collection: {
      projectName: "project-one",
      collectionName: COLLECTION_NAME,
      indexConfigs: INDEX_CONFIGS,
      description: "",
      tags: {},
      numPartitions: 1,
      numDocs: 0,
      defaultBranchName: "main",
      snapshotRetentionInDays: 30,
      createdAt: 1788825600000,
      updatedAt: 1788825600000,
    },
  };
}

test("pins the final b171ff0 OpenAPI contract", () => {
  assert.equal(
    DATA_VERSIONING_CONTRACT_REVISION,
    "b171ff0a408bbeb024535941b83b861d205a829f",
  );
});

test("validates nonempty schemas and Java String.isBlank metadata tags", async () => {
  const { apiCalls, client } = createClient((call) => {
    const tags = JSON.parse(call.body).tags;
    return jsonResponse(createdCollection(tags), 201);
  });

  const emptySchema = await client.createCollectionSafe({
    collectionName: COLLECTION_NAME,
    indexConfigs: {},
  });
  assert.equal(emptySchema.ok, false);
  assert.ok(emptySchema.error instanceof SDKValidationError);

  const javaBlankCodePoints = [
    ...Array.from({ length: 5 }, (_, index) => 0x0009 + index),
    ...Array.from({ length: 5 }, (_, index) => 0x001c + index),
    0x1680,
    ...Array.from({ length: 7 }, (_, index) => 0x2000 + index),
    ...Array.from({ length: 3 }, (_, index) => 0x2008 + index),
    0x2028,
    0x2029,
    0x205f,
    0x3000,
  ];
  for (const codePoint of javaBlankCodePoints) {
    const result = await client.createCollectionSafe({
      collectionName: COLLECTION_NAME,
      indexConfigs: INDEX_CONFIGS,
      tags: { value: String.fromCodePoint(codePoint) },
    });
    assert.equal(result.ok, false, `U+${codePoint.toString(16)} must be blank`);
    assert.ok(result.error instanceof SDKValidationError);
  }
  assert.equal(apiCalls.length, 0);

  for (const value of ["\u00a0", "\u2007", "\u202f"]) {
    const result = await client.createCollectionSafe({
      collectionName: COLLECTION_NAME,
      indexConfigs: INDEX_CONFIGS,
      tags: { value },
    });
    assert.equal(result.ok, true);
  }
  assert.equal(apiCalls.length, 3);
});

test("rejects an empty indexConfigs map in a full Collection response", async () => {
  const invalid = collectionResponse();
  invalid.collection.indexConfigs = {};
  const { client } = createClient(() => jsonResponse(invalid));

  const result = await client.collection(COLLECTION_NAME).getSafe(NO_RETRIES);
  assert.equal(result.ok, false);
  assert.ok(result.error instanceof ResponseValidationError);
});

test("enforces Collection PATCH and document delete selector semantics", async () => {
  const { apiCalls, client } = createClient((call) => {
    if (call.method === "PATCH") return jsonResponse(collectionResponse());
    return jsonResponse({ message: "Accepted" }, 202);
  });
  const collection = client.collection(COLLECTION_NAME);

  const emptyIndexConfigs = await collection.updateSafe({ indexConfigs: {} });
  assert.equal(emptyIndexConfigs.ok, false);
  assert.ok(emptyIndexConfigs.error instanceof SDKValidationError);

  const nullOnly = await collection.updateSafe({ description: null });
  assert.equal(nullOnly.ok, false);
  assert.ok(nullOnly.error instanceof SDKValidationError);

  const updated = await collection.updateSafe({ description: null, tags: {} });
  assert.equal(updated.ok, true);
  assert.deepEqual(JSON.parse(apiCalls[0].body), { description: null, tags: {} });

  const partitionOnly = await collection.docs.deleteSafe({
    partitionFilter: { field: "tenant", in: ["acme"] },
  });
  assert.equal(partitionOnly.ok, false);
  assert.ok(partitionOnly.error instanceof SDKValidationError);

  const bothSelectors = await collection.docs.deleteSafe({
    ids: ["doc-1"],
    filter: { queryString: { query: "kind:test" } },
  });
  assert.equal(bothSelectors.ok, false);
  assert.ok(bothSelectors.error instanceof SDKValidationError);

  assert.equal((await collection.docs.deleteSafe({ ids: ["doc-1"] })).ok, true);
  assert.equal((await collection.docs.deleteSafe({
    filter: { queryString: { query: "kind:test" } },
    partitionFilter: { field: "tenant", in: ["acme"] },
  })).ok, true);
  assert.equal(apiCalls.length, 3);
});

test("rejects unknown JSON request fields and explicitly sends bulk type", async () => {
  const { apiCalls, client } = createClient((call) => {
    if (call.url.pathname.endsWith("/bulk-upsert")) {
      return jsonResponse({ message: "Accepted" }, 202);
    }
    return jsonResponse({ took: 0, total: 0, docs: [], isDocsInline: true });
  });
  const collection = client.collection(COLLECTION_NAME);

  const unknown = await collection.querySafe({
    query: { matchAll: {} },
    retiredField: true,
  });
  assert.equal(unknown.ok, false);
  assert.ok(unknown.error instanceof SDKValidationError);
  assert.equal(apiCalls.length, 0);

  const completed = await collection.docs.bulkUpsertSafe({
    objectKey: "uploads/docs.json",
    branch: "candidate",
  });
  assert.equal(completed.ok, true);
  assert.deepEqual(JSON.parse(apiCalls[0].body), {
    objectKey: "uploads/docs.json",
    type: "application/json",
    branch: "candidate",
  });
});

test("maps updated Gateway statuses and preserves Retry-After", async () => {
  const cases = [
    [409, CatalogConflictError],
    [413, PayloadTooLargeError],
    [429, TooManyRequestsError],
    [502, BadGatewayError],
    [503, ServiceUnavailableError],
    [504, GatewayTimeoutError],
  ];

  for (const [status, ErrorClass] of cases) {
    const { client } = createClient(() =>
      jsonResponse(
        { message: `status-${status}` },
        status,
        status === 429 ? { "Retry-After": "7" } : {},
      ));
    const result = await client.collection(COLLECTION_NAME).updateSafe(
      { description: "updated" },
      NO_RETRIES,
    );
    assert.equal(result.ok, false);
    assert.ok(result.error instanceof ErrorClass);
    assert.equal(result.error.statusCode, status);
    assert.equal(result.error.data$.message, `status-${status}`);
    assert.equal(result.error.rawResponse.status, status);
    if (status === 429) assert.equal(result.error.retryAfter, "7");
  }
});

test("distinguishes create collisions from conditional ref conflicts", async () => {
  const { client } = createClient((_call, index) =>
    index === 2
      ? jsonResponse({ message: "dependency unavailable" }, 503)
      : jsonResponse({ message: "conflict" }, 409)
  );
  const aliases = client.collection(COLLECTION_NAME).aliases;

  const duplicate = await aliases.createSafe({
    aliasName: "production",
    target: tagTarget("release-001"),
  }, NO_RETRIES);
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.error instanceof ResourceAlreadyExistsError);

  const conflict = await aliases.retargetSafe("production", {
    target: tagTarget("release-002"),
  }, NO_RETRIES);
  assert.equal(conflict.ok, false);
  assert.ok(conflict.error instanceof CatalogConflictError);

  const unavailable = await aliases.listSafe(NO_RETRIES);
  assert.equal(unavailable.ok, false);
  assert.ok(unavailable.error instanceof ServiceUnavailableError);
});

test("reports storage 412 without retrying PUT or finalizing the import", async () => {
  const { apiCalls, transferCalls, client } = createClient(() =>
    jsonResponse({
      url: "https://storage.test/upload",
      objectKey: "uploads/docs.json",
      type: "application/json",
      httpMethod: "PUT",
      headers: { "If-None-Match": "*" },
      sizeLimitBytes: 1024,
    }), () =>
      new Response("<Error><Code>PreconditionFailed</Code></Error>", {
        status: 412,
        statusText: "Precondition Failed",
        headers: { "content-type": "application/xml" },
      }));

  const result = await client.collection(COLLECTION_NAME).docs.bulkUpsertDocsSafe({
    docs: [{ id: "doc-1" }],
    branch: "candidate",
  });
  assert.equal(result.ok, false);
  assert.ok(result.error instanceof Error);
  assert.equal(result.error instanceof LambdaDBError, false);
  assert.match(result.error.message, /412 Precondition Failed/);
  assert.match(result.error.message, /PreconditionFailed/);
  assert.equal(apiCalls.length, 1);
  assert.equal(transferCalls.length, 1);
  assert.equal(transferCalls[0].headers["if-none-match"], "*");
});
