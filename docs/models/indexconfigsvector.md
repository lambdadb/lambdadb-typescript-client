# IndexConfigsVector

## Example Usage

```typescript
import { IndexConfigsVector } from "@functional-systems/lambdadb/models";

let value: IndexConfigsVector = {
  type: "vector",
  dimensions: 1536,
};
```

## Fields

| Field                                        | Type                                         | Required                                     | Description                                  |
| -------------------------------------------- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| `type`                                       | *"vector"*                                   | :heavy_check_mark:                           | N/A                                          |
| `managedEmbedding`                           | *false*                                      | :heavy_minus_sign:                           | Set to false or omit for unmanaged vector fields. |
| `dimensions`                                 | *number*                                     | :heavy_check_mark:                           | Integer dimensions from 64 to 4096 for caller-provided vector fields. |
| `similarity`                                 | [models.Similarity](../models/similarity.md) | :heavy_minus_sign:                           | Vector similarity metric for unmanaged vector fields. |
| `description`                                | *string* \| `null`                          | :heavy_minus_sign:                           | Optional explanation of the field, up to 255 characters. See [FieldDescription](../models/indexconfigsunion.md#fielddescription). |
