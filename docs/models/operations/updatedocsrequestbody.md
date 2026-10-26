# UpdateDocsRequestBody

## Example Usage

```typescript
import { UpdateDocsRequestBody } from "@functional-systems/lambdadb/models/operations";

let value: UpdateDocsRequestBody = {
  docs: [
    {},
    {
      "key": "<value>",
      "key1": "<value>",
      "key2": "<value>",
    },
  ],
};
```

## Fields

| Field                                                                               | Type                                                                                | Required                                                                            | Description                                                                         |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `docs`                                                                              | Record<string, *any*>[]                                                             | :heavy_check_mark:                                                                  | A list of documents to update. Each document must contain 'id' field to be updated. For native embedding vector fields, omit the generated vector. Patches merge with stored JSON on the server; omitted or unchanged source text preserves its vector, while changed source text regenerates it. See [source paths and writes](../../native-embeddings.md#source-paths-and-writes). |
| `branch`                                                                            | *string*                                                                            | :heavy_minus_sign:                                                                  | Write target Branch; defaults to `main`. |
