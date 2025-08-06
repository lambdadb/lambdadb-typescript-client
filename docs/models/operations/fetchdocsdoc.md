# FetchDocsDoc

## Example Usage

```typescript
import { FetchDocsDoc } from "@functional-systems/lambdadb/models/operations";

let value: FetchDocsDoc = {
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
| `collection`          | *string*              | :heavy_check_mark:    | N/A                   |
| `doc`                 | Record<string, *any*> | :heavy_check_mark:    | N/A                   |