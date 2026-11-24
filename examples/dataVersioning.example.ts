import dotenv from "dotenv";
dotenv.config();

import {
  LambdaDBClient,
  aliasRef,
  branchRef,
  branchSource,
  tagRef,
  tagSource,
  tagTarget,
} from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  baseUrl: process.env.LAMBDADB_BASE_URL ?? "https://api.lambdadb.ai",
  projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY ?? "<YOUR_PROJECT_API_KEY>",
  projectName: process.env.LAMBDADB_PROJECT_NAME ?? "playground",
});

async function main() {
  const collection = client.collection("my-collection");

  // Branch and Tag sources are accepted. Omitting source selects main;
  // branchSource("main", new Date(...)) selects a retained point-in-time snapshot.
  const { branch } = await collection.branches.create({
    branchName: "candidate",
    source: branchSource("main"),
  });
  // Direct source identity can exist even when both snapshots are null.
  console.log(branch.parentBranch?.branchId, branch.parentBranch?.name);
  // list returns every Branch; listPage({ size, pageToken }) returns one page.
  const { branches } = await collection.branches.list();
  console.log(branches.map(({ name, parentBranch }) => ({ name, parentBranch })));

  await collection.docs.upsert({
    branch: "candidate",
    docs: [{ id: "doc-1", text: "Candidate content" }],
  });

  // Wait for the written content to be visible in a committed snapshot.
  let committed = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await collection.docs.fetch({
      ids: ["doc-1"],
      ref: branchRef("candidate"),
    });
    if (result.docs.some(({ doc }) => doc.id === "doc-1" && doc.text === "Candidate content")) {
      committed = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (!committed) throw new Error("candidate data was not committed in time");

  const { branch: current } = await collection.branches.get("candidate");
  if (current.headSnapshot === null) throw new Error("candidate has no committed snapshot");

  // Use asOf to tag just the committed data for a stable export.
  await collection.tags.create({
    tagName: "release-001",
    source: branchSource("candidate", current.headSnapshot.snapshotCommittedAt),
  });
  // A Tag can also copy the fixed state of another Tag.
  await collection.tags.create({
    tagName: "release-copy",
    source: tagSource("release-001"),
  });
  await collection.aliases.create({
    aliasName: "production",
    target: tagTarget("release-001"),
  });

  await collection.docs.fetch({
    ids: ["doc-1"],
    ref: aliasRef("production"),
  });

  // Use the same asOf Tag and listing options on every page.
  for await (const page of collection.docs.listPages({
    size: 50,
    ref: tagRef("release-001"),
  })) {
    console.log(page.docs);
  }
}

main().catch(console.error);
