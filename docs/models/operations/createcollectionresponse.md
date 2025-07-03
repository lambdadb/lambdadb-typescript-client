# CreateCollectionResponse

Created collection

## Example Usage

```typescript
import { CreateCollectionResponse } from "@swkim86/lambdadb/models/operations";

let value: CreateCollectionResponse = {
  collection: {
    projectName: "<value>",
    collectionName: "<value>",
    indexConfigs: {
      "key": {
        type: "long",
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