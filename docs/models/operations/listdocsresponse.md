# ListDocsResponse

Documents list.

## Example Usage

```typescript
import { ListDocsResponse } from "@functional-systems/lambdadb/models/operations";

let value: ListDocsResponse = {
  total: 224392,
  docs: [
    { collection: "my-collection", doc: { id: "1", text: "hello" } },
    { collection: "my-collection", doc: { id: "2", text: "world" } },
  ],
  nextPageToken: "eyJpZCI6ICJhYmMi...",
  isDocsInline: true,
};
```

## Fields

| Field                   | Type                                                                 | Required                | Description                                  |
| ----------------------- | -------------------------------------------------------------------- | ----------------------- | -------------------------------------------- |
| `total`                 | *number*                                                             | :heavy_check_mark:      | Total number of documents.                   |
| `docs`                  | [operations.ListDocsDoc](./listdocsdoc.md)[]                         | :heavy_check_mark:      | A list of documents.                         |
| `nextPageToken`        | *string*                                                             | :heavy_minus_sign:      | Token for the next page of results.          |
| `isDocsInline`          | *boolean*                                                            | :heavy_check_mark:      | Whether the list of documents is included.   |
| `docsUrl`               | *string*                                                             | :heavy_minus_sign:      | Download URL for the list of documents.      |