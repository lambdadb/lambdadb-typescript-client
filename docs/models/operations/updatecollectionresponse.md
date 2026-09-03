# UpdateCollectionResponse

Updated collection

## Example Usage

```typescript
import { UpdateCollectionResponse } from "@functional-systems/lambdadb/models/operations";

let value: UpdateCollectionResponse = {
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
