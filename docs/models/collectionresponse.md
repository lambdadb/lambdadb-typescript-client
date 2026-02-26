# CollectionResponse

## Example Usage

```typescript
import { CollectionResponse } from "@functional-systems/lambdadb/models";

let value: CollectionResponse = {
  projectName: "<value>",
  collectionName: "<value>",
  indexConfigs: {
    "key": {
      type: "vector",
      dimensions: 135607,
      similarity: "cosine",
    },
  },
  numPartitions: 506700,
  numDocs: 731542,
  collectionStatus: "DELETING",
  createdAt: 0,
  updatedAt: 0,
  dataUpdatedAt: 0,
};
```

## Fields

| Field                                                       | Type                                                        | Required                                                    | Description                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| `projectName`                                               | *string*                                                    | :heavy_check_mark:                                          | Project name.                                               |
| `collectionName`                                            | *string*                                                    | :heavy_check_mark:                                          | Collection name.                                            |
| `indexConfigs`                                              | Record<string, *models.IndexConfigsUnion*>                  | :heavy_check_mark:                                          | N/A                                                         |
| `partitionConfig`                                           | [models.PartitionConfig](../models/partitionconfig.md)      | :heavy_minus_sign:                                          | N/A                                                         |
| `numPartitions`                                             | *number*                                                    | :heavy_check_mark:                                          | Total number of partitions including the default partition. |
| `numDocs`                                                   | *number*                                                    | :heavy_check_mark:                                          | Total number of documents.                                  |
| `sourceProjectName`                                         | *string*                                                    | :heavy_minus_sign:                                          | Source project name.                                        |
| `sourceCollectionName`                                      | *string*                                                    | :heavy_minus_sign:                                          | Source collection name.                                     |
| `sourceCollectionVersionId`                                 | *string*                                                    | :heavy_minus_sign:                                          | Source collection version.                                  |
| `collectionStatus`                                          | [models.Status](../models/status.md)                        | :heavy_check_mark:                                          | Status                                                      |
| `createdAt`                                                 | *number*                                                    | :heavy_check_mark:                                          | Collection creation time in seconds since the Unix epoch.     |
| `updatedAt`                                                 | *number*                                                    | :heavy_check_mark:                                          | Collection last update time in seconds since the Unix epoch. |
| `dataUpdatedAt`                                             | *number*                                                    | :heavy_check_mark:                                          | Collection data last update time in seconds since the Unix epoch. |