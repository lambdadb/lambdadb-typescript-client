# UpdateCollectionResponse

Updated collection

## Example Usage

```typescript
import { UpdateCollectionResponse } from "lambdadb/models/operations";

let value: UpdateCollectionResponse = {
  collection: {
    projectName: "<value>",
    collectionName: "<value>",
    indexConfigs: {
      "key": {
        type: "object",
        objectIndexConfigs: {},
      },
    },
    numDocs: 249788,
    collectionStatus: "ACTIVE",
  },
};
```

## Fields

| Field                                                           | Type                                                            | Required                                                        | Description                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `collection`                                                    | [models.CollectionResponse](../../models/collectionresponse.md) | :heavy_check_mark:                                              | N/A                                                             |