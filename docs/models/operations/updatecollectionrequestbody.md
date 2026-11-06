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
| `indexConfigs`                             | Record<string, *models.IndexConfigsUnion*> \| `null` | :heavy_minus_sign: | Nonempty complete schema; preserve existing nested definitions. Only a field's optional `description` may change: omitted keeps it, `""` clears it, a new value replaces it. |
| `description`                              | *string* \| `null`                        | :heavy_minus_sign:                         | Description, up to 255 characters; `""` clears it. |
| `tags`                                     | Record<string, *string*> \| `null`        | :heavy_minus_sign:                         | Replaces the map; `{}` clears it. Values must be nonblank. |
| `snapshotRetentionInDays`                  | *number* \| `null`                        | :heavy_minus_sign:                         | Snapshot retention from 1 through 31 days.   |

Omitted or `null` fields are unchanged. Provide at least one non-null field.
