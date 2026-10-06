import assert from "node:assert/strict";
import test from "node:test";
import { indexConfigsUnionToJSON, indexConfigsUnionFromJSON,
  indexConfigsNativeEmbeddingVectorToJSON, indexConfigsNativeEmbeddingVectorFromJSON,
  indexConfigsManagedEmbeddingVectorToJSON } from "../dist/esm/models/index.js";

const native = { type: "vector", embedding: {
  provider: "openai", model: "text-embedding-3-small", sourceField: "body",
} };

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
  for (const value of [{ type: "vector", dimensions: 2 }, { type: "vector", dimensions: 2, managedEmbedding: false }]) {
    assert.deepEqual(JSON.parse(indexConfigsUnionToJSON(value)), { ...value, similarity: "cosine" });
  }
  assert.throws(() => indexConfigsManagedEmbeddingVectorToJSON(native));
});
