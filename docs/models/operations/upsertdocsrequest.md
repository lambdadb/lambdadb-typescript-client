# UpsertDocsRequest

## Example Usage

```typescript
import { UpsertDocsRequest } from "lambdadb/models/operations";

let value: UpsertDocsRequest = {
  projectName: "<value>",
  collectionName: "<value>",
};
```

## Fields

| Field                                                                                | Type                                                                                 | Required                                                                             | Description                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `projectName`                                                                        | *string*                                                                             | :heavy_check_mark:                                                                   | Project name.                                                                        |
| `collectionName`                                                                     | *string*                                                                             | :heavy_check_mark:                                                                   | Collection name.                                                                     |
| `requestBody`                                                                        | [operations.UpsertDocsRequestBody](../../models/operations/upsertdocsrequestbody.md) | :heavy_check_mark:                                                                   | N/A                                                                                  |