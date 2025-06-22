# QueryCollectionResponse

Documents selected by query.

## Example Usage

```typescript
import { QueryCollectionResponse } from "@swkim86/lambdadb/models/operations";

let value: QueryCollectionResponse = {};
```

## Fields

| Field                                                                            | Type                                                                             | Required                                                                         | Description                                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `took`                                                                           | *number*                                                                         | :heavy_minus_sign:                                                               | Elapsed time in milliseconds.                                                    |
| `maxScore`                                                                       | *number*                                                                         | :heavy_minus_sign:                                                               | Maximum score.                                                                   |
| `total`                                                                          | *number*                                                                         | :heavy_minus_sign:                                                               | Total number of documents returned.                                              |
| `docs`                                                                           | [operations.QueryCollectionDoc](../../models/operations/querycollectiondoc.md)[] | :heavy_minus_sign:                                                               | List of documents.                                                               |