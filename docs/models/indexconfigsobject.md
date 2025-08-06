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

| Field                                        | Type                                         | Required                                     | Description                                  |
| -------------------------------------------- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| `type`                                       | [models.TypeObject](../models/typeobject.md) | :heavy_check_mark:                           | N/A                                          |
| `objectIndexConfigs`                         | Record<string, *any*>                        | :heavy_check_mark:                           | N/A                                          |