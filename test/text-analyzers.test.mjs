import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  HTTPClient,
  LambdaDBClient,
  ResponseValidationError,
  SDKValidationError,
} from "../dist/esm/index.js";
import {
  Analyzer,
  Analyzer$inboundSchema,
  Analyzer$outboundSchema,
  indexConfigsTextFromJSON,
  indexConfigsTextToJSON,
} from "../dist/esm/models/indexconfigsunion.js";

const source = JSON.parse(readFileSync(new URL("../schemas/text-analyzers.json", import.meta.url)));
const names = source.items.enum;
const NO_RETRIES = { retries: { strategy: "none" } };

function createClient(field) {
  const calls = [];
  const collection = {
    projectName: "test-project",
    collectionName: "multilingual",
    indexConfigs: { content: field },
    description: "",
    tags: {},
    numPartitions: 1,
    numDocs: 0,
    defaultBranchName: "main",
    snapshotRetentionInDays: 30,
    createdAt: 1,
    updatedAt: 1,
  };
  const client = new LambdaDBClient({
    baseUrl: "https://api.test",
    projectName: "test-project",
    projectApiKey: "test-key",
    httpClient: new HTTPClient({
      fetcher: async (request) => {
        calls.push({ method: request.method, body: await request.clone().text() });
        return new Response(JSON.stringify({ collection }), {
          status: request.method === "POST" ? 201 : 200,
          headers: { "content-type": "application/json" },
        });
      },
    }),
  });
  return { client, calls };
}

test("Analyzer constant and both Zod enums match the pinned analyzer schema", () => {
  assert.equal(names.length, 49);
  assert.deepEqual(names, [
    "standard", "english", "korean", "japanese", "chinese",
    "cjk", "arabic", "french", "german", "hindi",
    "indonesian", "italian", "portuguese", "russian", "spanish",
    "turkish", "armenian", "basque", "bengali", "brazilian",
    "bulgarian", "catalan", "czech", "danish", "dutch",
    "estonian", "finnish", "galician", "greek", "hungarian",
    "irish", "latvian", "lithuanian", "norwegian", "persian",
    "romanian", "serbian", "sorani", "swedish", "thai",
    "simple", "whitespace", "stop", "keyword", "pattern",
    "fingerprint", "nepali", "tamil", "telugu",
  ]);
  assert.deepEqual(Object.values(Analyzer), names);
  assert.deepEqual(Object.values(Analyzer$inboundSchema.enum), names);
  assert.deepEqual(Object.values(Analyzer$outboundSchema.enum), names);
  assert.deepEqual(source.default, ["standard"]);
  assert.equal(source.minItems, undefined);
  assert.equal(source.uniqueItems, undefined);
});

const validCases = [
  ...names.map((name) => [name, [name]]),
  ["all analyzers", names],
  ["original sixteen", names.slice(0, 16)],
  ["omitted", undefined],
  ["empty", []],
  ["duplicates and caller order", ["cjk", "standard", "chinese", "cjk", "standard"]],
];

for (const [label, analyzers] of validCases) {
  test(`${label}: model JSON and public create/get/update preserve analyzer settings`, async () => {
    const field = analyzers === undefined ? { type: "text" } : { type: "text", analyzers };
    assert.deepEqual(JSON.parse(indexConfigsTextToJSON(field)), field);
    const parsed = indexConfigsTextFromJSON(JSON.stringify(field));
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.value, field);

    const { client, calls } = createClient(field);
    const input = { collectionName: "multilingual", indexConfigs: { content: field } };
    const created = await client.createCollection(input, NO_RETRIES);
    assert.equal(created.collection.collectionName, input.collectionName);
    assert.deepEqual(calls[0], { method: "POST", body: JSON.stringify(input) });
    const result = await client.collection("multilingual").get(NO_RETRIES);
    assert.deepEqual(result.collection.indexConfigs.content, field);
    assert.equal(calls[1].method, "GET");
    const update = { indexConfigs: { content: field } };
    const updated = await client.collection("multilingual").update(update, NO_RETRIES);
    assert.deepEqual(updated.collection.indexConfigs.content, field);
    assert.deepEqual(JSON.parse(calls[2].body), update);
    const safe = await client.collection("multilingual").getSafe(NO_RETRIES);
    assert.equal(safe.ok, true);
    assert.deepEqual(safe.value.collection.indexConfigs.content, field);
  });
}

for (const value of ["unknown", "CHINESE", "KEYWORD", "Nepali", " chinese ", "", null, 123, { type: "custom", tokenizer: "standard" }]) {
  test(`invalid analyzer ${JSON.stringify(value)} fails request and response validation`, async () => {
    assert.equal(Analyzer$inboundSchema.safeParse(value).success, false);
    assert.equal(Analyzer$outboundSchema.safeParse(value).success, false);
    const field = { type: "text", analyzers: [value] };
    assert.throws(() => indexConfigsTextToJSON(field));
    assert.equal(indexConfigsTextFromJSON(JSON.stringify(field)).ok, false);

    const { client, calls } = createClient(field);
    const created = await client.createCollectionSafe({
      collectionName: "multilingual",
      indexConfigs: { content: field },
    }, NO_RETRIES);
    assert.equal(created.ok, false);
    assert.ok(created.error instanceof SDKValidationError);
    assert.equal(calls.length, 0);

    const result = await client.collection("multilingual").getSafe(NO_RETRIES);
    assert.equal(result.ok, false);
    assert.ok(result.error instanceof ResponseValidationError);
    assert.equal(calls.length, 1);
  });
}

test("nullable response analyzers retain the existing undefined normalization", () => {
  const parsed = indexConfigsTextFromJSON(JSON.stringify({ type: "text", analyzers: null }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.analyzers, undefined);
  assert.throws(() => indexConfigsTextToJSON({ type: "text", analyzers: null }));
});
