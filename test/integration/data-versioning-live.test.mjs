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

function liveServerOptions(rawBaseUrl, projectName) {
  const value = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawBaseUrl)
    ? rawBaseUrl
    : `https://${rawBaseUrl}`;
  const url = new URL(value);
  const normalizedPath = url.pathname.replace(/\/+$/, "");
  const projectPath = `/projects/${encodeURIComponent(projectName)}`;
  if (normalizedPath === projectPath) {
    return { serverURL: url.toString() };
  }
  return { baseUrl: url.toString(), projectName };
}

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
    ...liveServerOptions(
      process.env.LAMBDADB_BASE_URL,
      process.env.LAMBDADB_PROJECT_NAME,
    ),
    projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY,
  });
  const collection = client.collection(collectionName);
  let created = false;
  let primaryError;
  let deploymentContractMismatch;

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

    await collection.docs.upsert({
      docs: [
        { id: "doc-1", title: "one" },
        { id: "doc-2", title: "two" },
        { id: "doc-3", title: "three" },
      ],
    });
    await eventually(async () => {
      const response = await collection.docs.fetch({
        ids: ["doc-1", "doc-2", "doc-3"],
        consistentRead: true,
      });
      assert.equal(response.total, 3);
      return response;
    }, "main Branch snapshot");

    await eventually(async () => {
      const response = await collection.docs.listAll({ size: 1 });
      assert.equal(response.docs.length, 3);
      return response;
    }, "main Branch list visibility");

    await collection.branches.create({
      branchName: "candidate",
      source: branchSource("main"),
    });
    await collection.docs.upsert({
      branch: "candidate",
      docs: [{ id: "doc-4", title: "four" }],
    });
    await collection.docs.update({
      branch: "candidate",
      docs: [{ id: "doc-1", title: "one-candidate" }],
    });
    await collection.docs.delete({
      branch: "candidate",
      ids: ["doc-3"],
    });

    await eventually(async () => {
      const response = await collection.docs.fetch({
        ids: ["doc-1", "doc-2", "doc-3", "doc-4"],
        ref: branchRef("candidate"),
        consistentRead: true,
      });
      assert.equal(response.total, 3);
      assert.equal(
        response.docs.find((item) => item.doc.id === "doc-1")?.doc.title,
        "one-candidate",
      );
      assert.equal(
        response.docs.some((item) => item.doc.id === "doc-3"),
        false,
      );
      assert.equal(
        response.docs.some((item) => item.doc.id === "doc-4"),
        true,
      );
      return response;
    }, "Branch write visibility");

    const unchangedMain = await collection.docs.fetch({
      ids: ["doc-1", "doc-3", "doc-4"],
      consistentRead: true,
    });
    assert.equal(unchangedMain.total, 2);
    assert.equal(
      unchangedMain.docs.find((item) => item.doc.id === "doc-1")?.doc.title,
      "one",
    );
    assert.equal(
      unchangedMain.docs.some((item) => item.doc.id === "doc-3"),
      true,
    );
    assert.equal(
      unchangedMain.docs.some((item) => item.doc.id === "doc-4"),
      false,
    );

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
    if (!(danglingRead.error instanceof ResourceNotFoundError)) {
      deploymentContractMismatch = new Error(
        `Expected ResourceNotFoundError for dangling Alias read; received ${danglingRead.error?.constructor?.name ?? "unknown"} with status ${danglingRead.error?.statusCode ?? "unknown"}`,
      );
    }

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

    if (deploymentContractMismatch !== undefined) {
      throw deploymentContractMismatch;
    }
  } catch (error) {
    primaryError = error;
  } finally {
    if (created) {
      try {
        await collection.delete();
        await eventually(async () => {
          const result = await collection.getSafe();
          if (result.ok) throw new Error("Collection still exists");
          if (!(result.error instanceof ResourceNotFoundError)) throw result.error;
          return result;
        }, "Collection cleanup", 30_000);
      } catch (cleanupError) {
        console.error(`Cleanup failed for Collection ${collectionName}`);
        if (primaryError === undefined) primaryError = cleanupError;
      }
    }
  }

  if (primaryError !== undefined) throw primaryError;
});
