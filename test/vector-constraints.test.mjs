import assert from "node:assert/strict";
import test from "node:test";
import { HTTPClient, LambdaDBClient, SDKValidationError, ResponseValidationError } from "../dist/esm/index.js";
import { IndexConfigsUnion$inboundSchema, IndexConfigsUnion$outboundSchema } from "../dist/esm/models/index.js";

// Contract: lambdadb/docs@94a7b71613a3bf217a370d5117b3ff6ddfbae851.
const embedding = { provider: "openai", model: "text-embedding-3-small", sourceField: "body" };
const variants = [
  (settings) => ({ type: "vector", ...settings }),
  (settings) => ({ type: "vector", embedding: { ...embedding, ...settings } }),
  (settings) => ({ type: "vector", managedEmbedding: true, embedding: { ...embedding, ...settings } }),
];
const schemas = [IndexConfigsUnion$inboundSchema, IndexConfigsUnion$outboundSchema];
const options = { retries: { strategy: "none" } };

test("vector and native embedding schemas enforce dimension boundaries and supported metrics", () => {
  for (const schema of schemas) for (const variant of variants) {
    for (const dimensions of [64, 1536, 4096]) for (const similarity of ["cosine", "euclidean"]) {
      const value = variant({ dimensions, similarity });
      assert.deepEqual(schema.parse(value), value);
    }
    for (const dimensions of [0, 63, 4097, 64.5, NaN, Infinity, "64"]) {
      assert.equal(schema.safeParse(variant({ dimensions })).success, false);
    }
    for (const similarity of ["dot_product", "max_inner_product", "Cosine", ""]) {
      assert.equal(schema.safeParse(variant({ dimensions: 64, similarity })).success, false);
    }
  }
});

test("general defaults and native omission/null normalization remain unchanged", () => {
  for (const schema of schemas) {
    assert.equal(schema.parse({ type: "vector", dimensions: 64 }).similarity, "cosine");
    assert.equal(schema.safeParse({ type: "vector" }).success, false);
    assert.equal(schema.safeParse({ type: "vector", dimensions: null }).success, false);
    assert.deepEqual(schema.parse(variants[1]({})), variants[1]({}));
  }
  const nullable = variants[1]({ dimensions: null, similarity: null });
  const parsed = IndexConfigsUnion$inboundSchema.parse(nullable);
  assert.equal(parsed.embedding.dimensions, undefined);
  assert.equal(parsed.embedding.similarity, undefined);
  assert.equal(IndexConfigsUnion$outboundSchema.safeParse(nullable).success, false);
});

test("invalid configurations fail before create/update HTTP and retain response error classification", async () => {
  for (const variant of variants) for (const settings of [{ dimensions: 63 }, { dimensions: 64, similarity: "dot_product" }]) {
    let calls = 0;
    const indexConfigs = { vector: variant(settings) };
    const client = new LambdaDBClient({ baseUrl: "https://api.test", projectName: "project", projectApiKey: "test-key",
      httpClient: new HTTPClient({ fetcher: async () => {
        calls++;
        return new Response(JSON.stringify({ collection: { projectName: "project", collectionName: "vectors",
          description: "", tags: {}, defaultBranchName: "main", snapshotRetentionInDays: 30,
          indexConfigs, numPartitions: 1, numDocs: 0, createdAt: 0, updatedAt: 0 } }),
        { headers: { "content-type": "application/json" } });
      } }) });
    const handle = client.collection("vectors");
    await assert.rejects(client.createCollection({ collectionName: "vectors", indexConfigs }, options), SDKValidationError);
    const create = await client.createCollectionSafe({ collectionName: "vectors", indexConfigs }, options);
    assert.equal(create.ok, false);
    assert.ok(create.error instanceof SDKValidationError);
    await assert.rejects(handle.update({ indexConfigs }, options), SDKValidationError);
    const update = await handle.updateSafe({ indexConfigs }, options);
    assert.equal(update.ok, false);
    assert.ok(update.error instanceof SDKValidationError);
    assert.equal(calls, 0);
    await assert.rejects(handle.get(options), ResponseValidationError);
    const response = await handle.getSafe(options);
    assert.equal(response.ok, false);
    assert.ok(response.error instanceof ResponseValidationError);
    assert.equal(calls, 2);
  }
});
