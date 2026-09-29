import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

import { HTTPClient, LambdaDBClient, ResourceNotFoundError } from "../../dist/esm/index.js";

const options = { timeoutMs: 30_000, retries: { strategy: "none" } };
const digest = (value) => createHash("sha256").update(value).digest("hex");
const bucket = (value, count) => ({ value, count });

// SDK errors may contain authenticated requests or signed download URLs.
function safeError(error) {
  if (error instanceof assert.AssertionError) return error;
  if (Array.isArray(error?.cause?.issues)) {
    const issues = error.cause.issues.map(({ code, path, expected, received }) => {
      const value = path.reduce((parent, key) => parent?.[key], error.rawValue);
      return { code, path, expected, received,
        ...(value === "NaN" || value === "Infinity" || value === "-Infinity" ? { value } : {}) };
    });
    return new Error(`${error.name}; schema issues: ${JSON.stringify(issues)}`);
  }
  if (error?.statusCode === 400 && typeof error?.data$?.message === "string") {
    const message = error.data$.message
      .replaceAll(process.env.LAMBDADB_PROJECT_API_KEY, "[redacted]")
      .replace(/https?:\/\/\S+/g, "[URL redacted]");
    return new Error(`${error.name}; HTTP 400; ${message}`);
  }
  return new Error(`${error?.name ?? "Error"}; HTTP ${error?.statusCode ?? "unavailable"}`);
}

async function eventually(operation, label, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (await operation()) return;
    assert.ok(Date.now() < deadline, `Timed out waiting for ${label}`);
    await delay(2_000);
  }
}

test("live keyword facets, defaults, filters, document downloads, and cleanup", {
  timeout: 900_000,
}, async (t) => {
  for (const name of ["LAMBDADB_BASE_URL", "LAMBDADB_PROJECT_NAME", "LAMBDADB_PROJECT_API_KEY"]) {
    assert.ok(process.env[name], `Missing ${name}; load the intended environment's .env.local`);
  }
  const raw = process.env.LAMBDADB_BASE_URL;
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  const projectName = process.env.LAMBDADB_PROJECT_NAME;
  const server = url.pathname.replace(/\/+$/, "") === `/projects/${encodeURIComponent(projectName)}`
    ? { serverURL: url.toString() }
    : { baseUrl: url.toString(), projectName };
  const collectionName = `ts-facets-${randomUUID()}`;
  let creating = false;
  let created = false;
  let observing = false;
  let wireResponse;
  let downloads = 0;
  const httpClient = new HTTPClient();
  httpClient.addHook("response", async (response) => {
    if (creating && response.status === 201) created = true;
    if (observing && response.ok) wireResponse = await response.clone().json();
  });
  const transferClient = new HTTPClient();
  transferClient.addHook("beforeRequest", (request) => {
    assert.equal(request.method, "GET");
    assert.ok(request.url === wireResponse?.docsUrl, "Download must use the unchanged docsUrl");
    for (const header of ["x-api-key", "authorization", "x-sdk-smoke"]) {
      assert.ok(!request.headers.has(header), `Download must not forward ${header}`);
    }
  });
  transferClient.addHook("response", async (response) => {
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(await response.clone().json()), "docsUrl must return a JSON array");
    downloads++;
  });
  const client = new LambdaDBClient({
    ...server, projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY, httpClient, transferClient,
  });
  const collection = client.collection(collectionName);
  console.info(`[live] Environment ${url.origin}; project ${projectName}; collection ${collectionName}`);
  t.after(async () => {
    creating = false;
    observing = false;
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
    await client.createCollection({
      collectionName,
      description: "TypeScript keyword facet live smoke",
      tags: { purpose: "sdk-smoke" },
      // Java hashCode("a") and hashCode("c") have the same remainder modulo 2.
      // Both logical tenant values therefore share a physical partition.
      partitionConfig: { fieldName: "tenant", dataType: "keyword", numPartitions: 2 },
      indexConfigs: {
        tenant: { type: "keyword" }, tags: { type: "keyword" },
        category: { type: "keyword" },
        meta: { type: "object", objectIndexConfigs: { brand: { type: "keyword" } } },
      },
    }, options);
    creating = false;
    const payload = "x".repeat(3 * 1024 * 1024);
    const docs = Array.from({ length: 12 }, (_, i) => ({
      id: `doc-${String(i).padStart(2, "0")}`,
      tenant: i < 8 ? "a" : "c",
      tags: ["한글", "한글", i < 8 ? "alpha" : "beta"],
      category: `cat${String(i).padStart(2, "0")}`,
      meta: { brand: i < 8 ? "books" : "games" },
      ...(i < 2 ? { payload } : {}),
    }));
    // Separate large writes stay below the request payload limit.
    for (const doc of docs.slice(0, 2)) await collection.docs.upsert({ docs: [doc] }, options);
    await collection.docs.upsert({ docs: [...docs.slice(2), { id: "missing", tenant: "c" }] }, options);
    console.info("[live] Created fresh indexes and wrote 13 documents, including two 3 MiB payloads");

    await eventually(async () => (await collection.docs.fetch({
      ids: docs.map(doc => doc.id).concat("missing"),
      fields: { include: ["id"] }, consistentRead: true,
    }, options)).total === 13, "consistent document visibility");
    console.info("[live] All 13 documents visible with consistentRead=true");

    const check = (name, operation) => t.test(name, async () => {
      try {
        await operation();
      } catch (error) {
        throw safeError(error);
      } finally {
        observing = false;
      }
    });
    const allBuckets = [bucket("한글", 12), bucket("alpha", 8), bucket("beta", 4)];
    for (const consistentRead of [true, false]) {
      if (!consistentRead) {
        console.info("[live] Waiting for committed visibility before ordinary reads");
        await eventually(async () => (await collection.docs.list({
          size: 100, fields: { include: ["id"] },
        }, options)).total === 13, "committed document visibility");
      }
      for (const safe of [false, true]) {
        const query = async input => {
          if (!safe) return collection.query({ ...input, consistentRead }, options);
          const result = await collection.querySafe({ ...input, consistentRead }, options);
          if (!result.ok) throw result.error;
          return result.value;
        };
        const mode = `consistentRead=${consistentRead}, safe=${safe}`;
        for (const size of [undefined, null]) {
          await check(`default facet size=${size}; ${mode}`, async () => {
            const response = await query({ size: 0, facets: { category: { size }, tags: {} } });
            assert.equal(response.total, 0);
            assert.deepEqual(response.docs, []);
            assert.deepEqual(response.facets.category.buckets, docs.slice(0, 10).map(doc => bucket(doc.category, 1)));
            assert.deepEqual(response.facets.tags.buckets, allBuckets);
          });
        }
        await check(`facet and document limits; ${mode}`, async () => {
          const limited = await query({ size: 1, fields: { include: ["id"] }, facets: { tags: { size: 1 } } });
          assert.equal(limited.total, 1);
          assert.equal(limited.docs.length, 1);
          assert.deepEqual(limited.facets.tags.buckets, allBuckets.slice(0, 1));
        });
        for (const size of [0, 1]) {
          await check(`partition filter with query size=${size}; ${mode}`, async () => {
            const filtered = await query({
              size, fields: { include: ["id", "tenant"] },
              partitionFilter: { field: "tenant", in: ["a"] }, facets: { tags: {} },
            });
            assert.equal(filtered.total, size);
            assert.deepEqual(filtered.facets.tags.buckets, [bucket("alpha", 8), bucket("한글", 8)]);
            assert.ok(filtered.docs.every(({ doc }) => doc.tenant === "a"));
          });
        }
        await check(`query filter and dotted facet path; ${mode}`, async () => {
          const filtered = await query({
            size: 0, query: { queryString: { query: "category:cat00" } },
            facets: { tags: {}, "meta.brand": {} },
          });
          assert.deepEqual(filtered.facets.tags.buckets, [bucket("alpha", 1), bucket("한글", 1)]);
          assert.deepEqual(filtered.facets["meta.brand"].buckets, [bucket("books", 1)]);
        });
        await check(`empty buckets; ${mode}`, async () => {
          const empty = await query({ size: 0, query: { queryString: { query: "category:absent" } }, facets: { tags: {} } });
          assert.deepEqual(empty.facets.tags.buckets, []);
        });
        await check(`omitted facets; ${mode}`, async () => {
          const ordinary = await query({ size: 1, fields: { include: ["id"] } });
          assert.equal(ordinary.facets, undefined);
        });
      }
    }

    for (const safe of [false, true]) {
      await check(`docsUrl download and facets; safe=${safe}`, async () => {
        const input = {
          size: 2, query: { queryString: { query: "category:cat00 OR category:cat01" } },
          facets: { tags: { size: null } },
        };
        wireResponse = undefined;
        downloads = 0;
        observing = true;
        const result = safe
          ? await collection.querySafe(input, { ...options, headers: { "x-sdk-smoke": "api-only" } })
          : await collection.query(input, { ...options, headers: { "x-sdk-smoke": "api-only" } });
        observing = false;
        if (safe && !result.ok) throw result.error;
        const response = safe ? result.value : result;
        assert.equal(wireResponse?.isDocsInline, false, "Server must actually offload documents");
        assert.deepEqual(wireResponse.docs, []);
        assert.equal(downloads, 1);
        assert.equal(response.isDocsInline, true);
        assert.equal(response.total, 2);
        assert.deepEqual(response.docs.map(({ doc }) => doc.id).sort(), ["doc-00", "doc-01"]);
        assert.deepEqual(response.facets, { tags: { buckets: [bucket("alpha", 2), bucket("한글", 2)] } });
        assert.deepEqual(response.facets, wireResponse.facets);
        for (const { doc } of response.docs) assert.equal(digest(doc.payload), digest(payload));
        console.info(`[live] Real docsUrl array download, payload hashes, facet preservation, and header isolation passed; safe=${safe}`);
      });
    }
  } catch (error) {
    throw safeError(error);
  } finally {
    creating = false;
    observing = false;
  }
});
