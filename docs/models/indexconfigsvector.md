# IndexConfigsVector

## Example Usage

```typescript
import { IndexConfigsVector } from "lambdadb/models";

let value: IndexConfigsVector = {
  type: "vector",
  dimensions: 435697,
};
```

## Fields

| Field                                        | Type                                         | Required                                     | Description                                  |
| -------------------------------------------- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| `type`                                       | [models.TypeVector](../models/typevector.md) | :heavy_check_mark:                           | N/A                                          |
| `dimensions`                                 | *number*                                     | :heavy_check_mark:                           | Vector dimensions.                           |
| `similarity`                                 | [models.Similarity](../models/similarity.md) | :heavy_minus_sign:                           | Vector similarity metric.                    |