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
| `size`                                     | *number*                                   | :heavy_minus_sign:                         | Max number of documents to return at once. |
| `pageToken`                                | *string*                                   | :heavy_minus_sign:                         | Next page token.                           |
| `includeVectors`                           | *boolean*                                  | :heavy_minus_sign:                         | Include vector values.                     |
| `refKind`                                  | `"branch" \| "tag" \| "alias"`          | :heavy_minus_sign:                         | Read ref kind; supply with `refName`.       |
| `refName`                                  | *string*                                   | :heavy_minus_sign:                         | Read ref name; supply with `refKind`.       |
