# CreateCollectionResponse

Collection creation succeeds with HTTP `201`.

```typescript
import type { CreateCollectionResponse } from "@functional-systems/lambdadb/models/operations";

const value: CreateCollectionResponse = {
  collection: {
    projectName: "project-name",
    collectionName: "product-catalog",
    indexConfigs: { id: { type: "keyword" }, title: { type: "text" } },
    description: "Product catalog",
    tags: { environment: "production" },
    numPartitions: 1,
    numDocs: 0,
    defaultBranchName: "main",
    snapshotRetentionInDays: 30,
    createdAt: 1788336000000,
    updatedAt: 1788336000000,
  },
};
```

`collection` is a [CollectionResponse](../../models/collectionresponse.md), the
same shape a Collection read returns, including the normalized `indexConfigs`
of its `main` Branch. The former reduced `CreatedCollection` type is a
deprecated alias of `CollectionResponse`.

The model subpath exposes wire timestamps in Unix epoch milliseconds. The
collection-scoped `LambdaDBClient.createCollection()` facade returns
`createdAt`, `updatedAt`, and `dataUpdatedAt` as `Date`.
