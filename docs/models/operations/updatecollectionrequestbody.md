# UpdateCollectionRequestBody

## Example Usage

```typescript
import { UpdateCollectionRequestBody } from "@functional-systems/lambdadb/models/operations";

let value: UpdateCollectionRequestBody = {
  description: "Updated description",
  tags: { environment: "production" },
  snapshotRetentionInDays: 30,
};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `indexConfigs`                             | Record<string, *models.IndexConfigsUnion*> | :heavy_minus_sign:                         | Index configurations.                       |
| `description`                              | *string*                                   | :heavy_minus_sign:                         | Description, up to 255 characters.           |
| `tags`                                     | Record<string, *string*>                   | :heavy_minus_sign:                         | Up to five metadata tags.                    |
| `snapshotRetentionInDays`                  | *number*                                   | :heavy_minus_sign:                         | Snapshot retention from 1 through 31 days.   |

Provide at least one field.
