import { LambdaDBClient, type CreateCollectionInput } from "@functional-systems/lambdadb";
import { Analyzer, type IndexConfigsText } from "@functional-systems/lambdadb/models";
import type { CreateCollectionRequest } from "@functional-systems/lambdadb/models/operations";

// All sixteen literal names compile through the published package declarations.
const names: Analyzer[] = [
  "standard", "english", "korean", "japanese", "chinese", "cjk", "arabic",
  "french", "german", "hindi", "indonesian", "italian", "portuguese",
  "russian", "spanish", "turkish",
];
const constants: Analyzer[] = [
  Analyzer.Standard, Analyzer.English, Analyzer.Korean, Analyzer.Japanese,
  Analyzer.Chinese, Analyzer.Cjk, Analyzer.Arabic, Analyzer.French,
  Analyzer.German, Analyzer.Hindi, Analyzer.Indonesian, Analyzer.Italian,
  Analyzer.Portuguese, Analyzer.Russian, Analyzer.Spanish, Analyzer.Turkish,
];
const fields: IndexConfigsText[] = [
  { type: "text", analyzers: names },
  { type: "text", analyzers: constants },
  { type: "text" },
  { type: "text", analyzers: [] },
  { type: "text", analyzers: ["chinese", "chinese"] },
];
const client = new LambdaDBClient({ projectApiKey: "test" });
for (const field of fields) {
  const input: CreateCollectionInput = {
    collectionName: "multilingual",
    indexConfigs: { content: field },
  };
  const wireInput: CreateCollectionRequest = input;
  void client.createCollection(wireInput);
  void client.createCollectionSafe(input);
}
// @ts-expect-error Unknown names must remain outside the closed enum.
const unknown: Analyzer = "unknown";
// @ts-expect-error Only the documented lowercase names are accepted.
const uppercase: Analyzer = "CHINESE";
const arbitrary: string = "chinese";
// @ts-expect-error Arbitrary string variables require narrowing to known names.
const widened: Analyzer = arbitrary;
void [unknown, uppercase, widened];
