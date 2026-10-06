import type { CreateCollectionInput, IndexConfigsNativeEmbeddingVector, IndexConfigsManagedEmbeddingVector,
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
}
// @ts-expect-error Explicit false conflicts with native embedding configuration.
const disabled: IndexConfigsNativeEmbeddingVector = { ...native, managedEmbedding: false };
// @ts-expect-error The legacy named type retains its required true flag.
const oldWithoutFlag: IndexConfigsManagedEmbeddingVector = native;
void [model, oldFlag, disabled, oldWithoutFlag];
