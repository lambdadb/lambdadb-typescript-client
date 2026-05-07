# IndexConfigsVector

## Example Usage

```typescript
import { IndexConfigsVector } from "@functional-systems/lambdadb/models";

let value: IndexConfigsVector = {
  type: "vector",
  dimensions: 435697,
};
```

## Fields

| Field                                        | Type                                         | Required                                     | Description                                  |
| -------------------------------------------- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| `type`                                       | *"vector"*                                   | :heavy_check_mark:                           | N/A                                          |
| `managedEmbedding`                           | *false*                                      | :heavy_minus_sign:                           | Set to false or omit for unmanaged vector fields. |
| `dimensions`                                 | *number*                                     | :heavy_check_mark:                           | Vector dimensions for unmanaged vector fields. |
| `similarity`                                 | [models.Similarity](../models/similarity.md) | :heavy_minus_sign:                           | Vector similarity metric for unmanaged vector fields. |
