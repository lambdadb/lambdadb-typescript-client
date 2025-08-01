# QueryCollectionRequest

## Example Usage

```typescript
import { QueryCollectionRequest } from "@swkim86/lambdadb/models/operations";

let value: QueryCollectionRequest = {
  collectionName: "<value>",
  requestBody: {
    query: {
      "key": "<value>",
    },
  },
};
```

## Fields

| Field                                                                                          | Type                                                                                           | Required                                                                                       | Description                                                                                    |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `collectionName`                                                                               | *string*                                                                                       | :heavy_check_mark:                                                                             | Collection name.                                                                               |
| `requestBody`                                                                                  | [operations.QueryCollectionRequestBody](../../models/operations/querycollectionrequestbody.md) | :heavy_check_mark:                                                                             | N/A                                                                                            |