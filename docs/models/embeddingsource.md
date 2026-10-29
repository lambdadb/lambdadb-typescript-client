# EmbeddingSource

One ordered embedding input mapping from the original stored JSON.

## Example Usage

```typescript
import { EmbeddingSource } from "@functional-systems/lambdadb/models";

let value: EmbeddingSource = {
  field: "product.images",
  type: "image",
};
```

## Fields

| Field   | Type                  | Required           | Description |
| ------- | --------------------- | ------------------ | ----------- |
| `field` | *string*              | :heavy_check_mark: | Unique dotted path in the original stored JSON; no index declaration is required. |
| `type`  | `"text" \| "image"`   | :heavy_check_mark: | Text sources are scalar strings. Cohere image sources are HTTPS URLs or image data URIs, as a string or flat string array. |
