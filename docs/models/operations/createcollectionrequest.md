# CreateCollectionRequest

## Example usage

```typescript
import type { CreateCollectionRequest } from "@functional-systems/lambdadb/models/operations";

const value: CreateCollectionRequest = {
  collectionName: "product-catalog",
  indexConfigs: {},
  description: "Product catalog",
  tags: { environment: "production" },
  snapshotRetentionInDays: 30,
};
```

## Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `collectionName` | `string` | Yes | Unique Collection name. |
| `indexConfigs` | `Record<string, IndexConfigsUnion>` | Yes | Index configurations. |
| `description` | `string` | No | Description, up to 255 characters. |
| `tags` | `Record<string, string>` | No | Up to five metadata tags. |
| `partitionConfig` | `PartitionConfig` | No | Partition configuration. |
| `snapshotRetentionInDays` | `number` | No | Snapshot retention from 1 through 31 days; defaults to 30. |

The removed cross-collection source fields have no direct replacement in this
request. Data Versioning Branches and Tags are scoped to one existing
Collection.
