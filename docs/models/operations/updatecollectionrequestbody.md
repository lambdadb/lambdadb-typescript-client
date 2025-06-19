# UpdateCollectionRequestBody

## Example Usage

```typescript
import { UpdateCollectionRequestBody } from "lambdadb/models/operations";

let value: UpdateCollectionRequestBody = {
  indexConfigs: {
    "key": {
      type: "vector",
      dimensions: 26262,
      similarity: "cosine",
    },
  },
};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `indexConfigs`                             | Record<string, *models.IndexConfigsUnion*> | :heavy_check_mark:                         | N/A                                        |