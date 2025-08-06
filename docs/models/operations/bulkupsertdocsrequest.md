# BulkUpsertDocsRequest

## Example Usage

```typescript
import { BulkUpsertDocsRequest } from "@functional-systems/lambdadb/models/operations";

let value: BulkUpsertDocsRequest = {
  collectionName: "<value>",
  requestBody: {
    objectKey: "<value>",
  },
};
```

## Fields

| Field                                                                                        | Type                                                                                         | Required                                                                                     | Description                                                                                  |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `collectionName`                                                                             | *string*                                                                                     | :heavy_check_mark:                                                                           | Collection name.                                                                             |
| `requestBody`                                                                                | [operations.BulkUpsertDocsRequestBody](../../models/operations/bulkupsertdocsrequestbody.md) | :heavy_check_mark:                                                                           | N/A                                                                                          |