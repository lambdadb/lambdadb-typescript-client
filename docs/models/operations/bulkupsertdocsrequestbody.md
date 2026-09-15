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
| `type`                                         | *string*                                       | :heavy_minus_sign:                             | Optional completion metadata; omitted when not supplied. The uploaded object still requires Content-Type application/json. |
| `branch`                                       | *string*                                       | :heavy_minus_sign:                             | Write target Branch; defaults to `main`. |
