# CollectionResponse

## Example Usage

```typescript
import { CollectionResponse } from "@swkim86/lambdadb";

let value: CollectionResponse = {
  projectName: "<value>",
  collectionName: "<value>",
  indexConfigs: {
    "key": {
      type: "text",
    },
  },
  numDocs: 135607,
  collectionStatus: "ACTIVE",
};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `projectName`                              | *string*                                   | :heavy_check_mark:                         | Project name.                              |
| `collectionName`                           | *string*                                   | :heavy_check_mark:                         | Collection name.                           |
| `indexConfigs`                             | Record<string, *models.IndexConfigsUnion*> | :heavy_check_mark:                         | N/A                                        |
| `numDocs`                                  | *number*                                   | :heavy_check_mark:                         | Total number of documents.                 |
| `sourceProjectName`                        | *string*                                   | :heavy_minus_sign:                         | Source project name.                       |
| `sourceCollectionName`                     | *string*                                   | :heavy_minus_sign:                         | Source collection name.                    |
| `sourceCollectionVersionId`                | *string*                                   | :heavy_minus_sign:                         | Source collection version.                 |
| `collectionStatus`                         | [models.Status](../models/status.md)       | :heavy_check_mark:                         | Status                                     |