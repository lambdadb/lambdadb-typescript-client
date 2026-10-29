import type { CreateCollectionInput, EmbeddingConfig, EmbeddingSource, IndexConfigsUnion, IndexConfigsNativeEmbeddingVector, IndexConfigsManagedEmbeddingVector,
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
  // No source or ancestor index is required for stored string paths.
  const storedSource: CreateCollectionInput = { collectionName: "stored-source", indexConfigs: {
    vector: { type: "vector", embedding: { ...native.embedding, sourceField: "article.body" } },
  } };
  await client.createCollection(storedSource);
  await client.collection("stored-source").update({ indexConfigs: storedSource.indexConfigs });
  const collection = client.collection("stored-source");
  await collection.docs.upsert({ docs: [{ id: "one", article: { body: "Stored text", title: "Sibling" } }] });
  await collection.docs.update({ docs: [{ id: "one", article: { title: "Changed sibling" } }] });
  await collection.query({
    query: { knn: { field: "vector", queryText: "Stored text", k: 30 } },
    rerank: { provider: "typesafe", model: "jev-1.13.0", queryText: "Stored text", fields: ["article.body"] },
    fields: { include: ["id", "article.title"] },
  });
  // @ts-expect-error Create's public union rejects top-level native similarity.
  await client.createCollection({ collectionName: "native", indexConfigs: { vector: { type: "vector", embedding: native.embedding, similarity: "cosine" } } });
  // @ts-expect-error Update's public union rejects top-level native dimensions.
  await client.collection("native").update({ indexConfigs: { vector: { type: "vector", embedding: native.embedding, dimensions: 1536 } } });
}
// @ts-expect-error Explicit false conflicts with native embedding configuration.
const disabled: IndexConfigsNativeEmbeddingVector = { ...native, managedEmbedding: false };
// @ts-expect-error The legacy named type retains its required true flag.
const oldWithoutFlag: IndexConfigsManagedEmbeddingVector = native;
const unmanaged: IndexConfigsUnion = { type: "vector", dimensions: 64, similarity: "cosine" };
const disabledUnmanaged: IndexConfigsUnion = { type: "vector", managedEmbedding: false, dimensions: 64 };
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

// @ts-expect-error Dot product is outside the public OpenAPI similarity enum.
const dot: IndexConfigsUnion = { type: "vector", dimensions: 64, similarity: "dot_product" };
// @ts-expect-error Native embeddings use the same restricted similarity enum.
const inner: ModelNative = { type: "vector", embedding: { ...native.embedding, similarity: "max_inner_product" } };
void [dot, inner];

const sources: EmbeddingSource[] = [{ field: "product.description", type: "text" }, { field: "product.images", type: "image" }];
const cohere: IndexConfigsNativeEmbeddingVector = { type: "vector", embedding: {
  provider: "cohere", model: "embed-v5.0-fast", dimensions: 1024, sources, sourceField: null,
} };
const singleText: EmbeddingConfig = { ...native.embedding, sourceField: undefined, sources: [{ field: "body", type: "text" }] };
const storedSource: string | null | undefined = singleText.sourceField;
// @ts-expect-error Source types are text or image.
const audio: EmbeddingSource = { field: "audio", type: "audio" };
// @ts-expect-error Unsupported providers are outside the public enum.
const voyage: EmbeddingConfig = { ...singleText, provider: "voyage" };
void [cohere, storedSource, audio, voyage];
