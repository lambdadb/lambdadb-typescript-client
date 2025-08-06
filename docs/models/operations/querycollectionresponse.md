# QueryCollectionResponse

Documents selected by query.

## Example Usage

```typescript
import { QueryCollectionResponse } from "@functional-systems/lambdadb/models/operations";

let value: QueryCollectionResponse = {
  took: 533458,
  total: 322568,
  docs: [
    {
      collection: "<value>",
      doc: {
        "key": "<value>",
        "key1": "<value>",
        "key2": "<value>",
      },
    },
  ],
};
```

## Fields

| Field                                                                            | Type                                                                             | Required                                                                         | Description                                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `took`                                                                           | *number*                                                                         | :heavy_check_mark:                                                               | Elapsed time in milliseconds.                                                    |
| `maxScore`                                                                       | *number*                                                                         | :heavy_minus_sign:                                                               | Maximum score.                                                                   |
| `total`                                                                          | *number*                                                                         | :heavy_check_mark:                                                               | Total number of documents returned.                                              |
| `docs`                                                                           | [operations.QueryCollectionDoc](../../models/operations/querycollectiondoc.md)[] | :heavy_check_mark:                                                               | List of documents.                                                               |