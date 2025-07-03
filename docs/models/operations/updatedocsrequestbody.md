# UpdateDocsRequestBody

## Example Usage

```typescript
import { UpdateDocsRequestBody } from "@swkim86/lambdadb/models/operations";

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
| `docs`                                                                              | Record<string, *any*>[]                                                             | :heavy_check_mark:                                                                  | A list of documents to update. Each document must contain 'id' field to be updated. |