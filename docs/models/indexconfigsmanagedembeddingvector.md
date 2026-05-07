# IndexConfigsManagedEmbeddingVector

## Example Usage

```typescript
import { IndexConfigsManagedEmbeddingVector } from "@functional-systems/lambdadb/models";

let value: IndexConfigsManagedEmbeddingVector = {
  type: "vector",
  managedEmbedding: true,
  embedding: {
    provider: "openai",
    model: "text-embedding-3-small",
    sourceField: "body",
  },
};
```

## Fields

| Field              | Type                                                   | Required           | Description |
| ------------------ | ------------------------------------------------------ | ------------------ | ----------- |
| `type`             | *"vector"*                                             | :heavy_check_mark: | N/A |
| `managedEmbedding` | *true*                                                 | :heavy_check_mark: | Managed embedding vector field. |
| `embedding`        | [models.EmbeddingConfig](../models/embeddingconfig.md) | :heavy_check_mark: | Managed embedding configuration for vector fields. |
