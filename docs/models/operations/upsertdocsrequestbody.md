# UpsertDocsRequestBody

## Example Usage

```typescript
import { UpsertDocsRequestBody } from "lambdadb/models/operations";

let value: UpsertDocsRequestBody = {
  docs: [
    {},
  ],
};
```

## Fields

| Field                                                                  | Type                                                                   | Required                                                               | Description                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `docs`                                                                 | [operations.UpsertDocsDoc](../../models/operations/upsertdocsdoc.md)[] | :heavy_check_mark:                                                     | A list of documents to upsert.                                         |