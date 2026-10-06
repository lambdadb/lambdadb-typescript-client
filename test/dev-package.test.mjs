import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { prepareDevPackage } from "../scripts/prepare-dev-package.mjs";

function fixture(t, version = "0.8.0") {
  const root = mkdtempSync(join(tmpdir(), "lambdadb-dev-package-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "examples"));
  mkdirSync(join(root, "src/lib"), { recursive: true });
  const files = {
    "package.json": { name: "test-package", version, description: "Keep metadata" },
    "package-lock.json": { version, packages: { "": { version }, "node_modules/example": { version: "1.2.3" } } },
    "examples/package-lock.json": { version: "1.0.0", packages: { "..": { version } } },
    "jsr.json": { version, exports: { ".": "./src/index.ts" } },
  };
  for (const [path, value] of Object.entries(files)) writeFileSync(join(root, path), JSON.stringify(value));
  writeFileSync(join(root, "src/lib/config.ts"), `export const SDK_METADATA = {
  sdkVersion: "${version}", userAgent: "speakeasy-sdk/typescript ${version} node", language: "typescript",
};\n`);
  execFileSync("git", ["init", "--initial-branch=develop"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["-c", "user.name=Release Test", "-c", "user.email=release-test@example.com",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-m", "Source"],
  { cwd: root, stdio: "ignore" });
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const inputs = { sha, runId: "42", attempt: "1" };
  const json = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
  const snapshot = () => Object.fromEntries([...Object.keys(files), "src/lib/config.ts"].map((path) =>
    [path, readFileSync(join(root, path), "utf8")]));
  return { root, sha, inputs, json, snapshot };
}

test("automatic dev versions align all metadata and preserve dependency versions and source identity", (t) => {
  for (const source of ["0.8.0", "0.8.0-rc.1", "0.8.0-dev.7"]) {
    const f = fixture(t, source);
    assert.equal(prepareDevPackage(f.root, f.inputs), "0.8.0-dev.42001");
    assert.deepEqual(f.json("package.json"), { name: "test-package", version: "0.8.0-dev.42001",
      description: "Keep metadata", lambdadbSourceCommit: f.sha });
    assert.deepEqual(f.json("package-lock.json"), { version: "0.8.0-dev.42001", packages: {
      "": { version: "0.8.0-dev.42001" }, "node_modules/example": { version: "1.2.3" },
    } });
    assert.deepEqual(f.json("examples/package-lock.json"), { version: "1.0.0", packages: { "..": { version: "0.8.0-dev.42001" } } });
    assert.equal(f.json("jsr.json").version, "0.8.0-dev.42001");
    assert.ok(readFileSync(join(f.root, "src/lib/config.ts"), "utf8").includes('sdkVersion: "0.8.0-dev.42001"'));
    assert.ok(readFileSync(join(f.root, "src/lib/config.ts"), "utf8").includes("speakeasy-sdk/typescript 0.8.0-dev.42001 node"));
    assert.equal(prepareDevPackage(f.root, { ...f.inputs, attempt: "2" }), "0.8.0-dev.42002");
    assert.equal(prepareDevPackage(f.root, { ...f.inputs, runId: "43" }), "0.8.0-dev.43001");
  }
});

test("invalid source identity or run inputs fail without changing version files", (t) => {
  const f = fixture(t);
  const before = f.snapshot();
  for (const override of [{ sha: "b".repeat(40) }, { sha: "bad" }, { runId: "0" }, { runId: "01" },
    { runId: "42\n" }, { attempt: "0" }, { attempt: "1000" }]) {
    assert.throws(() => prepareDevPackage(f.root, { ...f.inputs, ...override }));
    assert.deepEqual(f.snapshot(), before);
  }
});

test("mismatched committed versions are not silently repaired", (t) => {
  const f = fixture(t);
  const lock = f.json("package-lock.json");
  lock.packages[""].version = "0.7.0";
  writeFileSync(join(f.root, "package-lock.json"), JSON.stringify(lock));
  const before = f.snapshot();
  assert.throws(() => prepareDevPackage(f.root, f.inputs), /Committed version sources must agree/);
  assert.deepEqual(f.snapshot(), before);
});

test("the preparation CLI rejects non-develop events before mutation", (t) => {
  const f = fixture(t);
  const before = f.snapshot();
  const script = fileURLToPath(new URL("../scripts/prepare-dev-package.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], { cwd: f.root, encoding: "utf8", env: {
    ...process.env, GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/heads/develop",
    GITHUB_SHA: f.sha, GITHUB_RUN_ID: "42", GITHUB_RUN_ATTEMPT: "1",
  } });
  assert.notEqual(result.status, 0);
  assert.deepEqual(f.snapshot(), before);
});
