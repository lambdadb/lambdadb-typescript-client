import assert from "node:assert/strict";
import test from "node:test";

import {
  QdrantClient,
  QdrantCompatClient,
  QdrantCompatValidationError,
  UnsupportedQdrantFeatureError,
  models,
} from "../dist/esm/compat/qdrant.js";
import { PointStruct } from "../dist/esm/compat/qdrant/models.js";
import { HTTPClient } from "../dist/esm/index.js";

class FakeDocs {
  constructor() {
    this.upserts = [];
    this.deletes = [];
    this.fetches = [];
    this.lists = [];
  }

  async upsert(body) {
    this.upserts.push(body);
    return { message: "ok" };
  }

  async fetch(body) {
    this.fetches.push(body);
    return {
      docs: [
        {
          collection: "docs",
          doc: {
            id: "1",
            _qdrant_id: 1,
            _qdrant_vector: [0.1, 0.2],
            tenant: "acme",
          },
        },
      ],
    };
  }

  async delete(body) {
    this.deletes.push(body);
    return { message: "ok" };
  }

  async list(body = {}) {
    this.lists.push(body);
    return {
      docs: [
        {
          collection: "docs",
          doc: {
            id: "1",
            _qdrant_id: 1,
            _qdrant_vector: [0.1, 0.2],
            _qdrant_vector_title: [0.3, 0.4],
            tenant: "acme",
          },
        },
      ],
      nextPageToken: "next-token",
    };
  }
}

class FakeCollection {
  constructor(owner, name) {
    this.owner = owner;
    this.name = name;
    this.docs = new FakeDocs();
    this.queries = [];
    this.updates = [];
    this.deletes = [];
  }

  async get() {
    this.owner.gets.push({ collectionName: this.name });
    return {
      collection: {
        collectionName: this.name,
        indexConfigs: this.owner.indexConfigs,
        numDocs: this.owner.numDocs,
      },
    };
  }

  async update(body) {
    this.updates.push(body);
    this.owner.indexConfigs = body.indexConfigs;
    return { collection: { collectionName: this.name, indexConfigs: body.indexConfigs } };
  }

  async delete() {
    this.deletes.push({});
    return { message: "ok" };
  }

  async query(body) {
    this.queries.push(body);
    return {
      docs: [
        {
          collection: this.name,
          score: 0.9,
          doc: {
            id: "1",
            _qdrant_id: 1,
            _qdrant_vector: [0.1, 0.2],
            tenant: "acme",
          },
        },
      ],
    };
  }
}

class FakeLambdaDB {
  constructor() {
    this.created = [];
    this.gets = [];
    this.indexConfigs = {};
    this.numDocs = 0;
    this.collectionsByName = new Map();
  }

  async createCollection(body) {
    this.created.push(body);
    this.indexConfigs = body.indexConfigs ?? {};
    return { collection: { collectionName: body.collectionName } };
  }

  collection(name) {
    if (!this.collectionsByName.has(name)) {
      this.collectionsByName.set(name, new FakeCollection(this, name));
    }
    return this.collectionsByName.get(name);
  }
}

test("qdrant compatibility exports public client and models", () => {
  assert.equal(QdrantClient, QdrantCompatClient);
  assert.equal(models.PointStruct, PointStruct);

  const point = new models.PointStruct({
    id: 1,
    vector: [0.1, 0.2],
    payload: { tenant: "acme" },
  });
  assert.equal(point.id, 1);
});

test("constructor forwards the transfer client for out-of-line query results", async () => {
  const transferRequests = [];
  const client = new QdrantCompatClient({
    baseUrl: "https://api.test",
    projectName: "project-one",
    httpClient: new HTTPClient({
      fetcher: async () => new Response(JSON.stringify({
        took: 1,
        total: 1,
        docs: [],
        isDocsInline: false,
        docsUrl: "https://download.test/qdrant-query.json",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    }),
    transferClient: new HTTPClient({
      fetcher: async (request) => {
        transferRequests.push(request);
        return new Response(JSON.stringify({
          docs: [{
            collection: "docs",
            score: 0.9,
            doc: {
              id: "1",
              _qdrant_id: 1,
              _qdrant_vector: [0.1, 0.2],
              tenant: "acme",
            },
          }],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    }),
  });

  const response = await client.queryPoints("docs", {
    query: [0.1, 0.2],
    limit: 1,
  });

  assert.equal(response.points[0].id, 1);
  assert.equal(transferRequests.length, 1);
  assert.equal(
    transferRequests[0].url,
    "https://download.test/qdrant-query.json",
  );
});

test("createCollection maps vector params and payload schema", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);

  assert.equal(
    await client.createCollection("docs", {
      vectorsConfig: new models.VectorParams({
        size: 3,
        distance: models.Distance.DOT,
      }),
      payloadSchema: {
        tenant: models.PayloadSchemaType.KEYWORD,
        views: models.PayloadSchemaType.INTEGER,
        score: models.PayloadSchemaType.FLOAT,
        active: models.PayloadSchemaType.BOOL,
      },
    }),
    true,
  );

  assert.deepEqual(fake.created, [
    {
      collectionName: "docs",
      indexConfigs: {
        _qdrant_vector: {
          type: "vector",
          dimensions: 3,
          similarity: "dot_product",
        },
        tenant: { type: "keyword" },
        views: { type: "long" },
        score: { type: "double" },
        active: { type: "boolean" },
      },
    },
  ]);
});

test("createPayloadIndex merges existing configs and rejects non-empty backfill", async () => {
  const fake = new FakeLambdaDB();
  fake.indexConfigs = {
    _qdrant_vector: {
      type: "vector",
      dimensions: 3,
      similarity: "cosine",
    },
  };
  const client = new QdrantCompatClient(fake);

  assert.equal(
    await client.createPayloadIndex(
      "docs",
      "tenant",
      models.PayloadSchemaType.KEYWORD,
    ),
    true,
  );

  assert.deepEqual(fake.collection("docs").updates, [
    {
      indexConfigs: {
        _qdrant_vector: {
          type: "vector",
          dimensions: 3,
          similarity: "cosine",
        },
        tenant: { type: "keyword" },
      },
    },
  ]);

  fake.numDocs = 3;
  await assert.rejects(
    client.createPayloadIndex("docs", "views", models.PayloadSchemaType.INTEGER),
    UnsupportedQdrantFeatureError,
  );
});

test("upsert maps qdrant points to LambdaDB documents", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);

  const result = await client.upsert("docs", {
    points: [
      new models.PointStruct({
        id: 1,
        vector: [0.1, 0.2],
        payload: { tenant: "acme" },
      }),
    ],
  });

  assert.equal(result.status, models.UpdateStatus.COMPLETED);
  assert.deepEqual(fake.collection("docs").docs.upserts, [
    {
      docs: [
        {
          id: "1",
          _qdrant_id: 1,
          _qdrant_vector: [0.1, 0.2],
          tenant: "acme",
        },
      ],
    },
  ]);

  await assert.rejects(
    client.upsert("docs", {
      points: [{ id: 1, vector: [0.1], payload: { _qdrant_vector: [0.2] } }],
    }),
    /reserved prefix/,
  );

  await assert.rejects(
    client.upsert("docs", {
      points: [
        {
          id: 1,
          vector: {
            sparse: new models.SparseVector({ indices: [1], values: [0.9] }),
          },
        },
      ],
    }),
    UnsupportedQdrantFeatureError,
  );
});

test("queryPoints maps dense vectors, filters, and responses", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);

  const response = await client.queryPoints("docs", {
    query: [0.1, 0.2],
    queryFilter: new models.Filter({
      must: [
        new models.FieldCondition({
          key: "tenant",
          match: new models.MatchValue({ value: "acme" }),
        }),
      ],
      mustNot: [
        new models.FieldCondition({
          key: "status",
          match: new models.MatchValue({ value: "deleted" }),
        }),
      ],
    }),
    limit: 5,
    withVectors: true,
  });

  assert.equal(response.points[0].id, 1);
  assert.equal(response.points[0].score, 0.9);
  assert.deepEqual(response.points[0].payload, { tenant: "acme" });
  assert.deepEqual(response.points[0].vector, [0.1, 0.2]);
  assert.deepEqual(fake.collection("docs").queries, [
    {
      query: {
        knn: {
          field: "_qdrant_vector",
          k: 5,
          queryVector: [0.1, 0.2],
          filter: {
            bool: [
              { queryString: { query: "tenant:acme" }, occur: "filter" },
              { queryString: { query: "status:deleted" }, occur: "must_not" },
            ],
          },
        },
      },
      size: 5,
      consistentRead: true,
      includeVectors: true,
    },
  ]);

  await assert.rejects(
    client.queryPoints("docs", { query: [0.1], offset: 1 }),
    UnsupportedQdrantFeatureError,
  );
});

test("MatchText maps to LambdaDB text filter terms", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);

  await client.queryPoints("docs", {
    query: [0.1, 0.2],
    queryFilter: new models.Filter({
      must: [
        new models.FieldCondition({
          key: "body",
          match: new models.MatchText({ text: "serverless database" }),
        }),
      ],
    }),
  });

  assert.deepEqual(fake.collection("docs").queries[0].query.knn.filter, {
    bool: [
      { queryString: { query: "body:serverless" }, occur: "filter" },
      { queryString: { query: "body:database" }, occur: "filter" },
    ],
  });

  await assert.rejects(
    client.queryPoints("docs", {
      query: [0.1, 0.2],
      queryFilter: new models.Filter({
        must: [
          new models.FieldCondition({
            key: "body",
            match: new models.MatchText({ text: " " }),
          }),
        ],
      }),
    }),
    QdrantCompatValidationError,
  );
});

test("payload and vector selectors map to LambdaDB fields and qdrant responses", async () => {
  const fake = new FakeLambdaDB();
  const collection = fake.collection("docs");
  collection.query = async function query(body) {
    this.queries.push(body);
    return {
      docs: [
        {
          collection: this.name,
          score: 0.9,
          doc: {
            id: "1",
            _qdrant_id: 1,
            _qdrant_vector: [0.1, 0.2],
            _qdrant_vector_title: [0.3, 0.4],
            tenant: "acme",
            hidden: "value",
          },
        },
      ],
    };
  };
  const client = new QdrantCompatClient(fake);

  const response = await client.queryPoints("docs", {
    query: [0.1, 0.2],
    limit: 1,
    withPayload: ["tenant"],
    withVectors: ["title"],
  });

  assert.deepEqual(response.points[0].payload, { tenant: "acme" });
  assert.deepEqual(response.points[0].vector, { title: [0.3, 0.4] });
  assert.deepEqual(collection.queries[0].fields, {
    include: ["_qdrant_id", "tenant", "_qdrant_vector_title"],
  });
  assert.equal(collection.queries[0].includeVectors, true);

  const records = await client.retrieve("docs", {
    ids: [1],
    withPayload: ["tenant"],
    withVectors: false,
  });
  assert.deepEqual(records[0].payload, { tenant: "acme" });
  assert.equal(records[0].vector, undefined);
  assert.deepEqual(collection.docs.fetches.at(-1), {
    ids: ["1"],
    consistentRead: true,
    includeVectors: false,
    fields: { include: ["_qdrant_id", "tenant"] },
  });
});

test("retrieve, delete, scroll, count, and getCollection return qdrant-style objects", async () => {
  const fake = new FakeLambdaDB();
  fake.indexConfigs = {
    _qdrant_vector: {
      type: "vector",
      dimensions: 2,
      similarity: "cosine",
    },
  };
  fake.numDocs = 12;
  const client = new QdrantCompatClient(fake);

  const collection = await client.getCollection("docs");
  assert.equal(collection.config.params.vectors.size, 2);
  assert.equal(collection.config.params.vectors.distance, models.Distance.COSINE);

  const records = await client.retrieve("docs", { ids: [1], withVectors: true });
  assert.equal(records[0].id, 1);
  assert.deepEqual(records[0].payload, { tenant: "acme" });
  assert.deepEqual(records[0].vector, [0.1, 0.2]);
  assert.deepEqual(fake.collection("docs").docs.fetches, [
    { ids: ["1"], consistentRead: true, includeVectors: true },
  ]);

  const deleteResult = await client.delete("docs", { pointsSelector: [1] });
  assert.equal(deleteResult.status, models.UpdateStatus.COMPLETED);
  assert.deepEqual(fake.collection("docs").docs.deletes, [{ ids: ["1"] }]);

  await client.delete("docs", {
    filter: new models.Filter({
      must: [
        new models.FieldCondition({
          key: "tenant",
          match: new models.MatchValue({ value: "acme" }),
        }),
      ],
    }),
  });
  await client.delete("docs", {
    pointsSelector: {
      filter: {
        must: [
          {
            key: "status",
            match: { value: "archived" },
          },
        ],
      },
    },
  });
  assert.deepEqual(fake.collection("docs").docs.deletes, [
    { ids: ["1"] },
    {
      filter: {
        queryString: { query: "tenant:acme" },
      },
    },
    {
      filter: {
        queryString: { query: "status:archived" },
      },
    },
  ]);

  const [scrollRecords, nextOffset] = await client.scroll("docs", {
    limit: 3,
    withPayload: ["tenant"],
    withVectors: ["title"],
  });
  assert.equal(scrollRecords[0].id, 1);
  assert.deepEqual(scrollRecords[0].payload, { tenant: "acme" });
  assert.deepEqual(scrollRecords[0].vector, { title: [0.3, 0.4] });
  assert.equal(nextOffset, "next-token");
  assert.deepEqual(fake.collection("docs").docs.lists, [
    {
      size: 3,
      includeVectors: true,
      fields: { include: ["_qdrant_id", "tenant", "_qdrant_vector_title"] },
    },
  ]);

  const count = await client.count("docs");
  assert.equal(count.count, 12);
});

test("filtered scroll maps to extended list options and page-token offsets", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);

  const [records, nextOffset] = await client.scroll("docs", {
    scrollFilter: new models.Filter({
      must: [
        new models.FieldCondition({
          key: "tenant",
          match: new models.MatchValue({ value: "acme" }),
        }),
      ],
    }),
    offset: "page-1",
    withPayload: true,
  });

  assert.equal(nextOffset, "next-token");
  assert.equal(records[0].id, 1);
  assert.deepEqual(fake.collection("docs").docs.lists, [
    {
      size: 10,
      includeVectors: false,
      pageToken: "page-1",
      filter: { queryString: { query: "tenant:acme" } },
    },
  ]);

  await assert.rejects(
    client.scroll("docs", { offset: 1 }),
    UnsupportedQdrantFeatureError,
  );
});
