# PartitionConfig

## Example Usage

```typescript
import { PartitionConfig } from "@functional-systems/lambdadb/models";

let value: PartitionConfig = {};
```

## Fields

| Field                                    | Type                                     | Required                                 | Description                              |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| `fieldName`                              | *string*                                 | :heavy_minus_sign:                       | Partition field name.                    |
| `dataType`                               | [models.DataType](../models/datatype.md) | :heavy_minus_sign:                       | Partition field data type.               |
| `numPartitions`                          | *number*                                 | :heavy_minus_sign:                       | The number of partitions.                |