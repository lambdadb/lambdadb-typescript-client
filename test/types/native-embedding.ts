import type { CreateCollectionInput, IndexConfigsUnion, IndexConfigsNativeEmbeddingVector, IndexConfigsManagedEmbeddingVector,
  LambdaDBClient } from "@functional-systems/lambdadb";
import type { IndexConfigsNativeEmbeddingVector as ModelNative } from "@functional-systems/lambdadb/models";

const native: IndexConfigsNativeEmbeddingVector = { type: "vector", embedding: {
  provider: "openai", model: "text-embedding-3-small", sourceField: "body",
} };
const model: ModelNative = native;
const legacy: IndexConfigsManagedEmbeddingVector = { ...native, managedEmbedding: true };
const oldFlag: true = legacy.managedEmbedding;
const input: CreateCollectionInput = { collectionName: "native", indexConfigs: {
  body: { type: "text" }, embedding: native, legacy,
} };
export async function create(client: LambdaDBClient) {
  await client.createCollection(input);
  await client.collection("native").update({ indexConfigs: input.indexConfigs });
  // @ts-expect-error Create's public union rejects top-level native similarity.
  await client.createCollection({ collectionName: "native", indexConfigs: { vector: { type: "vector", embedding: native.embedding, similarity: "cosine" } } });
  // @ts-expect-error Update's public union rejects top-level native dimensions.
  await client.collection("native").update({ indexConfigs: { vector: { type: "vector", embedding: native.embedding, dimensions: 1536 } } });
}
// @ts-expect-error Explicit false conflicts with native embedding configuration.
const disabled: IndexConfigsNativeEmbeddingVector = { ...native, managedEmbedding: false };
// @ts-expect-error The legacy named type retains its required true flag.
const oldWithoutFlag: IndexConfigsManagedEmbeddingVector = native;
const unmanaged: IndexConfigsUnion = { type: "vector", dimensions: 2, similarity: "cosine" };
const disabledUnmanaged: IndexConfigsUnion = { type: "vector", managedEmbedding: false, dimensions: 2 };
const nestedSettings: IndexConfigsUnion = { ...native, embedding: { ...native.embedding, dimensions: 1536, similarity: "cosine" } };
// @ts-expect-error Explicitly unmanaged vectors cannot carry embedding configuration.
const unmanagedEmbedding: IndexConfigsUnion = { type: "vector", managedEmbedding: false, dimensions: 1536, embedding: native.embedding };
// @ts-expect-error Legacy true inputs also keep native settings inside embedding.
const legacyDimensions: IndexConfigsUnion = { ...legacy, dimensions: 1536 };
// @ts-expect-error The union rejects top-level similarity on legacy true inputs.
const legacySimilarity: IndexConfigsUnion = { ...legacy, similarity: "cosine" };
const sharedInput = { type: "vector" as const, embedding: native.embedding, dimensions: 1536 };
// @ts-expect-error Contradictory shared variables are rejected, not just fresh object literals.
const sharedConflict: IndexConfigsUnion = sharedInput;
void [model, oldFlag, disabled, oldWithoutFlag, unmanaged, disabledUnmanaged, nestedSettings,
  unmanagedEmbedding, legacyDimensions, legacySimilarity, sharedConflict];
