# UpdateDocsRequestBody

## Example Usage

```typescript
import { UpdateDocsRequestBody } from "@swkim86/lambdadb/models/operations";

let value: UpdateDocsRequestBody = {
  docs: [
    {},
  ],
};
```

## Fields

| Field                                                                               | Type                                                                                | Required                                                                            | Description                                                                         |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `docs`                                                                              | [operations.UpdateDocsDoc](../../models/operations/updatedocsdoc.md)[]              | :heavy_check_mark:                                                                  | A list of documents to update. Each document must contain 'id' field to be updated. |