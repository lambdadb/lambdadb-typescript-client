# IndexConfigs

Types that do not need additional parameters.

## Example Usage

```typescript
import { IndexConfigs } from "@functional-systems/lambdadb/models";

let value: IndexConfigs = {
  type: "datetime",
};
```

## Fields

| Field                                    | Type                                     | Required                                 | Description                              |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| `type`                                   | [models.TypeEnum](../models/typeenum.md) | :heavy_check_mark:                       | N/A                                      |
| `description`                            | *string* \| `null`                      | :heavy_minus_sign:                       | Optional explanation of the field, up to 255 characters. See [FieldDescription](../models/indexconfigsunion.md#fielddescription). |