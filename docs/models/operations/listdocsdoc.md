# ListDocsDoc

Document item in a list response (collection name and document body).

## Example Usage

```typescript
import { ListDocsDoc } from "@functional-systems/lambdadb/models/operations";

let value: ListDocsDoc = {
  collection: "<value>",
  doc: {
    "key": "<value>",
    "key1": "<value>",
  },
};
```

## Fields

| Field                 | Type                  | Required              | Description           |
| --------------------- | --------------------- | --------------------- | --------------------- |
| `collection`          | *string*              | :heavy_check_mark:    | Collection name.      |
| `doc`                 | Record<string, *any*>  | :heavy_check_mark:    | Document body.        |
