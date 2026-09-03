import assert from "node:assert/strict";
import test from "node:test";

import {
  DATA_VERSIONING_CONTRACT_REVISION,
  HTTPClient,
  LambdaDBClient,
  LambdaDBDefaultError,
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
  SDKValidationError,
  aliasRef,
  branchRef,
  branchSource,
  branchTarget,
  tagRef,
  tagSource,
  tagTarget,
} from "../dist/esm/index.js";

const BASE_URL = "https://api.test";
const PROJECT_NAME = "project-one";
const COLLECTION_NAME = "versioned-items";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function capturedCall(request) {
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
      const call = await capturedCall(request);
      apiCalls.push(call);
      return apiHandler(call, apiCalls.length - 1);
    },
  });
  const transferClient = new HTTPClient({
    fetcher: async (request) => {
      const call = await capturedCall(request);
      transferCalls.push(call);
      return transferHandler?.(call, transferCalls.length - 1)
        ?? new Response(null, { status: 200 });
    },
  });
  const client = new LambdaDBClient({
    baseUrl: BASE_URL,
    httpClient,
    projectApiKey: "test-api-key",
    projectName: PROJECT_NAME,
    transferClient,
  });
  return { apiCalls, client, transferCalls };
}

test("exports the pinned contract revision and validated ref/source/target helpers", () => {
  assert.equal(
    DATA_VERSIONING_CONTRACT_REVISION,
    "63e07d6b2e281704aa3367fbeb94f40f519241b8",
  );
  assert.deepEqual(branchRef("candidate"), { kind: "branch", name: "candidate" });
  assert.deepEqual(tagRef("release-001"), { kind: "tag", name: "release-001" });
  assert.deepEqual(aliasRef("production"), { kind: "alias", name: "production" });
  assert.deepEqual(branchTarget("candidate"), branchRef("candidate"));
  assert.deepEqual(tagTarget("release-001"), tagRef("release-001"));
  assert.deepEqual(tagSource("release-001"), tagRef("release-001"));

  const asOf = new Date("2026-09-02T00:00:00.123Z");
  assert.deepEqual(branchSource("candidate", asOf), {
    kind: "branch",
    name: "candidate",
    asOf: 1788307200123,
  });
  assert.throws(() => aliasRef("x"), /3 to 52/);
  assert.throws(() => branchSource("candidate", Number.NaN), /integer Unix milliseconds/);
});

test("uses current Collection metadata, millisecond timestamps, and 201/200 statuses", async () => {
  const timestamp = 1788336000123;
  const { apiCalls, client } = createClient((call, index) => {
    if (index === 0) {
      return jsonResponse({
        collection: {
          collectionName: COLLECTION_NAME,
          description: "Initial",
          tags: { environment: "test" },
          defaultBranchName: "main",
          snapshotRetentionInDays: 7,
          createdAt: timestamp,
        },
      }, 201);
    }
    if (index === 1) {
      return jsonResponse({
        collection: {
          projectName: PROJECT_NAME,
          collectionName: COLLECTION_NAME,
          indexConfigs: {},
          description: "Updated",
          tags: { environment: "production" },
          numPartitions: 1,
          numDocs: 0,
          defaultBranchName: "main",
          snapshotRetentionInDays: 14,
          createdAt: timestamp,
          updatedAt: timestamp + 1,
          dataUpdatedAt: null,
        },
      });
    }
    return jsonResponse({ message: "Collection deletion requested" });
  });

  const created = await client.createCollection({
    collectionName: COLLECTION_NAME,
    indexConfigs: {},
    description: "Initial",
    tags: { environment: "test" },
    snapshotRetentionInDays: 7,
  });
  const updated = await client.collection(COLLECTION_NAME).update({
    description: "Updated",
    tags: { environment: "production" },
    snapshotRetentionInDays: 14,
  });
  const deleted = await client.collection(COLLECTION_NAME).delete();

  assert.equal(created.collection.createdAt.getTime(), timestamp);
  assert.equal(updated.collection.createdAt.getTime(), timestamp);
  assert.equal(updated.collection.updatedAt.getTime(), timestamp + 1);
  assert.equal(updated.collection.dataUpdatedAt, undefined);
  assert.equal(deleted.message, "Collection deletion requested");
  assert.deepEqual(JSON.parse(apiCalls[0].body), {
    collectionName: COLLECTION_NAME,
    indexConfigs: {},
    description: "Initial",
    tags: { environment: "test" },
    snapshotRetentionInDays: 7,
  });
});

test("rejects obsolete Collection create/delete success statuses", async () => {
  const { client } = createClient((call) => {
    if (call.method === "POST") {
      return jsonResponse({ collection: {} }, 202);
    }
    return jsonResponse({ message: "obsolete" }, 202);
  });

  const createResult = await client.createCollectionSafe({
    collectionName: COLLECTION_NAME,
    indexConfigs: {},
  });
  assert.equal(createResult.ok, false);
  assert.ok(createResult.error instanceof LambdaDBDefaultError);

  const deleteResult = await client.collection(COLLECTION_NAME).deleteSafe();
  assert.equal(deleteResult.ok, false);
  assert.ok(deleteResult.error instanceof LambdaDBDefaultError);
});

test("supports Branch, Tag, and Alias lifecycle with millisecond Date conversion", async () => {
  const createdAt = 1788336000123;
  const { apiCalls, client } = createClient((call, index) => {
    switch (index) {
      case 0:
        return jsonResponse({
          branch: { name: "candidate", snapshotId: "snap-1", createdAt },
        }, 201);
      case 1:
        return jsonResponse({
          branches: [
            { name: "main", snapshotId: "snap-0", createdAt },
            { name: "candidate", snapshotId: "snap-1", createdAt },
          ],
        });
      case 2:
        return jsonResponse({
          tag: { name: "release-001", snapshotId: "snap-1", createdAt },
        }, 201);
      case 3:
        return jsonResponse({
          alias: {
            aliasId: "alias-1",
            aliasName: "production",
            targetKind: "TAG",
            targetName: "release-001",
            targetId: "tag-1",
            aliasRevision: 0,
            dangling: false,
            createdAt,
          },
        }, 201);
      case 4:
        return jsonResponse({
          alias: {
            aliasId: "alias-1",
            aliasName: "production",
            targetKind: "BRANCH",
            targetName: "candidate",
            targetId: "branch-1",
            aliasRevision: 1,
            dangling: false,
            createdAt,
          },
        });
      case 5:
        return jsonResponse({
          aliases: [{
            aliasId: "alias-1",
            aliasName: "production",
            targetKind: "TAG",
            targetName: "removed-tag",
            targetId: "tag-removed",
            aliasRevision: 2,
            dangling: true,
            createdAt,
          }],
        });
      default:
        return jsonResponse({ message: "Ref deleted" });
    }
  });
  const collection = client.collection(COLLECTION_NAME);

  const branch = await collection.branches.create({
    branchName: "candidate",
    source: branchSource("main", createdAt),
  });
  const branches = await collection.branches.list();
  const tag = await collection.tags.create({
    tagName: "release-001",
    source: tagSource("source-tag"),
  });
  const alias = await collection.aliases.create({
    aliasName: "production",
    target: tagTarget("release-001"),
  });
  const retargeted = await collection.aliases.retarget("production", {
    target: branchTarget("candidate"),
  });
  const aliases = await collection.aliases.list();
  await collection.aliases.delete("production");
  await collection.tags.delete("release-001");
  await collection.branches.delete("candidate");

  assert.ok(branch.branch.createdAt instanceof Date);
  assert.equal(branch.branch.createdAt.getTime(), createdAt);
  assert.equal(branches.branches.length, 2);
  assert.equal(tag.tag.createdAt.getTime(), createdAt);
  assert.equal(alias.alias.targetKind, "TAG");
  assert.equal(retargeted.alias.targetKind, "BRANCH");
  assert.equal(aliases.aliases[0].dangling, true);
  assert.deepEqual(JSON.parse(apiCalls[0].body), {
    branchName: "candidate",
    source: { kind: "branch", name: "main", asOf: createdAt },
  });
  assert.deepEqual(JSON.parse(apiCalls[2].body), {
    tagName: "release-001",
    source: { kind: "tag", name: "source-tag" },
  });
  assert.deepEqual(JSON.parse(apiCalls[3].body), {
    aliasName: "production",
    target: { kind: "tag", name: "release-001" },
  });
  assert.equal(apiCalls[6].url.pathname.endsWith("/aliases/production"), true);
  assert.equal(apiCalls[7].url.pathname.endsWith("/tags/release-001"), true);
  assert.equal(apiCalls[8].url.pathname.endsWith("/branches/candidate"), true);
});

test("maps duplicate, not-found, and validation failures to concrete errors", async () => {
  const { apiCalls, client } = createClient((call, index) => {
    if (index === 0) return jsonResponse({ message: "Ref already exists" }, 409);
    if (index === 1) return jsonResponse({ message: "Alias target not found" }, 404);
    return jsonResponse({ message: "Invalid request" }, 400);
  });
  const collection = client.collection(COLLECTION_NAME);

  const duplicate = await collection.branches.createSafe({ branchName: "candidate" });
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.error instanceof ResourceAlreadyExistsError);

  const missing = await collection.aliases.retargetSafe("production", {
    target: tagTarget("missing-tag"),
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.error instanceof ResourceNotFoundError);

  const invalidConsistency = await collection.querySafe({
    query: { matchAll: {} },
    ref: aliasRef("production"),
    consistentRead: true,
  });
  assert.equal(invalidConsistency.ok, false);
  assert.ok(invalidConsistency.error instanceof SDKValidationError);

  const invalidName = await collection.tags.deleteSafe("x");
  assert.equal(invalidName.ok, false);
  assert.ok(invalidName.error instanceof SDKValidationError);
  assert.equal(apiCalls.length, 2);

  const bad = await collection.aliases.createSafe({
    aliasName: "invalid-alias",
    target: { kind: "alias", name: "not-allowed" },
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.error instanceof SDKValidationError);
  assert.equal(apiCalls.length, 2);
});

test("preserves Branch, Tag, and Alias refs across every list page", async () => {
  for (const ref of [branchRef("candidate"), tagRef("release-001"), aliasRef("production")]) {
    const { apiCalls, client } = createClient((call) => {
      const pageToken = call.url.searchParams.get("pageToken");
      return jsonResponse({
        total: 2,
        docs: [{ collection: COLLECTION_NAME, doc: { id: pageToken ?? "first" } }],
        nextPageToken: pageToken == null ? "second-page" : null,
        isDocsInline: true,
        docsUrl: null,
      });
    });

    const result = await client.collection(COLLECTION_NAME).docs.listAll({ size: 1, ref });
    assert.equal(result.docs.length, 2);
    assert.equal(apiCalls.length, 2);
    for (const call of apiCalls) {
      assert.equal(call.method, "GET");
      assert.equal(call.url.searchParams.get("refKind"), ref.kind);
      assert.equal(call.url.searchParams.get("refName"), ref.name);
    }
  }
});

test("uses extended list for filters, preserves its ref, and keeps default main reads unchanged", async () => {
  const { apiCalls, client } = createClient(() =>
    jsonResponse({
      total: 0,
      docs: [],
      nextPageToken: null,
      isDocsInline: true,
      docsUrl: null,
    })
  );
  const docs = client.collection(COLLECTION_NAME).docs;

  await docs.list();
  await docs.list({
    filter: { queryString: { query: "kind:test" } },
    ref: aliasRef("production"),
  });

  assert.equal(apiCalls[0].method, "GET");
  assert.equal(apiCalls[0].url.pathname.endsWith("/docs"), true);
  assert.equal(apiCalls[0].url.searchParams.has("refKind"), false);
  assert.equal(apiCalls[0].url.searchParams.has("refName"), false);
  assert.equal(apiCalls[1].method, "POST");
  assert.equal(apiCalls[1].url.pathname.endsWith("/docs/list"), true);
  assert.deepEqual(JSON.parse(apiCalls[1].body), {
    filter: { queryString: { query: "kind:test" } },
    includeVectors: false,
    ref: { kind: "alias", name: "production" },
  });
});

test("sends refs on query/fetch and Branch names on every write", async () => {
  const { apiCalls, client } = createClient((call) => {
    if (call.url.pathname.endsWith("/query")) {
      return jsonResponse({ took: 1, total: 0, docs: [], isDocsInline: true });
    }
    if (call.url.pathname.endsWith("/fetch")) {
      return jsonResponse({ took: 1, total: 0, docs: [], isDocsInline: true });
    }
    return jsonResponse({ message: "Accepted" }, 202);
  });
  const collection = client.collection(COLLECTION_NAME);

  await collection.query({
    query: { matchAll: {} },
    consistentRead: true,
    ref: branchRef("candidate"),
  });
  await collection.docs.fetch({ ids: ["a"], ref: tagRef("release-001") });
  await collection.docs.upsert({ docs: [{ id: "a" }], branch: "candidate" });
  await collection.docs.update({ docs: [{ id: "a", title: "Updated" }], branch: "candidate" });
  await collection.docs.delete({ ids: ["a"], branch: "candidate" });

  assert.deepEqual(JSON.parse(apiCalls[0].body).ref, { kind: "branch", name: "candidate" });
  assert.equal(JSON.parse(apiCalls[0].body).consistentRead, true);
  assert.deepEqual(JSON.parse(apiCalls[1].body).ref, { kind: "tag", name: "release-001" });
  for (const call of apiCalls.slice(2)) {
    assert.equal(JSON.parse(call.body).branch, "candidate");
  }
});

test("uses one Branch for both bulk control calls and forwards only signed transfer headers", async () => {
  const { apiCalls, client, transferCalls } = createClient((call) => {
    if (call.method === "GET") {
      return jsonResponse({
        url: "https://upload.test/object",
        type: "application/json",
        httpMethod: "PUT",
        objectKey: "object-key",
        sizeLimitBytes: 1024,
        headers: {
          "If-None-Match": "*",
          "x-amz-checksum-sha256": "signed-value",
        },
      });
    }
    return jsonResponse({ message: "Bulk upsert accepted" }, 202);
  }, () => new Response(null, { status: 200 }));

  const result = await client.collection(COLLECTION_NAME).docs.bulkUpsertDocs(
    { docs: [{ id: "a" }], branch: "candidate" },
    { headers: { "x-api-only": "do-not-forward" } },
  );

  assert.equal(result.message, "Bulk upsert accepted");
  assert.equal(apiCalls.length, 2);
  assert.equal(apiCalls[0].url.searchParams.get("branch"), "candidate");
  assert.equal(apiCalls[0].headers["x-api-key"], "test-api-key");
  assert.equal(apiCalls[0].headers["x-api-only"], "do-not-forward");
  assert.deepEqual(JSON.parse(apiCalls[1].body), {
    objectKey: "object-key",
    type: "application/json",
    branch: "candidate",
  });
  assert.equal(transferCalls.length, 1);
  assert.equal(transferCalls[0].method, "PUT");
  assert.equal(transferCalls[0].headers["content-type"], "application/json");
  assert.equal(transferCalls[0].headers["if-none-match"], "*");
  assert.equal(transferCalls[0].headers["x-amz-checksum-sha256"], "signed-value");
  assert.equal(transferCalls[0].headers["x-api-key"], undefined);
  assert.equal(transferCalls[0].headers["x-api-only"], undefined);
  assert.deepEqual(JSON.parse(transferCalls[0].body), { docs: [{ id: "a" }] });
});

test("preserves request options with an empty bulk-upload input", async () => {
  const { apiCalls, client } = createClient(() =>
    jsonResponse({
      url: "https://upload.test/object",
      type: "application/json",
      httpMethod: "PUT",
      objectKey: "object-key",
      sizeLimitBytes: 1024,
      headers: {},
    }));
  const docs = client.collection(COLLECTION_NAME).docs;

  await docs.getBulkUpsert({}, { headers: { "x-request-option": "throwing" } });
  const safeResult = await docs.getBulkUpsertSafe(
    {},
    { headers: { "x-request-option": "safe" } },
  );

  assert.equal(safeResult.ok, true);
  assert.equal(apiCalls[0].headers["x-request-option"], "throwing");
  assert.equal(apiCalls[1].headers["x-request-option"], "safe");
  assert.equal(apiCalls[0].url.searchParams.has("branch"), false);
  assert.equal(apiCalls[1].url.searchParams.has("branch"), false);
});

test("uses the separate transfer client for out-of-line downloads without API headers", async () => {
  const { client, transferCalls } = createClient(() =>
    jsonResponse({
      took: 1,
      total: 1,
      docs: [],
      isDocsInline: false,
      docsUrl: "https://download.test/query.json",
    }), () =>
    jsonResponse({
      docs: [{ collection: COLLECTION_NAME, score: 1, doc: { id: "doc-1" } }],
    }));

  const controller = new AbortController();
  const response = await client.collection(COLLECTION_NAME).query(
    { query: { matchAll: {} } },
    { headers: { "x-api-only": "do-not-forward" }, signal: controller.signal },
  );

  assert.equal(response.docs[0].doc.id, "doc-1");
  assert.equal(transferCalls.length, 1);
  assert.equal(transferCalls[0].url.href, "https://download.test/query.json");
  assert.equal(transferCalls[0].headers["x-api-key"], undefined);
  assert.equal(transferCalls[0].headers["x-api-only"], undefined);
});
