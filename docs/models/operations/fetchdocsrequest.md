# FetchDocsRequest

## Example Usage

```typescript
import { FetchDocsRequest } from "lambdadb/models/operations";

let value: FetchDocsRequest = {
  projectName: "<value>",
  collectionName: "<value>",
};
```

## Fields

| Field                                                                              | Type                                                                               | Required                                                                           | Description                                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `projectName`                                                                      | *string*                                                                           | :heavy_check_mark:                                                                 | Project name.                                                                      |
| `collectionName`                                                                   | *string*                                                                           | :heavy_check_mark:                                                                 | Collection name.                                                                   |
| `requestBody`                                                                      | [operations.FetchDocsRequestBody](../../models/operations/fetchdocsrequestbody.md) | :heavy_check_mark:                                                                 | N/A                                                                                |