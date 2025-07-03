# QueryCollectionResponse

Documents selected by query.

## Example Usage

```typescript
import { QueryCollectionResponse } from "@swkim86/lambdadb/models/operations";

let value: QueryCollectionResponse = {
  took: 533458,
  maxScore: 3225.68,
  total: 934439,
  docs: [
    {
      collection: "<value>",
      score: 6231.16,
      doc: {},
    },
  ],
};
```

## Fields

| Field                                                                            | Type                                                                             | Required                                                                         | Description                                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `took`                                                                           | *number*                                                                         | :heavy_check_mark:                                                               | Elapsed time in milliseconds.                                                    |
| `maxScore`                                                                       | *number*                                                                         | :heavy_check_mark:                                                               | Maximum score.                                                                   |
| `total`                                                                          | *number*                                                                         | :heavy_check_mark:                                                               | Total number of documents returned.                                              |
| `docs`                                                                           | [operations.QueryCollectionDoc](../../models/operations/querycollectiondoc.md)[] | :heavy_check_mark:                                                               | List of documents.                                                               |