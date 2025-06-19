# BulkUpsertDocsRequest

## Example Usage

```typescript
import { BulkUpsertDocsRequest } from "lambdadb/models/operations";

let value: BulkUpsertDocsRequest = {
  projectName: "<value>",
  collectionName: "<value>",
};
```

## Fields

| Field                                                                                        | Type                                                                                         | Required                                                                                     | Description                                                                                  |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `projectName`                                                                                | *string*                                                                                     | :heavy_check_mark:                                                                           | Project name.                                                                                |
| `collectionName`                                                                             | *string*                                                                                     | :heavy_check_mark:                                                                           | Collection name.                                                                             |
| `requestBody`                                                                                | [operations.BulkUpsertDocsRequestBody](../../models/operations/bulkupsertdocsrequestbody.md) | :heavy_check_mark:                                                                           | N/A                                                                                          |