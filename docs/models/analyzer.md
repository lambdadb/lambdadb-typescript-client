# Analyzer

## Example Usage

```typescript
import { Analyzer, type IndexConfigsText } from "@functional-systems/lambdadb/models";

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
  | "turkish"
  | "armenian"
  | "basque"
  | "bengali"
  | "brazilian"
  | "bulgarian"
  | "catalan"
  | "czech"
  | "danish"
  | "dutch"
  | "estonian"
  | "finnish"
  | "galician"
  | "greek"
  | "hungarian"
  | "irish"
  | "latvian"
  | "lithuanian"
  | "norwegian"
  | "persian"
  | "romanian"
  | "serbian"
  | "sorani"
  | "swedish"
  | "thai"
  | "simple"
  | "whitespace"
  | "stop"
  | "keyword"
  | "pattern"
  | "fingerprint"
  | "nepali"
  | "tamil"
  | "telugu";
```

These lowercase names form a closed enum. See [IndexConfigsText](indexconfigstext.md)
for configuration and [the pinned source contract](../OPENAPI_UPDATE.md#openapi-spec).

All 49 names are fixed presets for `type: "text"`, using the backend's default
settings. Custom pipelines and analyzer options are not supported. The
`keyword` analyzer preserves the complete text as one token; it does not turn
a text field into the `keyword` field type or enable keyword sorting/facets.

`nepali`, `tamil`, and `telugu` are Lucene extensions, not common
Elasticsearch/OpenSearch support. Matching names do not imply support for
custom Elasticsearch/OpenSearch settings. For migration, pass only supported
preset names with default settings; reject or explicitly resolve unsupported
options rather than silently dropping them.

```typescript
const text: IndexConfigsText = { type: "text", analyzers: [Analyzer.Keyword] };
const keywordField = { type: "keyword" } as const;
```

New names require a backend deployment containing PR #437; the source pin alone
does not establish support in any environment.
