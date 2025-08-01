# UpsertDocsRequestBody

## Example Usage

```typescript
import { UpsertDocsRequestBody } from "@swkim86/lambdadb/models/operations";

let value: UpsertDocsRequestBody = {
  docs: [
    {
      "key": "<value>",
      "key1": "<value>",
    },
    {
      "key": "<value>",
      "key1": "<value>",
    },
  ],
};
```

## Fields

| Field                          | Type                           | Required                       | Description                    |
| ------------------------------ | ------------------------------ | ------------------------------ | ------------------------------ |
| `docs`                         | Record<string, *any*>[]        | :heavy_check_mark:             | A list of documents to upsert. |