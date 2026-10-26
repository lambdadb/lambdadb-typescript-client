# UpsertDocsRequestBody

## Example Usage

```typescript
import { UpsertDocsRequestBody } from "@functional-systems/lambdadb/models/operations";

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
| `docs`                         | Record<string, *any*>[]        | :heavy_check_mark:             | A list of documents to upsert. For native embedding vector fields, omit the generated vector and provide the configured source string at its stored JSON path. Source indexes are optional; full upserts replace the document. See [source paths and writes](../../native-embeddings.md#source-paths-and-writes). |
| `branch`                       | *string*                       | :heavy_minus_sign:             | Write target Branch; defaults to `main`. |
