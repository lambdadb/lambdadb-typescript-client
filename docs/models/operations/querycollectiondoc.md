# QueryCollectionDoc

## Example Usage

```typescript
import { QueryCollectionDoc } from "@functional-systems/lambdadb/models/operations";

let value: QueryCollectionDoc = {
  collection: "<value>",
  doc: {
    "key": "<value>",
  },
};
```

## Fields

| Field                      | Type                       | Required                   | Description                |
| -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| `collection`               | *string*                   | :heavy_check_mark:         | Collection name.           |
| `score`                    | *number*                   | :heavy_minus_sign:         | Final sorting score; evaluation score in [0,1] when rerank is applied, otherwise search score. |
| `doc`                      | Record<string, *any*>      | :heavy_check_mark:         | N/A                        |
| `retrievalScore` | *number* | :heavy_minus_sign: | Original retrieval/fusion score, present only when reranking is applied. |

`retrievalScore?: number` is the original retrieval/fusion score alongside
`score`, outside `doc`, present only when rerank is applied. Numeric zero and
precision are preserved. Scores are evaluation values, not relevance
probabilities. See [Native reranking](../../native-reranking.md).
