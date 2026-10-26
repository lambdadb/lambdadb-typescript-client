import assert from "node:assert/strict";
import test from "node:test";
import { HTTPClient, LambdaDBClient } from "../dist/esm/index.js";
import { indexConfigsUnionToJSON, indexConfigsUnionFromJSON,
  indexConfigsNativeEmbeddingVectorToJSON, indexConfigsNativeEmbeddingVectorFromJSON,
  indexConfigsManagedEmbeddingVectorToJSON } from "../dist/esm/models/index.js";

const native = { type: "vector", embedding: {
  provider: "openai", model: "text-embedding-3-small", sourceField: "body",
} };

const options = { retries: { strategy: "none" } };
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});

// Stored source contract: lambdadb ff13daf3f4ed40487b2b13522a141265c2f459ab.
for (const safe of [false, true]) {
  test(`source paths need no inferred indexes in Collection create/get/update, safe=${safe}`, async () => {
    for (const [sourceField, sources] of [
      ["body", {}], ["article.body", {}],
      ["article.body", { article: { type: "object", objectIndexConfigs: {} } }],
      ["body", { body: { type: "keyword" } }],
    ]) {
      const vector = { ...native, embedding: { ...native.embedding, sourceField } };
      const indexConfigs = { ...sources, vector };
      const stored = { ...indexConfigs, vector: { ...vector, managedEmbedding: true,
        embedding: { ...vector.embedding, dimensions: 1536, similarity: "cosine" } } };
      const collection = { projectName: "project", collectionName: "native-source",
        description: "", tags: {}, defaultBranchName: "main", snapshotRetentionInDays: 30,
        indexConfigs: stored, numPartitions: 1, numDocs: 0, createdAt: 0, updatedAt: 0 };
      const calls = [];
      const client = new LambdaDBClient({ baseUrl: "https://api.test", projectName: "project",
        projectApiKey: "test-key", httpClient: new HTTPClient({ fetcher: async (request) => {
          calls.push({ method: request.method, body: request.method === "GET" ? null : await request.json() });
          return json({ collection }, request.method === "POST" ? 201 : 200);
        } }) });
      const input = { collectionName: "native-source", indexConfigs };
      if (safe) assert.equal((await client.createCollectionSafe(input, options)).ok, true);
      else await client.createCollection(input, options);
      const handle = client.collection("native-source");
      const read = safe ? await handle.getSafe(options) : await handle.get(options);
      if (safe) assert.equal(read.ok, true);
      assert.deepEqual((safe ? read.value : read).collection.indexConfigs, stored);
      const updated = safe ? await handle.updateSafe({ indexConfigs }, options)
        : await handle.update({ indexConfigs }, options);
      if (safe) assert.equal(updated.ok, true);
      assert.deepEqual((safe ? updated.value : updated).collection.indexConfigs, stored);
      assert.deepEqual(calls, [
        { method: "POST", body: input }, { method: "GET", body: null },
        { method: "PATCH", body: { indexConfigs } },
      ]);
      assert.equal(vector.managedEmbedding, undefined);
      assert.equal(vector.embedding.dimensions, undefined);
    }
  });

  test(`writes preserve original stored JSON and partial patches without local merging, safe=${safe}`, async () => {
    const calls = [];
    const client = new LambdaDBClient({ baseUrl: "https://api.test", projectName: "project",
      projectApiKey: "test-key", httpClient: new HTTPClient({ fetcher: async (request) => {
        calls.push({ path: new URL(request.url).pathname, body: await request.json() });
        return json({ message: "accepted" }, 202);
      } }) });
    const handle = client.collection("native-source");
    const docs = [{ id: "one", article: { body: "stored text", title: "original" },
      sibling: { array: [1, true, null], object: { text: "ordinary JSON" } } }];
    const original = structuredClone(docs);
    if (safe) assert.equal((await handle.docs.upsertSafe({ docs }, options)).ok, true);
    else await handle.docs.upsert({ docs }, options);
    const patches = [
      { id: "one", note: "source omitted" }, { id: "one", article: {} },
      { id: "one", article: { title: "changed sibling" } },
      { id: "one", article: { body: "stored text" } },
      { id: "one", article: { body: "changed text" } },
      // The SDK preserves explicit null; the server decides whether the source is valid.
      { id: "one", article: { body: null } },
    ];
    for (const patch of patches) {
      if (safe) assert.equal((await handle.docs.updateSafe({ docs: [patch] }, options)).ok, true);
      else await handle.docs.update({ docs: [patch] }, options);
    }
    // A full replacement missing its source is also sent unchanged.
    if (safe) assert.equal((await handle.docs.upsertSafe({ docs: [{ id: "one" }] }, options)).ok, true);
    else await handle.docs.upsert({ docs: [{ id: "one" }] }, options);
    assert.deepEqual(calls, [
      { path: "/projects/project/collections/native-source/docs/upsert", body: { docs: original } },
      ...patches.map((patch) => ({
        path: "/projects/project/collections/native-source/docs/update", body: { docs: [patch] },
      })),
      { path: "/projects/project/collections/native-source/docs/upsert", body: { docs: [{ id: "one" }] } },
    ]);
    assert.deepEqual(docs, original);
  });
}

test("native embedding serializes without inferred flags or model defaults and retains explicit legacy flags", () => {
  assert.deepEqual(JSON.parse(indexConfigsNativeEmbeddingVectorToJSON(native)), native);
  assert.deepEqual(JSON.parse(indexConfigsUnionToJSON(native)), native);
  const legacy = { ...native, managedEmbedding: true };
  assert.deepEqual(JSON.parse(indexConfigsUnionToJSON(legacy)), legacy);
  assert.deepEqual(JSON.parse(indexConfigsManagedEmbeddingVectorToJSON(legacy)), legacy);
  for (const value of [native, legacy]) {
    assert.deepEqual(indexConfigsNativeEmbeddingVectorFromJSON(JSON.stringify(value)).value, value);
    assert.deepEqual(indexConfigsUnionFromJSON(JSON.stringify(value)).value, value);
  }
});

test("native embedding retains vector conflicts, strict public fields, and caller-provided vector support", () => {
  for (const value of [{ ...native, managedEmbedding: false }, { ...native, dimensions: 1536 },
    { ...native, similarity: "cosine" }, { ...native, nativeEmbedding: true },
    { ...native, embedding: { ...native.embedding, unknown: true } }]) {
    assert.throws(() => indexConfigsUnionToJSON(value));
  }
  for (const value of [{ type: "vector", dimensions: 64 }, { type: "vector", dimensions: 64, managedEmbedding: false }]) {
    assert.deepEqual(JSON.parse(indexConfigsUnionToJSON(value)), { ...value, similarity: "cosine" });
  }
  assert.throws(() => indexConfigsManagedEmbeddingVectorToJSON(native));
});
