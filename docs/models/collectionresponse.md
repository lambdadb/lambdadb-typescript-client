# CollectionResponse

## Example Usage

```typescript
import { CollectionResponse } from "@swkim86/lambdadb";

let value: CollectionResponse = {};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `projectName`                              | *string*                                   | :heavy_minus_sign:                         | Project name.                              |
| `collectionName`                           | *string*                                   | :heavy_minus_sign:                         | Collection name.                           |
| `indexConfigs`                             | Record<string, *models.IndexConfigsUnion*> | :heavy_minus_sign:                         | N/A                                        |
| `numDocs`                                  | *number*                                   | :heavy_minus_sign:                         | Total number of documents.                 |
| `sourceProjectName`                        | *string*                                   | :heavy_minus_sign:                         | Source project name.                       |
| `sourceCollectionName`                     | *string*                                   | :heavy_minus_sign:                         | Source collection name.                    |
| `sourceCollectionVersionId`                | *string*                                   | :heavy_minus_sign:                         | Source collection version.                 |
| `collectionStatus`                         | [models.Status](../models/status.md)       | :heavy_minus_sign:                         | Status                                     |