# CreateCollectionRequest

## Example Usage

```typescript
import { CreateCollectionRequest } from "lambdadb/models/operations";

let value: CreateCollectionRequest = {
  collectionName: "<value>",
};
```

## Fields

| Field                                                                                   | Type                                                                                    | Required                                                                                | Description                                                                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `collectionName`                                                                        | *string*                                                                                | :heavy_check_mark:                                                                      | Collection name must be unique within a project and the supported maximum length is 52. |
| `indexConfigs`                                                                          | Record<string, *models.IndexConfigsUnion*>                                              | :heavy_minus_sign:                                                                      | N/A                                                                                     |
| `sourceProjectName`                                                                     | *string*                                                                                | :heavy_minus_sign:                                                                      | N/A                                                                                     |
| `sourceCollectionName`                                                                  | *string*                                                                                | :heavy_minus_sign:                                                                      | N/A                                                                                     |
| `sourceDatetime`                                                                        | *string*                                                                                | :heavy_minus_sign:                                                                      | N/A                                                                                     |
| `sourceProjectApiKey`                                                                   | *string*                                                                                | :heavy_minus_sign:                                                                      | N/A                                                                                     |