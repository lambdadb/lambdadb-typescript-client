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
        size: 64,
        distance: models.Distance.EUCLID,
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
          dimensions: 64,
          similarity: "euclidean",
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
      dimensions: 64,
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
          dimensions: 64,
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

test("query, scroll, and delete share the same grouped Qdrant filter", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);
  const filter = new models.Filter({
    must: [new models.FieldCondition({
      key: "color",
      match: new models.MatchAny({ any: ["red", "blue"] }),
    })],
    should: [
      { key: "body", match: { text: "red apple" } },
      { key: "price", range: { gte: 1e-20, lt: 1e30 } },
    ],
    must_not: [new models.HasIdCondition({ has_id: [3, "point-4"] })],
  });

  await client.query("docs", { query: [0.1], filter });
  await client.search("docs", { queryVector: [0.1], filter });
  await client.scroll("docs", { filter });
  await client.delete("docs", { points_selector: { filter } });

  // (red OR blue) AND ((red apple) OR (1e-20 <= price < 1e30)) AND NOT (3 OR point-4)
  const expected = {
    bool: [
      {
        occur: "filter",
        bool: [
          { queryString: { query: "color:red" }, occur: "should" },
          { queryString: { query: "color:blue" }, occur: "should" },
        ],
      },
      {
        occur: "filter",
        bool: [
          {
            occur: "should",
            bool: [
              { queryString: { query: "body:red" }, occur: "filter" },
              { queryString: { query: "body:apple" }, occur: "filter" },
            ],
          },
          { queryString: { query: "price:[1E-20 TO 1E30}" }, occur: "should" },
        ],
      },
      {
        occur: "must_not",
        bool: [
          { queryString: { query: "id:3" }, occur: "should" },
          { queryString: { query: "id:point-4" }, occur: "should" },
        ],
      },
    ],
  };
  const collection = fake.collection("docs");
  assert.deepEqual(collection.queries[0].query.knn.filter, expected);
  assert.deepEqual(collection.queries[1].query.knn.filter, expected);
  assert.deepEqual(collection.docs.lists[0].filter, expected);
  assert.deepEqual(collection.docs.deletes, [{ filter: expected }]);
});

test("a single exclusion retains negation and treats wildcard characters literally", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);

  await client.delete("docs", {
    filter: { must_not: [{ key: "name", match: { value: "*" } }] },
  });
  await client.queryPoints("docs", {
    query: [0.1],
    query_filter: { must_not: [{ key: "body", match: { text: "red apple" } }] },
  });

  const collection = fake.collection("docs");
  assert.deepEqual(collection.docs.deletes, [{
    filter: {
      bool: [
        { queryString: { query: "*:*" }, occur: "filter" },
        { queryString: { query: 'name:"*"' }, occur: "must_not" },
      ],
    },
  }]);
  assert.deepEqual(collection.queries[0].query.knn.filter, {
    bool: [
      { queryString: { query: "*:*" }, occur: "filter" },
      {
        occur: "must_not",
        bool: [
          { queryString: { query: "body:red" }, occur: "filter" },
          { queryString: { query: "body:apple" }, occur: "filter" },
        ],
      },
    ],
  });
});

test("datetime range bounds retain their literal timestamp and inclusivity", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);

  await client.scroll("docs", {
    scroll_filter: { must: [{ key: "timestamp", range: { gt: "2026-11-01T00:00:00.001Z" } }] },
  });

  assert.deepEqual(fake.collection("docs").docs.lists[0].filter, {
    queryString: { query: 'timestamp:{"2026-11-01T00:00:00.001Z" TO *]' },
  });
});

test("unsupported and ambiguous filters are rejected before query, scroll, or delete", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);
  const field = { key: "status", match: { value: "active" } };
  const cases = [
    [new models.Filter({ must: [field], min_should: { conditions: [field], min_count: 1 } }),
      UnsupportedQdrantFeatureError],
    [{ must: [new models.FieldCondition({ ...field, geo_radius: {} })] },
      UnsupportedQdrantFeatureError],
    [{ must: [{ ...field, range: { gt: 1 } }] }, UnsupportedQdrantFeatureError],
    [{ must: [{ key: "timestamp", range: { gt: "2026-11-01T00:00:00.0001Z" } }] },
      UnsupportedQdrantFeatureError],
    [{ should: [field, { key: "status", match: new models.MatchExcept({ except_: ["inactive"] }) }] },
      UnsupportedQdrantFeatureError],
    [{ must_not: [{ key: "status", match: { except: ["active"] } }] }, UnsupportedQdrantFeatureError],
    [{ must: [{ key: "status", match: { value: "active", any: ["inactive"] } }] },
      QdrantCompatValidationError],
    [{ must: [{ key: "status", match: { any: [] } }] }, QdrantCompatValidationError],
    [{ must_not: [{ has_id: [] }] }, QdrantCompatValidationError],
    [{ must: [field], should: [] }, QdrantCompatValidationError],
    [{ must: field }, QdrantCompatValidationError],
    [[], QdrantCompatValidationError],
    [new models.Filter({ mustNot: [field], must_not: [] }), QdrantCompatValidationError],
    [{ must: [new models.HasIdCondition({ hasId: [1], has_id: [2] })] }, QdrantCompatValidationError],
  ];

  for (const [filter, error] of cases) {
    await assert.rejects(client.queryPoints("docs", { query: [0.1], queryFilter: filter }), error);
    await assert.rejects(client.scroll("docs", { scrollFilter: filter }), error);
    await assert.rejects(client.delete("docs", { filter }), error);
  }

  const filter = { must: [field] };
  await assert.rejects(client.query("docs", { query: [0.1], filter, queryFilter: {} }), QdrantCompatValidationError);
  await assert.rejects(client.scroll("docs", { filter, scroll_filter: {} }), QdrantCompatValidationError);

  const collection = fake.collection("docs");
  assert.deepEqual(collection.queries, []);
  assert.deepEqual(collection.docs.lists, []);
  assert.deepEqual(collection.docs.deletes, []);
});

test("an empty filter remains unfiltered for reads and cannot delete documents", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);
  const filter = new models.Filter({ must: [], must_not: [] });

  await client.queryPoints("docs", { query: [0.1], queryFilter: filter });
  await client.scroll("docs", { scrollFilter: {} });
  await assert.rejects(client.delete("docs", { filter }), UnsupportedQdrantFeatureError);

  const collection = fake.collection("docs");
  assert.equal(collection.queries[0].query.knn.filter, undefined);
  assert.equal(collection.docs.lists[0].filter, undefined);
  assert.deepEqual(collection.docs.deletes, []);
});

test("delete rejects mixed, empty, and malformed point selectors before dispatch", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);
  const filter = { must: [{ key: "tenant", match: { value: "acme" } }] };

  for (const options of [
    { points: [1], filter },
    { pointsSelector: { ids: [1], filter } },
    { pointsSelector: { filter }, points: [1] },
    { pointsSelector: { filter }, filter: {} },
    { pointsSelector: {}, filter },
    { points: [], filter },
    { points: [] },
    { points: [null] },
    { ids: [Number.MAX_SAFE_INTEGER + 1] },
  ]) {
    await assert.rejects(client.delete("docs", options), QdrantCompatValidationError);
  }
  for (const key of ["shardKey", "shard_key", "shardKeySelector", "shard_key_selector"]) {
    await assert.rejects(client.delete("docs", { filter, [key]: "tenant-a" }), UnsupportedQdrantFeatureError);
  }

  assert.deepEqual(fake.collection("docs").docs.deletes, []);
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
      dimensions: 64,
      similarity: "cosine",
    },
  };
  fake.numDocs = 12;
  const client = new QdrantCompatClient(fake);

  const collection = await client.getCollection("docs");
  assert.equal(collection.config.params.vectors.size, 64);
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

test("type-only payload text mapping preserves the server default", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);
  await client.createCollection("docs", {
    vectorsConfig: new models.VectorParams({ size: 64, distance: models.Distance.COSINE }),
    payloadSchema: { body: { type: "text" } },
  });
  assert.deepEqual(fake.created[0].indexConfigs.body, { type: "text" });
  await client.createPayloadIndex("docs", "additionalBody", { type: "text" });
  assert.deepEqual(fake.collection("docs").updates[0].indexConfigs.additionalBody, { type: "text" });
});

for (const option of [
  { analyzers: ["nepali"] },
  { tokenizer: "word" },
  { lowercase: false },
  { stopwords: ["the"] },
  { pattern: "\\W+" },
  { pipeline: ["lowercase"] },
]) {
  test(`Qdrant mapping rejects field options ${Object.keys(option)} before writes`, async () => {
    const fake = new FakeLambdaDB();
    const client = new QdrantCompatClient(fake);
    const field = { type: "text", ...option };
    await assert.rejects(
      client.createCollection("docs", {
        vectorsConfig: new models.VectorParams({ size: 64, distance: models.Distance.COSINE }),
        payloadSchema: { body: field },
      }),
      UnsupportedQdrantFeatureError,
    );
    await assert.rejects(
      client.createPayloadIndex("docs", "body", field),
      UnsupportedQdrantFeatureError,
    );
    assert.deepEqual(fake.created, []);
    assert.deepEqual(fake.collection("docs").updates, []);
  });
}

test("Dot distance is rejected before unnamed or named collection creation", async () => {
  const fake = new FakeLambdaDB();
  const client = new QdrantCompatClient(fake);
  for (const distance of [models.Distance.DOT, "dot_product"]) {
    const params = new models.VectorParams({ size: 64, distance });
    for (const vectorsConfig of [params, { title: params }]) {
      await assert.rejects(client.createCollection("docs", { vectorsConfig }), UnsupportedQdrantFeatureError);
    }
  }
  assert.deepEqual(fake.created, []);
});
