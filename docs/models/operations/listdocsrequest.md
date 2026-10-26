# ListDocsRequest

## Example Usage

```typescript
import { ListDocsRequest } from "@functional-systems/lambdadb/models/operations";

let value: ListDocsRequest = {
  collectionName: "<value>",
};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `collectionName`                           | *string*                                   | :heavy_check_mark:                         | Collection name.                           |
| `size`                                     | *number*                                   | :heavy_minus_sign:                         | Max number of documents to return at once, from 1 to 1000. The server default is 100. |
| `pageToken`                                | *string*                                   | :heavy_minus_sign:                         | Opaque search position, not a Snapshot pin. |
| `includeVectors`                           | *boolean*                                  | :heavy_minus_sign:                         | Include vector values.                     |
| `refKind`                                  | `"branch" \| "tag" \| "alias"`          | :heavy_minus_sign:                         | Read ref kind; supply with `refName`.       |
| `refName`                                  | *string*                                   | :heavy_minus_sign:                         | Read ref name; supply with `refKind`.       |

The public `collection.docs.list()` and `listSafe()` helpers also accept explicit
`null` for `size`, `pageToken`, and `filter`, and send those requests through POST
List. Omitted values remain omitted. GET List parameters do not accept null.
