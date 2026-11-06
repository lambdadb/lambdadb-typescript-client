import type { CreateCollectionInput, FieldDescription, UpdateCollectionInput } from "@functional-systems/lambdadb";
import type {
  IndexConfigs,
  IndexConfigsNativeEmbeddingVector,
  IndexConfigsObject,
  IndexConfigsText,
  IndexConfigsUnion,
  IndexConfigsVector,
} from "@functional-systems/lambdadb/models";

// Every index config variant accepts an optional description, including null.
const described: IndexConfigsUnion[] = [
  { type: "text", description: "Book title" } satisfies IndexConfigsText,
  { type: "vector", dimensions: 128, description: "Caller-provided embedding" } satisfies IndexConfigsVector,
  {
    type: "vector",
    embedding: { provider: "openai", model: "text-embedding-3-small", sourceField: "body" },
    description: "Native embedding",
  } satisfies IndexConfigsNativeEmbeddingVector,
  { type: "keyword", description: null } satisfies IndexConfigs,
  {
    type: "object",
    description: "Nested details",
    objectIndexConfigs: { pages: { type: "long", description: "Page count" } },
  } satisfies IndexConfigsObject,
  { type: "datetime" },
];
const create: CreateCollectionInput = {
  collectionName: "books",
  indexConfigs: { title: { type: "text", description: "Book title" } },
};
const clearOnUpdate: UpdateCollectionInput = {
  indexConfigs: { title: { type: "text", description: "" } },
};
const description: FieldDescription = null;
// @ts-expect-error Descriptions are strings or null.
const numeric: IndexConfigsText = { type: "text", description: 7 };
void [described, create, clearOnUpdate, description, numeric];
