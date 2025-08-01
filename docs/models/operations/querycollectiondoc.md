# QueryCollectionDoc

## Example Usage

```typescript
import { QueryCollectionDoc } from "@swkim86/lambdadb/models/operations";

let value: QueryCollectionDoc = {
  collection: "<value>",
  doc: {
    "key": "<value>",
  },
};
```

## Fields

| Field                      | Type                       | Required                   | Description                |
| -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| `collection`               | *string*                   | :heavy_check_mark:         | Collection name.           |
| `score`                    | *number*                   | :heavy_minus_sign:         | Document similarity score. |
| `doc`                      | Record<string, *any*>      | :heavy_check_mark:         | N/A                        |