# IndexConfigsObject

## Example Usage

```typescript
import { IndexConfigsObject } from "@functional-systems/lambdadb/models";

let value: IndexConfigsObject = {
  type: "object",
  objectIndexConfigs: {
    "key": "<value>",
  },
};
```

## Fields

| Field                 | Type                  | Required              | Description           |
| --------------------- | --------------------- | --------------------- | --------------------- |
| `type`                | *"object"*            | :heavy_check_mark:    | N/A                   |
| `description`         | *string* \| `null`   | :heavy_minus_sign:    | Optional explanation of the field, up to 255 characters. See [FieldDescription](../models/indexconfigsunion.md#fielddescription). |
| `objectIndexConfigs`  | Record<string, *any*> | :heavy_check_mark:    | Nested field configurations; each child may carry its own `description`. |