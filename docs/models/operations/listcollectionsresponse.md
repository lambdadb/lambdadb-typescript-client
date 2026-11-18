# ListCollectionsResponse

A list of collections matched with a projectName. The list endpoint supports pagination via query parameters `size` (1–100) and `pageToken`; the response includes `nextPageToken` when more pages are available. The server rejects an empty or malformed `pageToken`, an out-of-range `size`, and any other query parameter with HTTP `400` (`BadRequestError`); the SDK omits unset parameters and an empty `pageToken`.

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