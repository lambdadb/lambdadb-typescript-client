import assert from "node:assert/strict";
import test from "node:test";

import {
  HTTPClient,
  LambdaDBClient,
  ResponseValidationError,
  SDKValidationError,
} from "../dist/esm/index.js";
import {
  IndexConfigsUnion$inboundSchema,
  IndexConfigsUnion$outboundSchema,
} from "../dist/esm/models/indexconfigsunion.js";

// Contract: lambdadb/docs reference/api/openapi.json (FieldDescription).
const DESCRIPTION = "Book title as printed on the cover";
const NO_RETRIES = { retries: { strategy: "none" } };

const variants = {
  text: { type: "text", analyzers: ["english"] },
  vector: { type: "vector", dimensions: 128, similarity: "cosine" },
  managed: {
    type: "vector",
    managedEmbedding: true,
    embedding: { provider: "openai", model: "text-embedding-3-small", sourceField: "body" },
  },
  native: {
    type: "vector",
    embedding: { provider: "openai", model: "text-embedding-3-small", sources: [{ field: "body", type: "text" }] },
  },
  keyword: { type: "keyword" },
  long: { type: "long" },
  double: { type: "double" },
  datetime: { type: "datetime" },
  boolean: { type: "boolean" },
  sparseVector: { type: "sparseVector" },
  object: {
    type: "object",
    objectIndexConfigs: {
      isbn: { type: "keyword", description: "ISBN-13" },
      meta: { type: "object", objectIndexConfigs: { pages: { type: "long", description: "Page count" } } },
    },
  },
};

function collectionFixture(indexConfigs) {
  return {
    projectName: "project-one",
    collectionName: "books",
    indexConfigs,
    description: "",
    tags: {},
    numPartitions: 1,
    numDocs: 0,
    defaultBranchName: "main",
    snapshotRetentionInDays: 30,
    createdAt: 1,
    updatedAt: 1,
  };
}

function createClient(handler) {
  const calls = [];
  const client = new LambdaDBClient({
    baseUrl: "https://api.test",
    projectName: "project-one",
    projectApiKey: "test-key",
    httpClient: new HTTPClient({
      fetcher: async (request) => {
        const call = { method: request.method, body: await request.clone().text() };
        calls.push(call);
        return handler(call);
      },
    }),
  });
  return { client, calls };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("description round-trips through outbound and inbound schemas for every variant", () => {
  for (const [name, config] of Object.entries(variants)) {
    const withDescription = { ...config, description: DESCRIPTION };
    const wire = IndexConfigsUnion$outboundSchema.parse(withDescription);
    assert.equal(wire.description, DESCRIPTION, name);
    const parsed = IndexConfigsUnion$inboundSchema.parse(JSON.parse(JSON.stringify(wire)));
    assert.equal(parsed.description, DESCRIPTION, name);
    if (name === "object") {
      assert.equal(parsed.objectIndexConfigs.isbn.description, "ISBN-13");
      assert.equal(parsed.objectIndexConfigs.meta.objectIndexConfigs.pages.description, "Page count");
    }
  }
});

test("an omitted description produces no key on the wire or in parsed reads", () => {
  for (const [name, config] of Object.entries(variants)) {
    const wire = IndexConfigsUnion$outboundSchema.parse(config);
    assert.equal(Object.hasOwn(wire, "description"), false, name);
    assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(wire)), "description"), false, name);
    const parsed = IndexConfigsUnion$inboundSchema.parse(config);
    assert.equal(Object.hasOwn(parsed, "description"), false, name);
  }
});

test("null and empty descriptions are sent unchanged so PATCH can keep or clear them", () => {
  for (const [name, config] of Object.entries(variants)) {
    assert.equal(IndexConfigsUnion$outboundSchema.parse({ ...config, description: null }).description, null, name);
    assert.equal(IndexConfigsUnion$outboundSchema.parse({ ...config, description: "" }).description, "", name);
  }
});

test("descriptions longer than 255 characters fail locally", () => {
  for (const [name, config] of Object.entries(variants)) {
    assert.ok(IndexConfigsUnion$outboundSchema.safeParse({ ...config, description: "x".repeat(255) }).success, name);
    assert.equal(
      IndexConfigsUnion$outboundSchema.safeParse({ ...config, description: "x".repeat(256) }).success,
      false,
      name,
    );
  }
});

test("inbound null descriptions normalize to undefined like other optional settings", () => {
  for (const [name, config] of Object.entries(variants)) {
    const parsed = IndexConfigsUnion$inboundSchema.parse({ ...config, description: null });
    assert.equal(parsed.description, undefined, name);
  }
});

test("create and update send nested descriptions and omit absent ones; reads return them", async () => {
  const indexConfigs = {
    title: { type: "text", analyzers: ["english"], description: DESCRIPTION },
    isbn: { type: "keyword" },
    details: {
      type: "object",
      description: "Publisher details",
      objectIndexConfigs: { pages: { type: "long", description: "Page count" }, publisher: { type: "keyword" } },
    },
  };
  const stored = { id: { type: "keyword" }, ...indexConfigs };
  const { calls, client } = createClient((call) => {
    if (call.method === "POST") {
      return jsonResponse({ collection: {
        collectionName: "books", description: "", tags: {}, defaultBranchName: "main",
        snapshotRetentionInDays: 30, createdAt: 1,
      } }, 201);
    }
    return jsonResponse({ collection: collectionFixture(stored) });
  });

  await client.createCollection({ collectionName: "books", indexConfigs }, NO_RETRIES);
  const collection = client.collection("books");
  await collection.update({ indexConfigs: { ...indexConfigs, title: { ...indexConfigs.title, description: "" } } });
  const result = await collection.get();

  assert.equal(calls.length, 3);
  const created = JSON.parse(calls[0].body).indexConfigs;
  assert.deepEqual(created, indexConfigs);
  assert.equal(Object.hasOwn(created.isbn, "description"), false);
  assert.equal(Object.hasOwn(created.details.objectIndexConfigs.publisher, "description"), false);
  const patched = JSON.parse(calls[1].body).indexConfigs;
  assert.equal(patched.title.description, "");
  assert.equal(patched.details.objectIndexConfigs.pages.description, "Page count");
  assert.deepEqual(result.collection.indexConfigs, stored);
  assert.equal(result.collection.indexConfigs.title.description, DESCRIPTION);
  assert.equal(Object.hasOwn(result.collection.indexConfigs.id, "description"), false);
});

test("an over-long description is rejected before any request, and a malformed read fails validation", async () => {
  const { calls, client } = createClient(() =>
    jsonResponse({ collection: collectionFixture({ title: { type: "text", description: 7 } }) }));
  const result = await client.createCollectionSafe({
    collectionName: "books",
    indexConfigs: { title: { type: "text", description: "x".repeat(256) } },
  }, NO_RETRIES);
  assert.equal(result.ok, false);
  assert.ok(result.error instanceof SDKValidationError);
  assert.equal(calls.length, 0);

  const read = await client.collection("books").getSafe(NO_RETRIES);
  assert.equal(read.ok, false);
  assert.ok(read.error instanceof ResponseValidationError);
});
