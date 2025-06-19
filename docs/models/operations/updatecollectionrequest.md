# UpdateCollectionRequest

## Example Usage

```typescript
import { UpdateCollectionRequest } from "lambdadb/models/operations";

let value: UpdateCollectionRequest = {
  projectName: "<value>",
  collectionName: "<value>",
};
```

## Fields

| Field                                                                                            | Type                                                                                             | Required                                                                                         | Description                                                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `projectName`                                                                                    | *string*                                                                                         | :heavy_check_mark:                                                                               | Project name.                                                                                    |
| `collectionName`                                                                                 | *string*                                                                                         | :heavy_check_mark:                                                                               | Collection name.                                                                                 |
| `requestBody`                                                                                    | [operations.UpdateCollectionRequestBody](../../models/operations/updatecollectionrequestbody.md) | :heavy_check_mark:                                                                               | N/A                                                                                              |