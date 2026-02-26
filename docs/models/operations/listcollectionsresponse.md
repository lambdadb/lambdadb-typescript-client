# ListCollectionsResponse

A list of collections matched with a projectName. The list endpoint supports pagination via query parameters `size` (1–100) and `pageToken`; the response includes `nextPageToken` when more pages are available.

## Example Usage

```typescript
import { ListCollectionsResponse } from "@functional-systems/lambdadb/models/operations";

let value: ListCollectionsResponse = {
  collections: [],
  nextPageToken: "optional-next-page-token",
};
```

## Fields

| Field                                                             | Type                                                              | Required                                                          | Description                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `collections`                                                     | [models.CollectionResponse](../../models/collectionresponse.md)[] | :heavy_check_mark:                                                | N/A                                                               |
| `nextPageToken`                                                   | *string*                                                          | :heavy_minus_sign:                                                | Next page token for pagination.                                   |