# FetchDocsResponse

Fetched documents.

## Example Usage

```typescript
import { FetchDocsResponse } from "@functional-systems/lambdadb/models/operations";

let value: FetchDocsResponse = {
  total: 67043,
  took: 639761,
  docs: [
    {
      collection: "<value>",
      doc: {},
    },
  ],
  isDocsInline: false,
};
```

## Fields

| Field                                                                | Type                                                                 | Required                                                             | Description                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `total`                                                              | *number*                                                             | :heavy_check_mark:                                                   | Total number of documents returned.                                  |
| `took`                                                               | *number*                                                             | :heavy_check_mark:                                                   | Elapsed time in milliseconds.                                        |
| `docs`                                                               | [operations.FetchDocsDoc](../../models/operations/fetchdocsdoc.md)[] | :heavy_check_mark:                                                   | N/A                                                                  |
| `isDocsInline`                                                       | *boolean*                                                            | :heavy_check_mark:                                                   | Whether the list of documents is included.                           |
| `docsUrl`                                                            | *string*                                                             | :heavy_minus_sign:                                                   | Download URL for the list of documents.                              |