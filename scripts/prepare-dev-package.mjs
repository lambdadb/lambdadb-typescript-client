import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Update only a disposable CI checkout; repository version sources stay committed as reviewed. */
export function prepareDevPackage(root, { sha, runId, attempt }) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? "") || !/^[1-9]\d*$/.test(runId ?? "") ||
      !/^[1-9]\d{0,2}$/.test(attempt ?? "")) {
    throw new Error("Require an exact source SHA, positive run ID, and attempt in 1..999");
  }
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (head !== sha) throw new Error("Development source SHA does not match the checked-out commit");
  const paths = ["package.json", "package-lock.json", "examples/package-lock.json", "jsr.json"];
  const [pkg, lock, examples, jsr] = paths.map((path) => JSON.parse(readFileSync(join(root, path), "utf8")));
  const configPath = join(root, "src/lib/config.ts");
  const config = readFileSync(configPath, "utf8");
  const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:dev|rc)\.(0|[1-9]\d*))?$/;
  const match = pattern.exec(pkg.version);
  if (!match) throw new Error("Unsupported committed package version");
  const sdkVersion = /sdkVersion:\s*"([^"]+)"/.exec(config)?.[1];
  if ([lock.version, lock.packages?.[""]?.version, examples.packages?.[".."]?.version,
    jsr.version, sdkVersion].some((version) => version !== pkg.version) ||
    !config.includes(`speakeasy-sdk/typescript ${pkg.version} `)) {
    throw new Error("Committed version sources must agree before generating a development package");
  }
  // GitHub run IDs are unique; attempts give each rerun a new immutable package identity.
  const number = BigInt(runId) * 1000n + BigInt(attempt);
  const version = `${match[1]}.${match[2]}.${match[3]}-dev.${number}`;
  const versionedConfig = config.replace(/(sdkVersion:\s*")[^"]+(")/, (_text, start, end) => `${start}${version}${end}`)
    .replace(`speakeasy-sdk/typescript ${pkg.version} `, `speakeasy-sdk/typescript ${version} `);
  pkg.version = lock.version = lock.packages[""].version = examples.packages[".."].version = jsr.version = version;
  pkg.lambdadbSourceCommit = sha;
  for (const [index, data] of [pkg, lock, examples, jsr].entries()) {
    writeFileSync(join(root, paths[index]), `${JSON.stringify(data, null, 2)}\n`);
  }
  writeFileSync(configPath, versionedConfig);
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.GITHUB_EVENT_NAME !== "push" || process.env.GITHUB_REF !== "refs/heads/develop") {
    throw new Error("Automatic development preparation is only allowed for develop pushes");
  }
  const version = prepareDevPackage(process.cwd(), {
    sha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
  });
  console.log(`Prepared ${version} from ${process.env.GITHUB_SHA}`);
}
