import assert from "node:assert/strict";
import test from "node:test";

import {
  BadRequestError,
  CatalogConflictError,
  LambdaDBClient,
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
  aliasRef,
  branchRef,
  branchSource,
  tagRef,
  tagSource,
  tagTarget,
} from "../../dist/esm/index.js";

const requiredEnvironment = [
  "LAMBDADB_BASE_URL",
  "LAMBDADB_PROJECT_NAME",
  "LAMBDADB_PROJECT_API_KEY",
];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);

// List and ordinary Fetch wait for committed data; a commit can take over 90 seconds.
const COMMIT_TIMEOUT_MS = 300_000;

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
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await operation();
      console.info(`[live] ${description}: passed after ${Date.now() - startedAt} ms`);
      return result;
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
  // Allow each committed-data phase and cleanup to finish within the test budget.
  timeout: 1_200_000,
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

    // Default source remains main, including when its head is empty.
    const { branch: empty } = await collection.branches.create({ branchName: "empty-probe" });
    assert.equal(empty.parentBranch.name, "main");
    assert.equal(typeof empty.parentBranch.branchId, "string");
    assert.equal(empty.headSnapshot, null);
    assert.equal(empty.parentSnapshot, null);
    const { branches: initialBranches } = await collection.branches.list();
    assert.equal(initialBranches.find((branch) => branch.name === "main").parentBranch, null);
    assert.deepEqual(initialBranches.find((branch) => branch.name === "empty-probe"), empty);
    await collection.branches.delete("empty-probe");

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
    }, "main Branch pending-write visibility");

    await eventually(async () => {
      const response = await collection.docs.listAll({ size: 1 });
      assert.equal(response.docs.length, 3);
      return response;
    }, "main Branch committed list visibility", COMMIT_TIMEOUT_MS);

    const { branch: createdCandidate } = await collection.branches.create({
      branchName: "candidate",
      source: branchSource("main"),
    });
    assert.equal(createdCandidate.parentBranch.name, "main");
    // Candidate still shares main's snapshot: the direct source must be candidate.
    const inherited = await collection.branches.createSafe({
      branchName: "inherited-probe",
      source: branchSource("candidate", Date.now() + 1_000),
    });
    assert.equal(inherited.ok, true);
    assert.equal(inherited.value.branch.parentBranch.name, "candidate");
    assert.equal(typeof inherited.value.branch.parentBranch.branchId, "string");
    assert.equal(inherited.value.branch.headSnapshot.snapshotId, createdCandidate.headSnapshot.snapshotId);
    const inheritedList = await collection.branches.listSafe();
    assert.equal(inheritedList.ok, true);
    assert.deepEqual(inheritedList.value.branches.find((branch) => branch.name === "inherited-probe"), inherited.value.branch);
    await collection.branches.delete("inherited-probe");
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

    // Tag creation pins committed data, so pending-write visibility is insufficient.
    await eventually(async () => {
      const response = await collection.docs.fetch({
        ids: ["doc-1", "doc-2", "doc-3", "doc-4"],
        ref: branchRef("candidate"),
        consistentRead: false,
      });
      assert.equal(response.total, 3);
      assert.equal(response.docs.find((item) => item.doc.id === "doc-1")?.doc.title, "one-candidate");
      assert.equal(response.docs.some((item) => item.doc.id === "doc-3"), false);
      assert.equal(response.docs.some((item) => item.doc.id === "doc-4"), true);
    }, "committed Branch data before tagging", COMMIT_TIMEOUT_MS);

    const { tag } = await collection.tags.create({
      tagName: "release-001",
      source: branchSource("candidate"),
    });
    assert.equal(typeof tag.snapshotId, "string");
    assert.ok(tag.snapshotCommittedAt instanceof Date);
    assert.ok(tag.createdAt instanceof Date);
    const copiedTag = await collection.tags.createSafe({
      tagName: "release-copy",
      source: tagSource("release-001"),
    });
    assert.equal(copiedTag.ok, true);
    assert.equal(copiedTag.value.tag.snapshotId, tag.snapshotId);
    await collection.tags.delete("release-copy");
    const { branches } = await collection.branches.list();
    const candidate = branches.find((branch) => branch.name === "candidate");
    assert.deepEqual(candidate.parentBranch, createdCandidate.parentBranch);
    assert.ok(candidate.headSnapshot.snapshotCommittedAt instanceof Date);
    assert.ok(candidate.parentSnapshot.snapshotCommittedAt instanceof Date);
    assert.equal(branches.find((branch) => branch.name === "main").parentSnapshot, null);

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

    const referencedTag = await collection.tags.deleteSafe("release-001");
    assert.equal(referencedTag.ok, false);
    assert.ok(referencedTag.error instanceof CatalogConflictError);
    const aliases = await collection.aliases.list();
    assert.equal(aliases.aliases.find((item) => item.aliasName === "production")?.dangling, false);
    const aliasRead = await collection.docs.fetch({ ids: ["doc-1"], ref: aliasRef("production") });
    assert.equal(aliasRead.total, 1);

    const missingRefRead = await collection.docs.fetchSafe({
      ids: ["doc-1"],
      ref: aliasRef("missing-alias"),
    });
    assert.equal(missingRefRead.ok, false);
    assert.ok(missingRefRead.error instanceof ResourceNotFoundError);

    await collection.aliases.retarget("production", {
      target: { kind: "branch", name: "candidate" },
    });
    await collection.tags.delete("release-001");
    const referencedBranch = await collection.branches.deleteSafe("candidate");
    assert.equal(referencedBranch.ok, false);
    assert.ok(referencedBranch.error instanceof CatalogConflictError);
    const defaultBranch = await collection.branches.deleteSafe("main");
    assert.equal(defaultBranch.ok, false);
    assert.ok(defaultBranch.error instanceof BadRequestError);
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
        consistentRead: false,
      });
      assert.equal(response.total, 1);
      return response;
    }, "signed bulk upload committed visibility", COMMIT_TIMEOUT_MS);

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
