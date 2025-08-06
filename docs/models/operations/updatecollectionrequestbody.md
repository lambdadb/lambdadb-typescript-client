# UpdateCollectionRequestBody

## Example Usage

```typescript
import { UpdateCollectionRequestBody } from "@functional-systems/lambdadb/models/operations";

let value: UpdateCollectionRequestBody = {
  indexConfigs: {
    "key": {
      type: "keyword",
    },
  },
};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `indexConfigs`                             | Record<string, *models.IndexConfigsUnion*> | :heavy_check_mark:                         | N/A                                        |