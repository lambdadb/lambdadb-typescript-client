import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

const workflow = readFileSync(new URL("../.github/workflows/publish.yaml", import.meta.url), "utf8");
const metadataScript = workflow.match(/node <<'NODE'\n([\s\S]*?)\n\s+NODE\n/)[1];
const branchScript = workflow.match(/- name: Verify release commit belongs to its channel branch\n[\s\S]*?run: \|\n([\s\S]*?)\n\s+- name:/)[1];

function metadata(version, prerelease, tag = `v${version}`, rootVersion = version) {
  let output = "";
  const modules = {
    "node:fs": {
      readFileSync: () => `sdkVersion: "${version}", userAgent: "speakeasy-sdk/typescript ${version} node"`,
      appendFileSync: (_path, text) => { output += text; },
    },
    "./package.json": { version },
    "./package-lock.json": { version, packages: { "": { version: rootVersion } } },
    "./examples/package-lock.json": { packages: { "..": { version } } },
    "./jsr.json": { version },
  };
  runInNewContext(metadataScript, {
    require: (name) => modules[name], console: { log() {} },
    process: { env: { RELEASE_TAG: tag, RELEASE_PRERELEASE: String(prerelease), GITHUB_OUTPUT: "output" } },
  });
  return Object.fromEntries(output.trim().split("\n").map((line) => line.split("=")));
}

test("release metadata routes dev to develop and keeps RC/stable on main with their dist-tags", () => {
  for (const [version, prerelease, distTag, branch] of [
    ["0.8.0-dev.1", true, "dev", "develop"],
    ["0.8.0-rc.1", true, "rc", "main"],
    ["0.8.0", false, "latest", "main"],
  ]) {
    assert.deepEqual(metadata(version, prerelease), { version, dist_tag: distTag, source_branch: branch });
  }
  assert.ok(workflow.includes("SOURCE_BRANCH: ${{ steps.release.outputs.source_branch }}"));
});

test("release metadata still rejects incorrect prerelease flags, tags, versions and version mismatches", () => {
  for (const [version, flag] of [["0.8.0-dev.1", false], ["0.8.0-rc.1", false], ["0.8.0", true]]) {
    assert.throws(() => metadata(version, flag), /requires GitHub prerelease/);
  }
  assert.throws(() => metadata("0.8.0-dev.1", true, "v0.8.0"), /does not match/);
  assert.throws(() => metadata("0.8.0-beta.1", true), /Unsupported release version/);
  assert.throws(() => metadata("0.8.0-dev.1", true, "v0.8.0-dev.1", "0.7.0"), /expected 0.8.0-dev.1/);
});

test("the actual ancestry guard accepts develop-only dev commits and rejects them for RC/stable", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lambdadb-release-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  function git(...args) {
    const result = spawnSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false",
      "-c", "user.name=Release Test", "-c", "user.email=release-test@example.com", ...args],
    { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git("init", "--initial-branch=main");
  git("commit", "--allow-empty", "-m", "Base");
  const main = git("rev-parse", "HEAD");
  git("checkout", "-b", "develop");
  git("commit", "--allow-empty", "-m", "Development change");
  const develop = git("rev-parse", "HEAD");
  git("checkout", "-b", "feature");
  git("commit", "--allow-empty", "-m", "Unmerged change");
  const feature = git("rev-parse", "HEAD");
  git("remote", "add", "origin", directory);
  for (const [commit, version, prerelease, status] of [
    [develop, "0.8.0-dev.1", true, 0],
    [develop, "0.8.0-rc.1", true, 1],
    [develop, "0.8.0", false, 1],
    [main, "0.8.0-rc.1", true, 0],
    [main, "0.8.0", false, 0],
    [feature, "0.8.0-dev.1", true, 1],
  ]) {
    git("checkout", "--detach", commit);
    const result = spawnSync("bash", ["-e", "-c", branchScript], { cwd: directory, encoding: "utf8",
      env: { ...process.env, SOURCE_BRANCH: metadata(version, prerelease).source_branch } });
    assert.equal(result.status, status, `${version}: ${result.stderr}`);
  }
});
