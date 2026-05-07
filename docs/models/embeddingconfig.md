# EmbeddingConfig

Managed embedding configuration for vector fields.

## Example Usage

```typescript
import { EmbeddingConfig } from "@functional-systems/lambdadb/models";

let value: EmbeddingConfig = {
  provider: "openai",
  model: "text-embedding-3-small",
  sourceField: "body",
};
```

## Fields

| Field         | Type                                         | Required           | Description |
| ------------- | -------------------------------------------- | ------------------ | ----------- |
| `provider`    | [models.EmbeddingProvider](../models/embeddingprovider.md) | :heavy_check_mark: | Embedding provider. |
| `model`       | *string*                                     | :heavy_check_mark: | Embedding model name. See /guides/collections/managed-embeddings for the current supported providers and models. |
| `sourceField` | *string*                                     | :heavy_check_mark: | Source text field name used to generate embeddings. |
| `dimensions`  | *number*                                     | :heavy_minus_sign: | Embedding dimensions. Optional in requests and resolved in stored collection metadata. |
| `similarity`  | [models.Similarity](../models/similarity.md) | :heavy_minus_sign: | Vector similarity metric. Optional in requests and resolved in stored collection metadata. |
