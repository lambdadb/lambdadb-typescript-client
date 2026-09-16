import assert from "node:assert/strict";
import test from "node:test";

import {
  BadRequestError,
  ConnectionError,
  CatalogConflictError,
  ResponseValidationError,
  DATA_VERSIONING_CONTRACT_REVISION,
  HTTPClient,
  LambdaDBClient,
  LambdaDBDefaultError,
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
  RequestAbortedError,
  RequestTimeoutError,
  SDKValidationError,
  UnexpectedClientError,
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

function responseWithBodyError(error, status = 200) {
  return new Response(new ReadableStream({
    start(controller) {
      controller.error(error);
    },
  }), {
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
    "c44180406c05b1a9043d8516e7c7f60df91fc9a7",
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
          indexConfigs: { title: { type: "text" } },
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
    indexConfigs: { title: { type: "text" } },
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
    indexConfigs: { title: { type: "text" } },
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
    indexConfigs: { title: { type: "text" } },
  });
  assert.equal(createResult.ok, false);
  assert.ok(createResult.error instanceof LambdaDBDefaultError);

  const deleteResult = await client.collection(COLLECTION_NAME).deleteSafe();
  assert.equal(deleteResult.ok, false);
  assert.ok(deleteResult.error instanceof LambdaDBDefaultError);
});

test("supports Branch, Tag, and Alias lifecycle with millisecond Date conversion", async () => {
  const createdAt = 1788336000123;
  const snapshot = { snapshotId: "snap-1", snapshotCommittedAt: createdAt - 1000 };
  const { apiCalls, client } = createClient((call, index) => {
    switch (index) {
      case 0:
        return jsonResponse({
          branch: { name: "candidate", parentBranch: { branchId: "main-id", name: "main" }, headSnapshot: snapshot, parentSnapshot: snapshot, createdAt },
        }, 201);
      case 1:
        return jsonResponse({
          branches: [
            { name: "main", parentBranch: null, headSnapshot: snapshot, parentSnapshot: null, createdAt },
            { name: "candidate", parentBranch: { branchId: "main-id", name: "main" }, headSnapshot: snapshot, parentSnapshot: snapshot, createdAt },
          ],
        });
      case 2:
        return jsonResponse({
          tag: { name: "release-001", ...snapshot, createdAt },
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
  assert.equal(branch.branch.headSnapshot.snapshotCommittedAt.getTime(), createdAt - 1000);
  assert.deepEqual(branch.branch.headSnapshot, branch.branch.parentSnapshot);
  assert.equal(branches.branches.length, 2);
  assert.equal(branches.branches[0].parentSnapshot, null);
  assert.equal(branches.branches[0].headSnapshot.snapshotCommittedAt.getTime(), createdAt - 1000);
  assert.equal(tag.tag.snapshotCommittedAt.getTime(), createdAt - 1000);
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

test("Branch creation accepts only Branch sources; Tag creation retains Branch and Tag sources", async () => {
  const asOf = 1788336000123;
  const sources = [
    undefined,
    branchSource("main"),
    branchSource("dev", asOf),
    branchSource("dev", new Date(asOf)),
    tagSource("release-001"),
    aliasRef("production"),
    { kind: "tag", name: "release-001", asOf },
    { kind: "branch", name: "main", asOf: 1.5 },
    { kind: "branch", name: "main", asOf: null },
    { kind: "branch", name: "main", extra: true },
    {},
    null,
  ];
  for (const resource of ["branches", "tags"]) {
    for (const [index, source] of sources.entries()) {
      const allowed = index < 4 || (resource === "tags" && index === 4);
      const singular = resource === "branches" ? "branch" : "tag";
      const input = { [`${singular}Name`]: "candidate", ...(source === undefined ? {} : { source }) };
      const parentBranch = { branchId: "direct-source-id", name: source?.name ?? "main" };
      // The snapshot may originate on main while the direct requested source is dev.
      const snapshot = { snapshotId: "main-snapshot", snapshotCommittedAt: asOf - 1 };
      const details = resource === "branches"
        ? { name: "candidate", parentBranch, headSnapshot: snapshot, parentSnapshot: snapshot, createdAt: asOf }
        : { name: "candidate", ...snapshot, createdAt: asOf };
      const { apiCalls, client } = createClient(() => jsonResponse({ [singular]: details }, 201));
      const refs = client.collection(COLLECTION_NAME)[resource];
      const safe = await refs.createSafe(input);
      assert.equal(safe.ok, allowed, `${resource}: ${JSON.stringify(source)}`);
      if (allowed) {
        const response = await refs.create(input);
        assert.deepEqual(response, safe.value);
        if (resource === "branches") assert.deepEqual(response.branch.parentBranch, parentBranch);
        assert.equal(apiCalls.length, 2);
        for (const call of apiCalls) assert.deepEqual(JSON.parse(call.body), input);
      } else {
        assert.ok(safe.error instanceof SDKValidationError);
        await assert.rejects(refs.create(input), SDKValidationError);
        assert.equal(apiCalls.length, 0);
      }
    }
  }
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

test("distinguishes dangling Alias reads from missing refs", async () => {
  const { client } = createClient((_call, index) =>
    index === 0
      ? jsonResponse({ message: "Alias target is dangling" }, 400)
      : jsonResponse({ message: "Ref not found" }, 404)
  );
  const collection = client.collection(COLLECTION_NAME);

  const dangling = await collection.docs.fetchSafe({
    ids: ["doc-1"],
    ref: aliasRef("production"),
  });
  assert.equal(dangling.ok, false);
  assert.ok(dangling.error instanceof BadRequestError);

  const missing = await collection.docs.fetchSafe({
    ids: ["doc-1"],
    ref: aliasRef("missing-alias"),
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.error instanceof ResourceNotFoundError);
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

test("safe bulk upload returns serialization failures as Result errors", async () => {
  const { apiCalls, client, transferCalls } = createClient(() =>
    jsonResponse({
      url: "https://upload.test/object",
      type: "application/json",
      httpMethod: "PUT",
      objectKey: "object-key",
      sizeLimitBytes: 1024,
      headers: {},
    }));

  const result = await client.collection(COLLECTION_NAME).docs.bulkUpsertDocsSafe({
    docs: [{ id: "a", unsupported: 1n }],
  });

  assert.equal(result.ok, false);
  assert.ok(result.error instanceof UnexpectedClientError);
  assert.match(result.error.message, /serialize bulk upsert payload/);
  assert.equal(apiCalls.length, 1);
  assert.equal(transferCalls.length, 0);
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

test("preserves transfer abort, timeout, and connection error classes", async () => {
  const cases = [
    [new DOMException("cancelled", "AbortError"), RequestAbortedError],
    [new DOMException("timed out", "TimeoutError"), RequestTimeoutError],
    [new TypeError("fetch failed"), ConnectionError],
  ];

  for (const [transferError, ExpectedError] of cases) {
    const { client } = createClient(() =>
      jsonResponse({
        took: 1,
        total: 1,
        docs: [],
        isDocsInline: false,
        docsUrl: "https://download.test/query.json",
      }), () => {
      throw transferError;
    });

    const result = await client.collection(COLLECTION_NAME).querySafe({
      query: { matchAll: {} },
    });
    assert.equal(result.ok, false);
    assert.ok(result.error instanceof ExpectedError);
    assert.equal(result.error.cause, transferError);
  }
});

test("classifies transfer errors raised while reading download bodies", async () => {
  const transferError = new DOMException("timed out", "TimeoutError");
  const { client } = createClient(() =>
    jsonResponse({
      took: 1,
      total: 1,
      docs: [],
      isDocsInline: false,
      docsUrl: "https://download.test/query.json",
    }), () => responseWithBodyError(transferError));

  const result = await client.collection(COLLECTION_NAME).querySafe({
    query: { matchAll: {} },
  });

  assert.equal(result.ok, false);
  assert.ok(result.error instanceof RequestTimeoutError);
  assert.equal(result.error.cause, transferError);
});

test("preserves classified transfer errors for safe bulk uploads", async () => {
  const transferError = new DOMException("timed out", "TimeoutError");
  const { client } = createClient(() =>
    jsonResponse({
      url: "https://upload.test/object",
      type: "application/json",
      httpMethod: "PUT",
      objectKey: "object-key",
      sizeLimitBytes: 1024,
      headers: {},
    }), () => {
    throw transferError;
  });

  const result = await client.collection(COLLECTION_NAME).docs.bulkUpsertDocsSafe({
    docs: [{ id: "a" }],
  });

  assert.equal(result.ok, false);
  assert.ok(result.error instanceof RequestTimeoutError);
  assert.equal(result.error.cause, transferError);
});

test("classifies body errors from failed safe bulk upload responses", async () => {
  const transferError = new DOMException("cancelled", "AbortError");
  const { client } = createClient(() =>
    jsonResponse({
      url: "https://upload.test/object",
      type: "application/json",
      httpMethod: "PUT",
      objectKey: "object-key",
      sizeLimitBytes: 1024,
      headers: {},
    }), () => responseWithBodyError(transferError, 500));

  const result = await client.collection(COLLECTION_NAME).docs.bulkUpsertDocsSafe({
    docs: [{ id: "a" }],
  });

  assert.equal(result.ok, false);
  assert.ok(result.error instanceof RequestAbortedError);
  assert.equal(result.error.cause, transferError);
});

test("preserves parent Branch identity, empty heads, and fork snapshots across ordinary and Safe create/list", async () => {
  const parent = { snapshotId: "fork", snapshotCommittedAt: 1788335940123 };
  const head = { snapshotId: "head", snapshotCommittedAt: 1788336060456 };
  const createdAt = 1788336000789;
  const branches = [
    { name: "empty", parentBranch: { branchId: "main-id", name: "main" }, headSnapshot: null, parentSnapshot: null, createdAt },
    { name: "main", parentBranch: null, headSnapshot: head, parentSnapshot: null, createdAt },
    { name: "empty-source", parentBranch: { branchId: "empty-id", name: "empty" }, headSnapshot: head, parentSnapshot: null, createdAt },
    { name: "candidate", parentBranch: { branchId: "dev-original-id", name: "dev" }, headSnapshot: head, parentSnapshot: parent, createdAt },
    { name: "legacy", parentBranch: null, headSnapshot: head, parentSnapshot: parent, createdAt },
  ];
  const tag = { name: "release-001", ...parent, createdAt };
  const { client } = createClient((call) => {
    if (call.url.pathname.endsWith("/tags")) {
      return call.method === "POST"
        ? jsonResponse({ tag }, 201)
        : jsonResponse({ tags: [tag] });
    }
    return call.method === "POST"
      ? jsonResponse({ branch: branches.find((item) => item.name === JSON.parse(call.body).branchName) }, 201)
      : jsonResponse({ branches });
  });
  const collection = client.collection(COLLECTION_NAME);
  const listed = await collection.branches.list();
  const listedSafe = await collection.branches.listSafe();
  assert.equal(listedSafe.ok, true);
  assert.deepEqual(listedSafe.value, listed);
  for (const [index, wire] of branches.entries()) {
    const { branch } = await collection.branches.create({ branchName: wire.name });
    const safe = await collection.branches.createSafe({ branchName: wire.name });
    assert.equal(safe.ok, true);
    assert.deepEqual(safe.value.branch, branch);
    assert.deepEqual(branch, listed.branches[index]);
    assert.deepEqual(branch.parentBranch, wire.parentBranch);
    assert.equal(branch.createdAt.getTime(), createdAt);
    for (const key of ["headSnapshot", "parentSnapshot"]) {
      assert.deepEqual(branch[key], wire[key] === null ? null : {
        snapshotId: wire[key].snapshotId,
        snapshotCommittedAt: new Date(wire[key].snapshotCommittedAt),
      });
    }
    assert.equal("snapshotId" in branch, false);
  }
  const created = await collection.tags.create({ tagName: tag.name });
  const tags = await collection.tags.list();
  assert.deepEqual(created.tag, tags.tags[0]);
  assert.equal(created.tag.snapshotId, parent.snapshotId);
  assert.equal(created.tag.snapshotCommittedAt.getTime(), parent.snapshotCommittedAt);
  assert.equal(created.tag.createdAt.getTime(), createdAt);
});

test("rejects obsolete or incomplete Branch and Tag responses on create and list", async () => {
  const snapshot = { snapshotId: "snap-1", snapshotCommittedAt: 1788335940000 };
  const branch = { name: "candidate", parentBranch: { branchId: "main-id", name: "main" }, headSnapshot: snapshot, parentSnapshot: null, createdAt: 1788336000000 };
  const tag = { name: "release-001", ...snapshot, createdAt: branch.createdAt };
  for (const [resource, singular, input, invalidDetails] of [
    ["branches", "branch", { branchName: branch.name }, [
      { name: branch.name, snapshotId: "old", createdAt: branch.createdAt },
      { ...branch, headSnapshot: undefined },
      { ...branch, parentSnapshot: undefined },
      { ...branch, parentBranch: undefined },
      ...[{}, { branchId: "main-id" }, { name: "main" },
        { branchId: 1, name: "main" }, { branchId: "main-id", name: null },
        "main", []].map((parentBranch) => ({ ...branch, parentBranch })),
      { ...branch, headSnapshot: { snapshotId: "missing-time" } },
      { ...branch, parentSnapshot: { ...snapshot, snapshotCommittedAt: 1.5 } },
    ]],
    ["tags", "tag", { tagName: tag.name }, [
      { ...tag, snapshotCommittedAt: undefined },
      { ...tag, snapshotId: null },
      { ...tag, snapshotCommittedAt: null },
    ]],
  ]) {
    for (const details of invalidDetails) {
      const { client } = createClient((call) => call.method === "POST"
        ? jsonResponse({ [singular]: details }, 201)
        : jsonResponse({ [resource]: [details] }));
      const refs = client.collection(COLLECTION_NAME)[resource];
      await assert.rejects(refs.create(input), ResponseValidationError);
      await assert.rejects(refs.list(), ResponseValidationError);
      for (const result of [await refs.createSafe(input), await refs.listSafe()]) {
        assert.equal(result.ok, false);
        assert.ok(result.error instanceof ResponseValidationError);
      }
    }
  }
});

test("returns referenced-target deletion conflicts without automatic retries", async () => {
  for (const resource of ["branches", "tags"]) {
    const message = "Target is referenced by an alias; delete or retarget the alias first";
    const { apiCalls, client } = createClient(() => jsonResponse({ message }, 409));
    const refs = client.collection(COLLECTION_NAME)[resource];
    const result = await refs.deleteSafe("candidate");
    assert.equal(result.ok, false);
    assert.ok(result.error instanceof CatalogConflictError);
    assert.equal(result.error.statusCode, 409);
    assert.equal(result.error.data$.message, message);
    assert.equal(apiCalls.length, 1);
    await assert.rejects(refs.delete("candidate"), CatalogConflictError);
    assert.equal(apiCalls.length, 2);
  }
});

test("Query and Fetch allow consistent reads only for implicit main or a direct Branch", async () => {
  for (const operation of ["query", "fetch"]) {
    for (const ref of [undefined, branchRef("candidate"), tagRef("release-001"), aliasRef("production")]) {
      for (const consistentRead of [undefined, false, true]) {
        const { apiCalls, client } = createClient(() =>
          jsonResponse({ took: 0, total: 0, docs: [], isDocsInline: true }));
        const collection = client.collection(COLLECTION_NAME);
        const input = { ref, consistentRead };
        const result = operation === "query"
          ? await collection.querySafe({ query: { matchAll: {} }, ...input })
          : await collection.docs.fetchSafe({ ids: ["doc-1"], ...input });
        const allowed = consistentRead !== true || ref === undefined || ref.kind === "branch";
        assert.equal(result.ok, allowed);
        assert.equal(apiCalls.length, allowed ? 1 : 0);
        if (!allowed) assert.ok(result.error instanceof SDKValidationError);
      }
    }
  }
});
