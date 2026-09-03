# BulkUpsertDocsRequestBody

## Example Usage

```typescript
import { BulkUpsertDocsRequestBody } from "@functional-systems/lambdadb/models/operations";

let value: BulkUpsertDocsRequestBody = {
  objectKey: "<value>",
};
```

## Fields

| Field                                          | Type                                           | Required                                       | Description                                    |
| ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| `objectKey`                                    | *string*                                       | :heavy_check_mark:                             | Object key uploaded based on bulk upsert info. |
| `type`                                         | `"application/json"`                          | :heavy_minus_sign:                             | Content type returned by the upload-info call. |
| `branch`                                       | *string*                                       | :heavy_minus_sign:                             | Write target Branch; defaults to `main`. |
