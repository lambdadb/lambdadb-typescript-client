import assert from "node:assert/strict";
import test from "node:test";

import {
  QdrantCompatClient,
  UnsupportedQdrantFeatureError,
  models,
} from "../../dist/esm/compat/qdrant.js";

const shouldRun = process.env.LAMBDADB_RUN_LIVE_TESTS === "1";
const projectApiKey = process.env.LAMBDADB_PROJECT_API_KEY;
const projectName = process.env.LAMBDADB_PROJECT_NAME || "playground";
const baseUrl = process.env.LAMBDADB_BASE_URL || "https://api.lambdadb.ai";

test("qdrant compatibility live smoke", {
  skip: shouldRun && projectApiKey
    ? false
    : "Set LAMBDADB_RUN_LIVE_TESTS=1 and LAMBDADB_PROJECT_API_KEY to run live tests",
}, async () => {
  const client = new QdrantCompatClient({
    projectApiKey,
    projectName,
    baseUrl,
  });
  const collectionName = `qdrant-live-${Date.now()}`;

  try {
    await client.createCollection(collectionName, {
      vectorsConfig: new models.VectorParams({
        size: 3,
        distance: models.Distance.COSINE,
      }),
      payloadSchema: {
        tenant: models.PayloadSchemaType.KEYWORD,
      },
    });

    assert.equal(await client.collectionExists(collectionName), true);

    const upsertResult = await client.upsert(collectionName, {
      points: [
        new models.PointStruct({
          id: 1,
          vector: [1.0, 0.0, 0.0],
          payload: { tenant: "acme", title: "alpha" },
        }),
        new models.PointStruct({
          id: 2,
          vector: [0.0, 1.0, 0.0],
          payload: { tenant: "acme", title: "beta" },
        }),
        new models.PointStruct({
          id: 3,
          vector: [0.0, 0.0, 1.0],
          payload: { tenant: "other", title: "gamma" },
        }),
      ],
    });
    assert.equal(upsertResult.status, models.UpdateStatus.COMPLETED);

    const queryResult = await client.queryPoints(collectionName, {
      query: [1.0, 0.0, 0.0],
      queryFilter: new models.Filter({
        must: [
          new models.FieldCondition({
            key: "tenant",
            match: new models.MatchValue({ value: "acme" }),
          }),
        ],
      }),
      limit: 2,
    });
    assert.ok(queryResult.points.length > 0);
    assert.equal(queryResult.points[0].payload?.tenant, "acme");

    const records = await client.retrieve(collectionName, { ids: [1] });
    assert.equal(records[0]?.id, 1);
    assert.equal(records[0]?.payload?.tenant, "acme");

    const deleteResult = await client.delete(collectionName, {
      pointsSelector: [1],
    });
    assert.equal(deleteResult.status, models.UpdateStatus.COMPLETED);

    await assert.rejects(
      client.scroll(collectionName, {
        scrollFilter: new models.Filter({
          must: [
            new models.FieldCondition({
              key: "tenant",
              match: new models.MatchValue({ value: "acme" }),
            }),
          ],
        }),
      }),
      UnsupportedQdrantFeatureError,
    );
  } finally {
    try {
      await client.deleteCollection(collectionName);
    } catch (error) {
      if (error?.name !== "ResourceNotFoundError") throw error;
    }
  }
});
