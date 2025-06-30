# UpdateDocsRequest

## Example Usage

```typescript
import { UpdateDocsRequest } from "@swkim86/lambdadb/models/operations";

let value: UpdateDocsRequest = {
  projectName: "<value>",
  collectionName: "<value>",
};
```

## Fields

| Field                                                                                | Type                                                                                 | Required                                                                             | Description                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `projectName`                                                                        | *string*                                                                             | :heavy_check_mark:                                                                   | Project name.                                                                        |
| `collectionName`                                                                     | *string*                                                                             | :heavy_check_mark:                                                                   | Collection name.                                                                     |
| `requestBody`                                                                        | [operations.UpdateDocsRequestBody](../../models/operations/updatedocsrequestbody.md) | :heavy_check_mark:                                                                   | N/A                                                                                  |