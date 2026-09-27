import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

import { HTTPClient, LambdaDBClient, ResourceNotFoundError } from "../../dist/esm/index.js";
import { Analyzer } from "../../dist/esm/models/indexconfigsunion.js";

// Search fixtures from backend PR #417, head 410154abcdf5275add1df47dcf23c170ed0e0efd.
const languages = [
  ["standard", "Hello WORLD", "world"],
  ["english", "The books and houses", "book"],
  ["korean", "한국", "한국"],
  ["japanese", "東京", "東京"],
  ["chinese", "我喜欢自然语言处理", "语言"],
  ["cjk", "北京大学", "大学"],
  ["arabic", "الكتب والسيارات", "كتب"],
  ["french", "Les chevaux et les maisons", "cheval"],
  ["german", "Häuser und Bücher", "Haus"],
  ["hindi", "किताबें और लड़कियाँ", "किताब"],
  ["indonesian", "buku dan membaca", "baca"],
  ["italian", "I libri e le case", "libri"],
  ["portuguese", "Os livros e as casas", "livro"],
  ["russian", "книги и машины", "книга"],
  ["spanish", "Los libros y las casas", "libro"],
  ["turkish", "İstanbul kitaplar", "kitap"],
];
const options = { timeoutMs: 15_000, retries: { strategy: "none" } };

// Avoid dumping SDK error objects, which can contain authenticated requests.
function safeError(error) {
  if (error instanceof assert.AssertionError) return error;
  return new Error(`${error?.name ?? "Error"}; HTTP ${error?.statusCode ?? "unavailable"}`);
}

async function eventually(operation, label, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (await operation()) return;
    assert.ok(Date.now() < deadline, `Timed out waiting for ${label}`);
    await delay(2_000);
  }
}

test("live text analyzer creation, metadata, language searches, and cleanup", {
  timeout: 600_000,
}, async (t) => {
  for (const name of ["LAMBDADB_BASE_URL", "LAMBDADB_PROJECT_NAME", "LAMBDADB_PROJECT_API_KEY"]) {
    assert.ok(process.env[name], `Missing ${name}; load the intended environment's .env.local`);
  }
  assert.deepEqual(languages.map(([name]) => name).sort(), Object.values(Analyzer).sort());
  const raw = process.env.LAMBDADB_BASE_URL;
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  const projectName = process.env.LAMBDADB_PROJECT_NAME;
  const server = url.pathname.replace(/\/+$/, "") === `/projects/${encodeURIComponent(projectName)}`
    ? { serverURL: url.toString() }
    : { baseUrl: url.toString(), projectName };
  const collectionName = `ts-analyzers-${randomUUID()}`;
  const indexConfigs = Object.fromEntries(languages.map(([name]) => [
    name, { type: "text", analyzers: [name] },
  ]));
  Object.assign(indexConfigs, {
    omitted: { type: "text" },
    empty: { type: "text", analyzers: [] },
    duplicates: { type: "text", analyzers: ["cjk", "standard", "chinese", "cjk", "standard"] },
    chineseWord: { type: "text", analyzers: ["chinese"] },
  });
  let created = false;
  let creating = false;
  const httpClient = new HTTPClient();
  httpClient.addHook("beforeRequest", async (request) => {
    if (creating) {
      const body = await request.clone().json();
      assert.deepEqual(body.indexConfigs, indexConfigs);
      assert.equal(Object.hasOwn(body.indexConfigs.omitted, "analyzers"), false);
    }
  });
  httpClient.addHook("response", (response) => {
    // Register ownership before response parsing, so a parsing failure still cleans up.
    if (creating && response.status === 201) created = true;
  });
  const client = new LambdaDBClient({ ...server, projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY, httpClient });
  const collection = client.collection(collectionName);
  console.info(`[live] Environment ${url.origin}; project ${projectName}; collection ${collectionName}`);
  t.after(async () => {
    creating = false;
    if (!created) return;
    try {
      await collection.delete(options);
      await eventually(async () => {
        const result = await collection.getSafe(options);
        if (result.ok) return false;
        if (!(result.error instanceof ResourceNotFoundError)) throw result.error;
        return true;
      }, "Collection absence", 30_000);
      console.info(`[live] Deleted ${collectionName}; absence verified (404)`);
    } catch (error) {
      console.error(`[live] Cleanup failed for ${collectionName}`);
      throw safeError(error);
    }
  });

  try {
    creating = true;
    const result = await client.createCollection({
      collectionName,
      description: "TypeScript multilingual analyzer live smoke",
      tags: { purpose: "sdk-smoke" },
      indexConfigs,
    }, options);
    creating = false;
    assert.equal(result.collection.collectionName, collectionName);
    console.info("[live] Create: 16 analyzers plus omission, empty array, duplicates, and Chinese word field accepted");
    const expected = { ...indexConfigs, omitted: { type: "text", analyzers: ["standard"] } };
    const metadata = await collection.get(options);
    // The server also adds its reserved id keyword field. Check each requested field.
    for (const [name, field] of Object.entries(expected)) {
      assert.deepEqual(metadata.collection.indexConfigs[name], field, name);
    }
    const safeMetadata = await collection.getSafe(options);
    assert.equal(safeMetadata.ok, true);
    for (const [name, field] of Object.entries(expected)) {
      assert.deepEqual(safeMetadata.value.collection.indexConfigs[name], field, name);
    }
    console.info("[live] Get/GetSafe: all names, server default, empty array, duplicates, and order preserved");

    const doc = Object.fromEntries(languages.map(([name, content]) => [name, content]));
    Object.assign(doc, { id: "language-sample", omitted: "Hello WORLD", empty: "hello", duplicates: "北京大学", chineseWord: "北京大学" });
    await collection.docs.upsert({ docs: [doc] }, options);
    const search = async (field, query, skipSyntax) => collection.query({
      query: { queryString: { query, defaultField: field, skipSyntax } },
      consistentRead: true,
      size: 10,
    }, options);
    await eventually(async () => {
      const response = await search("standard", "world", true);
      return response.total === 1;
    }, "indexed document visibility", 300_000);

    for (const [name, , query] of languages) {
      for (const skipSyntax of [false, true]) {
        const positive = await search(name, query, skipSyntax);
        assert.equal(positive.total, 1, `${name}: positive match, skipSyntax=${skipSyntax}`);
        assert.equal(positive.docs[0].doc.id, doc.id);
        const negative = await search(name, "zzzxqv", skipSyntax);
        assert.equal(negative.total, 0, `${name}: negative match, skipSyntax=${skipSyntax}`);
      }
      console.info(`[live] ${name}: positive and negative searches passed with skipSyntax=false/true`);
    }
    for (const skipSyntax of [false, true]) {
      for (const query of ["大学", "北京饭店"]) {
        assert.equal((await search("chineseWord", query, skipSyntax)).total, 0);
        assert.equal((await search("cjk", query, skipSyntax)).total, 1);
      }
      assert.equal((await search("omitted", "world", skipSyntax)).total, 1);
      assert.equal((await search("duplicates", "大学", skipSyntax)).total, 1);
    }
    console.info("[live] Chinese/CJK matching differences, omitted standard analyzer, and duplicate-list indexing passed");
  } catch (error) {
    throw safeError(error);
  } finally {
    creating = false;
  }
});
