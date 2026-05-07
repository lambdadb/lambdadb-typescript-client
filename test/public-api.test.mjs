import assert from "node:assert/strict";
import test from "node:test";

import {
  BadRequestError,
  HTTPClient,
  LambdaDBClient,
  SDKValidationError,
} from "../dist/esm/index.js";

const BASE_URL = "https://api.test";
const PROJECT_NAME = "project-one";

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function collectionFixture(collectionName, overrides = {}) {
  return {
    projectName: PROJECT_NAME,
    collectionName,
    indexConfigs: {},
    numPartitions: 1,
    numDocs: 2,
    sourceProjectName: null,
    sourceCollectionName: null,
    sourceCollectionVersionId: null,
    collectionStatus: "ACTIVE",
    createdAt: 1700000000,
    updatedAt: 1700000100,
    dataUpdatedAt: 1700000200,
    ...overrides,
  };
}

function createClient(handler) {
  const calls = [];
  const httpClient = new HTTPClient({
    fetcher: async (request) => {
      const body = await request.clone().text();
      const call = {
        body,
        headers: Object.fromEntries(request.headers.entries()),
        method: request.method,
        url: new URL(request.url),
      };
      calls.push(call);
      return handler(call, calls.length - 1);
    },
  });

  const client = new LambdaDBClient({
    baseUrl: BASE_URL,
    httpClient,
    projectApiKey: "test-key",
    projectName: PROJECT_NAME,
  });

  return { calls, client };
}

test("public client lists collections with project URL, auth header, and Date conversion", async () => {
  const { calls, client } = createClient(() =>
    jsonResponse({
      collections: [collectionFixture("alpha")],
      nextPageToken: null,
    })
  );

  const result = await client.listCollections({ size: 5 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url.pathname, "/projects/project-one/collections");
  assert.equal(calls[0].url.searchParams.get("size"), "5");
  assert.equal(calls[0].headers["x-api-key"], "test-key");
  assert.equal(result.nextPageToken, undefined);
  assert.equal(result.collections[0].collectionName, "alpha");
  assert.ok(result.collections[0].createdAt instanceof Date);
  assert.equal(result.collections[0].createdAt.toISOString(), "2023-11-14T22:13:20.000Z");
});

test("public client supports managed embedding vector index configs", async () => {
  const managedIndexConfigs = {
    body: {
      type: "text",
      analyzers: ["english"],
    },
    bodyEmbedding: {
      type: "vector",
      managedEmbedding: true,
      embedding: {
        provider: "openai",
        model: "text-embedding-3-small",
        sourceField: "body",
      },
    },
  };

  const { calls, client } = createClient((call) => {
    assert.equal(call.method, "POST");
    assert.equal(call.url.pathname, "/projects/project-one/collections");
    assert.deepEqual(JSON.parse(call.body), {
      collectionName: "semantic-items",
      indexConfigs: {
        body: {
          type: "text",
          analyzers: ["english"],
        },
        bodyEmbedding: {
          type: "vector",
          managedEmbedding: true,
          embedding: {
            provider: "openai",
            model: "text-embedding-3-small",
            sourceField: "body",
          },
        },
      },
    });

    return jsonResponse(
      {
        collection: collectionFixture("semantic-items", {
          indexConfigs: {
            ...managedIndexConfigs,
            bodyEmbedding: {
              ...managedIndexConfigs.bodyEmbedding,
              embedding: {
                ...managedIndexConfigs.bodyEmbedding.embedding,
                dimensions: 1536,
                similarity: "cosine",
              },
            },
          },
        }),
      },
      { status: 202 },
    );
  });

  const result = await client.createCollection({
    collectionName: "semantic-items",
    indexConfigs: managedIndexConfigs,
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(
    result.collection.indexConfigs.bodyEmbedding.embedding,
    {
      ...managedIndexConfigs.bodyEmbedding.embedding,
      dimensions: 1536,
      similarity: "cosine",
    },
  );
});

test("managed embedding vector config supports optional embedding dimensions and similarity", async () => {
  const { calls, client } = createClient((call) => {
    assert.equal(call.method, "POST");
    assert.deepEqual(JSON.parse(call.body), {
      collectionName: "semantic-items",
      indexConfigs: {
        bodyEmbedding: {
          type: "vector",
          managedEmbedding: true,
          embedding: {
            provider: "openai",
            model: "text-embedding-3-small",
            sourceField: "body",
            dimensions: 1536,
            similarity: "cosine",
          },
        },
      },
    });

    return jsonResponse(
      {
        collection: collectionFixture("semantic-items", {
          indexConfigs: {
            bodyEmbedding: {
              type: "vector",
              managedEmbedding: true,
              embedding: {
                provider: "openai",
                model: "text-embedding-3-small",
                sourceField: "body",
                dimensions: 1536,
                similarity: "cosine",
              },
            },
          },
        }),
      },
      { status: 202 },
    );
  });

  const result = await client.createCollection({
    collectionName: "semantic-items",
    indexConfigs: {
      bodyEmbedding: {
        type: "vector",
        managedEmbedding: true,
        embedding: {
          provider: "openai",
          model: "text-embedding-3-small",
          sourceField: "body",
          dimensions: 1536,
          similarity: "cosine",
        },
      },
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(
    result.collection.indexConfigs.bodyEmbedding.embedding.dimensions,
    1536,
  );
});

test("managed embedding vector config rejects invalid Java contract shapes", async () => {
  const { calls, client } = createClient(() => {
    throw new Error("request should not be sent for invalid index configs");
  });

  const invalidIndexConfigs = [
    {
      type: "vector",
      dimensions: 1536,
      embedding: {
        provider: "openai",
        model: "text-embedding-3-small",
        sourceField: "body",
      },
    },
    {
      type: "vector",
      managedEmbedding: false,
      dimensions: 1536,
      embedding: {
        provider: "openai",
        model: "text-embedding-3-small",
        sourceField: "body",
      },
    },
    {
      type: "vector",
      managedEmbedding: true,
      dimensions: 1536,
      embedding: {
        provider: "openai",
        model: "text-embedding-3-small",
        sourceField: "body",
      },
    },
    {
      type: "vector",
      managedEmbedding: true,
      similarity: "cosine",
      embedding: {
        provider: "openai",
        model: "text-embedding-3-small",
        sourceField: "body",
      },
    },
    {
      type: "vector",
      managedEmbedding: true,
    },
    {
      type: "vector",
      managedEmbedding: true,
      embedding: {
        provider: "openai",
        model: "text-embedding-3-small",
        sourceField: "body",
        unsupported: true,
      },
    },
  ];

  for (const indexConfig of invalidIndexConfigs) {
    const result = await client.createCollectionSafe({
      collectionName: "invalid-vector",
      indexConfigs: { bodyEmbedding: indexConfig },
    });

    assert.equal(result.ok, false);
    assert.ok(result.error instanceof SDKValidationError);
  }

  assert.equal(calls.length, 0);
});

test("collection query supports managed embedding queryText KNN payloads", async () => {
  const { calls, client } = createClient((call) => {
    assert.equal(call.method, "POST");
    assert.equal(call.url.pathname, "/projects/project-one/collections/items/query");
    assert.deepEqual(JSON.parse(call.body), {
      size: 10,
      query: {
        knn: {
          field: "bodyEmbedding",
          queryText: "refund policy",
          k: 10,
        },
      },
      consistentRead: false,
      includeVectors: false,
    });

    return jsonResponse({
      took: 3,
      maxScore: 0.98,
      total: 1,
      docs: [{ collection: "items", score: 0.98, doc: { id: "a" } }],
      isDocsInline: true,
      docsUrl: null,
    });
  });

  const result = await client.collection("items").query({
    size: 10,
    query: {
      knn: {
        field: "bodyEmbedding",
        queryText: "refund policy",
        k: 10,
      },
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(result.total, 1);
});

test("getBulkUpsertSafe exposes managed embedding unsupported bad requests", async () => {
  const { client } = createClient((call) => {
    assert.equal(call.method, "GET");
    assert.equal(call.url.pathname, "/projects/project-one/collections/items/docs/bulk-upsert");

    return jsonResponse(
      { message: "Bulk upsert is not supported for collections with managed embedding fields" },
      { status: 400 },
    );
  });

  const result = await client.collection("items").docs.getBulkUpsertSafe();

  assert.equal(result.ok, false);
  assert.ok(result.error instanceof BadRequestError);
  assert.equal(
    result.error.data$.message,
    "Bulk upsert is not supported for collections with managed embedding fields",
  );
});

test("public pagination helpers collect all collection pages", async () => {
  const { calls, client } = createClient((call, index) => {
    if (index === 0) {
      return jsonResponse({
        collections: [collectionFixture("alpha")],
        nextPageToken: "next-page",
      });
    }

    assert.equal(call.url.searchParams.get("pageToken"), "next-page");
    return jsonResponse({
      collections: [collectionFixture("beta")],
      nextPageToken: null,
    });
  });

  const result = await client.listAllCollections({ size: 1 });

  assert.equal(calls.length, 2);
  assert.deepEqual(
    result.collections.map((collection) => collection.collectionName),
    ["alpha", "beta"],
  );
});

test("collection docs helpers paginate through the user-facing scoped API", async () => {
  const { calls, client } = createClient((call, index) => {
    assert.equal(call.method, "GET");
    assert.equal(call.url.pathname, "/projects/project-one/collections/items/docs");

    if (index === 0) {
      return jsonResponse({
        total: 2,
        docs: [{ collection: "items", doc: { id: "a" } }],
        nextPageToken: "docs-page-2",
        isDocsInline: true,
        docsUrl: null,
      });
    }

    assert.equal(call.url.searchParams.get("pageToken"), "docs-page-2");
    return jsonResponse({
      total: 2,
      docs: [{ collection: "items", doc: { id: "b" } }],
      nextPageToken: null,
      isDocsInline: true,
      docsUrl: null,
    });
  });

  const result = await client.collection("items").docs.listAll({ size: 1 });

  assert.equal(calls.length, 2);
  assert.equal(result.total, 2);
  assert.deepEqual(result.docs, [
    { collection: "items", doc: { id: "a" } },
    { collection: "items", doc: { id: "b" } },
  ]);
});

test("collection query fetches docsUrl and returns inline docs through the public API", async () => {
  const originalFetch = globalThis.fetch;
  const docsUrlCalls = [];
  globalThis.fetch = async (input) => {
    docsUrlCalls.push(String(input));
    return jsonResponse({
      docs: [{ collection: "items", score: 0.9, doc: { id: "a" } }],
    });
  };

  try {
    const { calls, client } = createClient((call) => {
      assert.equal(call.method, "POST");
      assert.equal(call.url.pathname, "/projects/project-one/collections/items/query");
      assert.deepEqual(JSON.parse(call.body), {
        query: { text: "hello" },
        consistentRead: false,
        includeVectors: false,
      });

      return jsonResponse({
        took: 7,
        maxScore: null,
        total: 1,
        docs: [],
        isDocsInline: false,
        docsUrl: "https://download.test/query-docs.json",
      });
    });

    const result = await client.collection("items").querySafe({
      query: { text: "hello" },
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(docsUrlCalls, ["https://download.test/query-docs.json"]);
    assert.equal(result.ok, true);
    assert.equal(result.value.isDocsInline, true);
    assert.deepEqual(result.value.docs, [
      { collection: "items", score: 0.9, doc: { id: "a" } },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public safe methods expose typed API errors", async () => {
  const { client } = createClient((call) => {
    assert.equal(call.method, "POST");
    assert.equal(call.url.pathname, "/projects/project-one/collections");

    return jsonResponse(
      { message: null },
      { status: 400 },
    );
  });

  const result = await client.createCollectionSafe({ collectionName: "items" });

  assert.equal(result.ok, false);
  assert.ok(result.error instanceof BadRequestError);
  assert.equal(result.error.statusCode, 400);
  assert.equal(result.error.body, "{\"message\":null}");
  assert.equal(result.error.data$.message, undefined);
});
