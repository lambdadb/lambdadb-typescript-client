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
  isDocsInline: false,
};
```

## Fields

| Field                                                                            | Type                                                                             | Required                                                                         | Description                                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `took`                                                                           | *number*                                                                         | :heavy_check_mark:                                                               | Elapsed time in milliseconds.                                                    |
| `maxScore`                                                                       | *number*                                                                         | :heavy_minus_sign:                                                               | Maximum final returned score, including zero; omitted for empty rerank results.                                                                   |
| `total`                                                                          | *number*                                                                         | :heavy_check_mark:                                                               | Total number of documents returned.                                              |
| `docs`                                                                           | [operations.QueryCollectionDoc](../../models/operations/querycollectiondoc.md)[] | :heavy_check_mark:                                                               | List of documents.                                                               |
| `isDocsInline`                                                                   | *boolean*                                                                        | :heavy_check_mark:                                                               | Whether the list of documents is included.                                       |
| `docsUrl`                                                                        | *string*                                                                         | :heavy_minus_sign:                                                               | Optional download URL for the list of documents.                                 |
| `rerank` | `RerankResponse` | :heavy_minus_sign: | Optional managed reranking metadata; see [response reference](../../managed-reranking.md#response-reference). |

`rerank?: RerankResponse` reports managed rerank status, provider/model, counts,
stage milliseconds and optional resolvedModel/reason/criteriaVersion. It is
omitted when reranking is unused. See [Managed reranking](../../managed-reranking.md)
for required/optional fields and applied/skipped/fallback semantics. Metadata
and document scores survive automatic docsUrl downloads.
