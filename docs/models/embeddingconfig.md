# EmbeddingConfig

Native embedding configuration for vector fields.

## Example Usage

```typescript
import { EmbeddingConfig } from "@functional-systems/lambdadb/models";

let value: EmbeddingConfig = {
  provider: "openai",
  model: "text-embedding-3-small",
  sources: [{ field: "article.body", type: "text" }],
};
```

Use exactly one non-null `sources` or legacy `sourceField`.

## Fields

| Field         | Type                                         | Required           | Description |
| ------------- | -------------------------------------------- | ------------------ | ----------- |
| `provider`    | [models.EmbeddingProvider](../models/embeddingprovider.md) | :heavy_check_mark: | Embedding provider. |
| `model`       | *string*                                     | :heavy_check_mark: | Embedding model name. See /guides/collections/native-embeddings for the current supported providers and models. |
| `sourceField` | *string \| null*                             | :heavy_minus_sign: | Legacy single-text stored string path used to generate embeddings; source indexes are optional. See [source paths and writes](../native-embeddings.md#source-paths-and-writes). |
| `sources`     | [models.EmbeddingSource](../models/embeddingsource.md)[] \| null | :heavy_minus_sign: | 1–16 ordered text/image source mappings. OpenAI requires exactly one text source. See [ordered and image sources](../native-embeddings.md#ordered-and-image-sources). |
| `dimensions`  | *number*                                     | :heavy_minus_sign: | Integer dimensions from 64 to 4096, subject to the model maximum. Cohere accepts 256, 512, 768, 1024, 1536 or 2048 and defaults to 2048. Optional in requests and resolved in stored metadata. |
| `similarity`  | [models.Similarity](../models/similarity.md) | :heavy_minus_sign: | Vector similarity metric. Optional in requests and resolved in stored collection metadata. |
