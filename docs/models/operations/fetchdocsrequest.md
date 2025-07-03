# FetchDocsRequest

## Example Usage

```typescript
import { FetchDocsRequest } from "@swkim86/lambdadb/models/operations";

let value: FetchDocsRequest = {
  collectionName: "<value>",
};
```

## Fields

| Field                                                                              | Type                                                                               | Required                                                                           | Description                                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `collectionName`                                                                   | *string*                                                                           | :heavy_check_mark:                                                                 | Collection name.                                                                   |
| `requestBody`                                                                      | [operations.FetchDocsRequestBody](../../models/operations/fetchdocsrequestbody.md) | :heavy_check_mark:                                                                 | N/A                                                                                |