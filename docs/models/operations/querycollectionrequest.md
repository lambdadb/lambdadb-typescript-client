# QueryCollectionRequest

## Example Usage

```typescript
import { QueryCollectionRequest } from "lambdadb/models/operations";

let value: QueryCollectionRequest = {
  projectName: "<value>",
  collectionName: "<value>",
};
```

## Fields

| Field                                                                                          | Type                                                                                           | Required                                                                                       | Description                                                                                    |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `projectName`                                                                                  | *string*                                                                                       | :heavy_check_mark:                                                                             | Project name.                                                                                  |
| `collectionName`                                                                               | *string*                                                                                       | :heavy_check_mark:                                                                             | Collection name.                                                                               |
| `requestBody`                                                                                  | [operations.QueryCollectionRequestBody](../../models/operations/querycollectionrequestbody.md) | :heavy_check_mark:                                                                             | N/A                                                                                            |