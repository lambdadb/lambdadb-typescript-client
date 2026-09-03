import assert from "node:assert/strict";
import test from "node:test";

import {
  LambdaDBClient,
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
  aliasRef,
  branchRef,
  branchSource,
  tagRef,
  tagTarget,
} from "../../dist/esm/index.js";

const requiredEnvironment = [
  "LAMBDADB_BASE_URL",
  "LAMBDADB_PROJECT_NAME",
  "LAMBDADB_PROJECT_API_KEY",
];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function eventually(operation, description, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await delay(1_000);
    }
  }
  throw new Error(`Timed out waiting for ${description}`, { cause: lastError });
}

test("live Data Versioning lifecycle, reads, writes, bulk upload, and cleanup", {
  skip: missingEnvironment.length === 0
    ? false
    : `Missing ${missingEnvironment.join(", ")} in .env.local`,
  timeout: 240_000,
}, async () => {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const collectionName = `ts-dv-${suffix}`.slice(0, 52);
  const client = new LambdaDBClient({
    baseUrl: process.env.LAMBDADB_BASE_URL,
    projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY,
    projectName: process.env.LAMBDADB_PROJECT_NAME,
  });
  const collection = client.collection(collectionName);
  let created = false;
  let primaryError;

  try {
    const createResponse = await client.createCollection({
      collectionName,
      description: "TypeScript Data Versioning live smoke",
      tags: { purpose: "sdk-smoke" },
      snapshotRetentionInDays: 7,
      indexConfigs: {
        title: { type: "keyword" },
      },
    });
    created = true;
    assert.equal(createResponse.collection.collectionName, collectionName);
    assert.equal(createResponse.collection.defaultBranchName, "main");
    assert.ok(createResponse.collection.createdAt instanceof Date);

    const metadata = await eventually(async () => {
      const response = await collection.get();
      assert.equal(response.collection.description, "TypeScript Data Versioning live smoke");
      return response;
    }, "Collection readiness");
    assert.equal(metadata.collection.tags.purpose, "sdk-smoke");
    assert.equal(metadata.collection.snapshotRetentionInDays, 7);
    assert.equal(metadata.collection.defaultBranchName, "main");
    assert.ok(metadata.collection.createdAt.getTime() > 1_000_000_000_000);

    const main = await collection.docs.list({ size: 1 });
    assert.equal(main.total, 0);

    await collection.branches.create({ branchName: "candidate" });
    await collection.docs.upsert({
      branch: "candidate",
      docs: [
        { id: "doc-1", title: "one" },
        { id: "doc-2", title: "two" },
        { id: "doc-3", title: "three" },
      ],
    });

    await eventually(async () => {
      const response = await collection.docs.fetch({
        ids: ["doc-1", "doc-2", "doc-3"],
        ref: branchRef("candidate"),
        consistentRead: true,
      });
      assert.equal(response.total, 3);
      return response;
    }, "Branch write visibility");

    await collection.tags.create({
      tagName: "release-001",
      source: branchSource("candidate"),
    });
    await collection.aliases.create({
      aliasName: "production",
      target: tagTarget("release-001"),
    });
    await collection.branches.create({
      branchName: "recovery-check",
      source: branchSource("candidate", new Date(Date.now() + 1_000)),
    });

    for (const ref of [
      branchRef("candidate"),
      tagRef("release-001"),
      aliasRef("production"),
    ]) {
      let pageCount = 0;
      let documentCount = 0;
      for await (const page of collection.docs.listPages({ size: 1, ref })) {
        pageCount += 1;
        documentCount += page.docs.length;
      }
      assert.ok(pageCount >= 2);
      assert.equal(documentCount, 3);
    }

    const duplicate = await collection.branches.createSafe({ branchName: "candidate" });
    assert.equal(duplicate.ok, false);
    assert.ok(duplicate.error instanceof ResourceAlreadyExistsError);

    await collection.tags.delete("release-001");
    await eventually(async () => {
      const response = await collection.aliases.list();
      const alias = response.aliases.find((item) => item.aliasName === "production");
      assert.equal(alias?.dangling, true);
      return alias;
    }, "dangling Alias state");

    const danglingRead = await collection.docs.fetchSafe({
      ids: ["doc-1"],
      ref: aliasRef("production"),
    });
    assert.equal(danglingRead.ok, false);
    assert.ok(danglingRead.error instanceof ResourceNotFoundError);

    await collection.aliases.retarget("production", {
      target: { kind: "branch", name: "candidate" },
    });
    const restoredRead = await collection.docs.fetch({
      ids: ["doc-1"],
      ref: aliasRef("production"),
    });
    assert.equal(restoredRead.total, 1);

    await collection.docs.bulkUpsertDocs({
      branch: "candidate",
      docs: [{ id: "bulk-1", title: "bulk" }],
    });
    await eventually(async () => {
      const response = await collection.docs.fetch({
        ids: ["bulk-1"],
        ref: branchRef("candidate"),
        consistentRead: true,
      });
      assert.equal(response.total, 1);
      return response;
    }, "signed bulk upload visibility");

    const updated = await collection.update({
      description: "Updated by TypeScript Data Versioning smoke",
      tags: { purpose: "sdk-smoke", state: "updated" },
      snapshotRetentionInDays: 8,
    });
    assert.equal(updated.collection.snapshotRetentionInDays, 8);
    assert.equal(updated.collection.tags.state, "updated");
    assert.ok(updated.collection.updatedAt instanceof Date);
  } catch (error) {
    primaryError = error;
  } finally {
    if (created) {
      try {
        await collection.delete();
      } catch (cleanupError) {
        console.error(`Cleanup failed for Collection ${collectionName}`);
        if (primaryError === undefined) primaryError = cleanupError;
      }
    }
  }

  if (primaryError !== undefined) throw primaryError;
});
