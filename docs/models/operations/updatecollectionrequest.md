# UpdateCollectionRequest

## Example Usage

```typescript
import { UpdateCollectionRequest } from "@functional-systems/lambdadb/models/operations";

let value: UpdateCollectionRequest = {
  collectionName: "<value>",
  requestBody: {
    indexConfigs: {
      "key": {
        type: "long",
      },
    },
  },
};
```

## Fields

| Field                                                                                            | Type                                                                                             | Required                                                                                         | Description                                                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `collectionName`                                                                                 | *string*                                                                                         | :heavy_check_mark:                                                                               | Collection name.                                                                                 |
| `requestBody`                                                                                    | [operations.UpdateCollectionRequestBody](../../models/operations/updatecollectionrequestbody.md) | :heavy_check_mark:                                                                               | N/A                                                                                              |