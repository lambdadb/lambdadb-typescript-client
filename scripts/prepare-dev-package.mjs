import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compareCores, latestStableTag, parseVersion, readVersion, setVersion, COMMITTED_VERSION, PUBLISHED_VERSION } from "./version.mjs";

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

/**
 * Update only a disposable CI checkout; repository version sources stay committed as reviewed.
 * The committed version is the last released RC or stable version. The development version
 * continues from it: `X.Y.Z-rc.N` becomes `X.Y.Z-dev.M` and `X.Y.Z` becomes `X.Y.(Z+1)-dev.M`,
 * where M counts first-parent commits since the newest stable release tag reachable from the commit.
 * Returns undefined, changing nothing, for the tagged stable release commit itself (M = 0): a rerun
 * of its main push after tagging has no development version, and its Release publishes it.
 */
export function prepareDevPackage(root, { sha }) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("Require an exact source SHA");
  if (git(root, ["rev-parse", "HEAD"]) !== sha) {
    throw new Error("Development source SHA does not match the checked-out commit");
  }
  const committed = readVersion(root);
  if (!COMMITTED_VERSION.test(committed)) {
    throw new Error(`Development builds require a committed RC or stable version, found ${committed}`);
  }
  const { core: [major, minor, patch], channel, text } = parseVersion(committed);
  const base = channel === "stable" ? `${major}.${minor}.${patch + 1}` : text;
  const tag = latestStableTag(git(root, ["tag", "--merged", "HEAD", "--list", "v*"]).split("\n").filter(Boolean));
  if (tag && compareCores(parseVersion(base).core, parseVersion(tag.slice(1)).core) <= 0) {
    throw new Error(`Development version ${base}-dev.N from committed ${committed} must be newer than ` +
      `the latest stable release ${tag}`);
  }
  const count = Number(git(root, ["rev-list", "--count", "--first-parent", tag ? `${tag}..HEAD` : "HEAD"]));
  if (count === 0 && channel === "stable" && tag === `v${committed}`) return undefined;
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Expected at least one commit since the latest release");
  const version = setVersion(root, `${base}-dev.${count}`, { allowed: PUBLISHED_VERSION });
  const pkgPath = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.lambdadbSourceCommit = sha;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.GITHUB_EVENT_NAME !== "push" || process.env.GITHUB_REF !== "refs/heads/main") {
    throw new Error("Automatic development preparation is only allowed for main pushes");
  }
  const version = prepareDevPackage(process.cwd(), { sha: process.env.GITHUB_SHA });
  if (version) {
    console.log(`Prepared ${version} from ${process.env.GITHUB_SHA}`);
  } else {
    console.log(`::notice title=Development publication skipped::${process.env.GITHUB_SHA} is the tagged stable ` +
      `release v${readVersion(process.cwd())}; there is no development version to build or publish.`);
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ready=${version ? "true" : "false"}\n`);
}
