# ListDocsResponse

Documents list.

## Example Usage

```typescript
import { ListDocsResponse } from "@functional-systems/lambdadb/models/operations";

let value: ListDocsResponse = {
  total: 224392,
  docs: [
    {},
    {},
  ],
};
```

## Fields

| Field                   | Type                    | Required                | Description             |
| ----------------------- | ----------------------- | ----------------------- | ----------------------- |
| `total`                 | *number*                | :heavy_check_mark:      | N/A                     |
| `docs`                  | Record<string, *any*>[] | :heavy_check_mark:      | A list of documents.    |
| `nextPageToken`         | *string*                | :heavy_minus_sign:      | N/A                     |