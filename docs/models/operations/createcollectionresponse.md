# CreateCollectionResponse

Collection creation succeeds with HTTP `201`.

```typescript
import type { CreateCollectionResponse } from "@functional-systems/lambdadb/models/operations";

const value: CreateCollectionResponse = {
  collection: {
    collectionName: "product-catalog",
    description: "Product catalog",
    tags: { environment: "production" },
    defaultBranchName: "main",
    snapshotRetentionInDays: 30,
    createdAt: 1788336000000,
  },
};
```

The model subpath exposes the wire timestamp in Unix epoch milliseconds. The
collection-scoped `LambdaDBClient.createCollection()` facade returns
`createdAt` as `Date`.
