# Analyzer

## Example Usage

```typescript
import { Analyzer } from "@functional-systems/lambdadb/models";

const value: Analyzer = "chinese";
const cjk: Analyzer = Analyzer.Cjk;
```

## Values

```typescript
type Analyzer =
  | "standard"
  | "english"
  | "korean"
  | "japanese"
  | "chinese"
  | "cjk"
  | "arabic"
  | "french"
  | "german"
  | "hindi"
  | "indonesian"
  | "italian"
  | "portuguese"
  | "russian"
  | "spanish"
  | "turkish";
```

These lowercase names form a closed enum. See [IndexConfigsText](indexconfigstext.md)
for configuration and [the pinned source contract](../OPENAPI_UPDATE.md#openapi-spec).
