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

// Scroll reads committed data; writes can take several minutes to commit.
async function eventually(operation, description, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await operation();
      console.info(`[live] ${description}: passed`);
      return result;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(`Timed out waiting for ${description}`, { cause: lastError });
}

test("qdrant compatibility live smoke", {
  timeout: 360_000,
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

    const deleteByFilterResult = await client.delete(collectionName, {
      pointsSelector: {
        filter: new models.Filter({
          must: [
            new models.FieldCondition({
              key: "tenant",
              match: new models.MatchValue({ value: "other" }),
            }),
          ],
        }),
      },
    });
    assert.equal(deleteByFilterResult.status, models.UpdateStatus.COMPLETED);

    const deletedByFilterRecords = await client.retrieve(collectionName, { ids: [3] });
    assert.equal(deletedByFilterRecords.length, 0);

    await eventually(async () => {
      const [records] = await client.scroll(collectionName, {
        scrollFilter: new models.Filter({
          must: [
            new models.FieldCondition({
              key: "tenant",
              match: new models.MatchValue({ value: "acme" }),
            }),
          ],
        }),
      });
      assert.deepEqual(records.map((record) => record.id), [2]);
      assert.equal(records[0].payload?.tenant, "acme");
    }, "filtered scroll committed visibility");

    // Numeric Qdrant point offsets remain unsupported; use returned page tokens.
    await assert.rejects(
      client.scroll(collectionName, { offset: 1 }),
      UnsupportedQdrantFeatureError,
    );
  } finally {
    try {
      await client.deleteCollection(collectionName);
      await eventually(async () => {
        assert.equal(await client.collectionExists(collectionName), false);
      }, "Qdrant Collection cleanup", 30_000);
    } catch (error) {
      if (error?.name !== "ResourceNotFoundError") throw error;
    }
  }
});
