# GetCollectionResponse

Describe collection success.

## Example Usage

```typescript
import { GetCollectionResponse } from "@functional-systems/lambdadb/models/operations";

let value: GetCollectionResponse = {
  collection: {
    projectName: "<value>",
    collectionName: "<value>",
    indexConfigs: {
      "key": {
        type: "sparseVector",
      },
    },
    description: "Product catalog",
    tags: { environment: "production" },
    numPartitions: 191337,
    numDocs: 249788,
    defaultBranchName: "main",
    snapshotRetentionInDays: 30,
    createdAt: 1788336000000,
    updatedAt: 1788336000000,
  },
};
```

## Fields

| Field                                                           | Type                                                            | Required                                                        | Description                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `collection`                                                    | [models.CollectionResponse](../../models/collectionresponse.md) | :heavy_check_mark:                                              | N/A                                                             |
