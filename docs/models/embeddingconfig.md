# EmbeddingConfig

Native embedding configuration for vector fields.

## Example Usage

```typescript
import { EmbeddingConfig } from "@functional-systems/lambdadb/models";

let value: EmbeddingConfig = {
  provider: "openai",
  model: "text-embedding-3-small",
  sourceField: "article.body",
};
```

## Fields

| Field         | Type                                         | Required           | Description |
| ------------- | -------------------------------------------- | ------------------ | ----------- |
| `provider`    | [models.EmbeddingProvider](../models/embeddingprovider.md) | :heavy_check_mark: | Embedding provider. |
| `model`       | *string*                                     | :heavy_check_mark: | Embedding model name. See /guides/collections/native-embeddings for the current supported providers and models. |
| `sourceField` | *string*                                     | :heavy_check_mark: | Dot-separated stored string path used to generate embeddings; source indexes are optional. See [source paths and writes](../native-embeddings.md#source-paths-and-writes). |
| `dimensions`  | *number*                                     | :heavy_minus_sign: | Integer dimensions from 64 to 4096, subject to the model maximum. Optional in requests and resolved in stored metadata. |
| `similarity`  | [models.Similarity](../models/similarity.md) | :heavy_minus_sign: | Vector similarity metric. Optional in requests and resolved in stored collection metadata. |
