# CollectionResponse

## Example usage

```typescript
import type { CollectionResponse } from "@functional-systems/lambdadb/models";

const value: CollectionResponse = {
  projectName: "project-name",
  collectionName: "collection-name",
  indexConfigs: { title: { type: "text" } },
  description: "Product catalog",
  tags: { environment: "production" },
  numPartitions: 1,
  numDocs: 1000,
  defaultBranchName: "main",
  snapshotRetentionInDays: 30,
  createdAt: 1788336000000,
  updatedAt: 1788336000000,
  dataUpdatedAt: 1788336060000,
};
```

## Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `projectName` | `string` | Yes | Project name. |
| `collectionName` | `string` | Yes | Collection name. |
| `indexConfigs` | `Record<string, IndexConfigsUnion>` | Yes | Nonempty index configurations. |
| `description` | `string` | Yes | Collection description. |
| `tags` | `Record<string, string>` | Yes | Up to five metadata tags. |
| `partitionConfig` | `PartitionConfig` | No | Partition configuration. |
| `numPartitions` | `number` | Yes | Total partitions, including the default partition. |
| `numDocs` | `number` | Yes | Documents in the default `main` Branch's committed head, not a cross-Branch total. |
| `defaultBranchName` | `"main"` | Yes | Default writable Branch. |
| `snapshotRetentionInDays` | `number` | Yes | Snapshot retention from 1 through 31 days. |
| `createdAt` | `number` | Yes | Creation time as Unix epoch milliseconds. |
| `updatedAt` | `number` | Yes | Last metadata update time as Unix epoch milliseconds. |
| `dataUpdatedAt` | `number` | No | Last data update in the default `main` committed head, in epoch milliseconds; absent before a committed head exists. |
