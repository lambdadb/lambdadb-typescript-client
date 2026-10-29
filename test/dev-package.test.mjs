import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { prepareDevPackage } from "../scripts/prepare-dev-package.mjs";
import { nextDevVersion, readVersion, setVersion } from "../scripts/version.mjs";

const paths = ["package.json", "package-lock.json", "examples/package-lock.json", "jsr.json", "src/lib/config.ts"];

function fixture(t, version = "0.8.1-dev.0") {
  const root = mkdtempSync(join(tmpdir(), "lambdadb-dev-package-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "examples"));
  mkdirSync(join(root, "src/lib"), { recursive: true });
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(join(root, "package.json"), json({ name: "test-package", version, description: "Keep metadata" }));
  writeFileSync(join(root, "package-lock.json"), json({ name: "test-package", version, packages: {
    "": { name: "test-package", version }, "node_modules/example": { version: "1.2.3" },
  } }));
  writeFileSync(join(root, "examples/package-lock.json"), json({ version: "1.0.0", packages: { "..": { version } } }));
  // jsr.json keeps its unusual formatting (leading blank lines, trailing spaces).
  writeFileSync(join(root, "jsr.json"),
    `\n\n{\n  "name": "test-package",\n  "version": "${version}",\n  "exports": {\n    ".": "./src/index.ts"    \n  }\n}\n`);
  writeFileSync(join(root, "src/lib/config.ts"), `export const SDK_METADATA = {
  sdkVersion: "${version}", userAgent: "speakeasy-sdk/typescript ${version} node", language: "typescript",
};\n`);
  const git = (...args) => execFileSync("git", ["-c", "user.name=Release Test", "-c", "user.email=release-test@example.com",
    "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args],
  { cwd: root, encoding: "utf8" }).trim();
  git("init", "--initial-branch=main");
  const commit = (message) => { git("add", "-A"); git("commit", "--allow-empty", "-m", message); return git("rev-parse", "HEAD"); };
  const snapshot = () => Object.fromEntries(paths.map((path) => [path, readFileSync(join(root, path), "utf8")]));
  const read = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
  return { root, git, commit, snapshot, read };
}

test("dev builds count first-parent commits since the newest stable tag and record the source commit", (t) => {
  const f = fixture(t, "0.8.0");
  f.commit("Release 0.8.0");
  f.git("tag", "v0.8.0");
  setVersion(f.root, "0.8.1-dev.0");
  f.commit("Next development version");
  let sha = f.commit("Feature");
  const before = f.snapshot();
  assert.equal(prepareDevPackage(f.root, { sha }), "0.8.1-dev.2");
  assert.equal(readVersion(f.root), "0.8.1-dev.2");
  assert.deepEqual(f.read("package.json"), { name: "test-package", version: "0.8.1-dev.2",
    description: "Keep metadata", lambdadbSourceCommit: sha });
  assert.equal(f.read("package-lock.json").packages["node_modules/example"].version, "1.2.3");
  assert.equal(f.read("examples/package-lock.json").version, "1.0.0");
  assert.ok(f.snapshot()["jsr.json"].startsWith("\n\n{"), "jsr.json formatting is preserved");

  // The same commit always maps to the same version.
  for (const [path, text] of Object.entries(before)) writeFileSync(join(f.root, path), text);
  assert.equal(prepareDevPackage(f.root, { sha }), "0.8.1-dev.2");

  // RC tags do not reset the count; the next stable tag does.
  for (const [path, text] of Object.entries(before)) writeFileSync(join(f.root, path), text);
  setVersion(f.root, "0.8.1-rc.1");
  f.commit("Release 0.8.1-rc.1");
  f.git("tag", "v0.8.1-rc.1");
  setVersion(f.root, "0.8.1-dev.0");
  sha = f.commit("Back to development");
  assert.equal(prepareDevPackage(f.root, { sha }), "0.8.1-dev.4");

  setVersion(f.root, "0.8.1-dev.0");
  setVersion(f.root, "0.8.1");
  f.commit("Release 0.8.1");
  f.git("tag", "v0.8.1");
  setVersion(f.root, "0.9.0-dev.0");
  sha = f.commit("Next development version");
  assert.equal(prepareDevPackage(f.root, { sha }), "0.9.0-dev.1");
});

test("without a stable tag the count starts at the root commit", (t) => {
  const f = fixture(t, "0.1.0-dev.0");
  f.commit("Initial");
  const sha = f.commit("Second");
  assert.equal(prepareDevPackage(f.root, { sha }), "0.1.0-dev.2");
});

test("dev builds reject non-placeholder versions, regressions, mismatches and wrong commits without mutation", (t) => {
  for (const version of ["0.8.0", "0.8.0-rc.1"]) {
    const f = fixture(t, version);
    const sha = f.commit("Release commit");
    const before = f.snapshot();
    assert.throws(() => prepareDevPackage(f.root, { sha }), /require a committed X\.Y\.Z-dev\.0/);
    assert.deepEqual(f.snapshot(), before);
  }

  const regressed = fixture(t, "0.8.0");
  regressed.commit("Release 0.8.0");
  regressed.git("tag", "v0.8.0");
  setVersion(regressed.root, "0.8.0-dev.0");
  let sha = regressed.commit("Forgot to bump");
  let before = regressed.snapshot();
  assert.throws(() => prepareDevPackage(regressed.root, { sha }), /must be newer than the latest stable release v0\.8\.0/);
  assert.deepEqual(regressed.snapshot(), before);

  const mismatched = fixture(t);
  const lock = mismatched.read("package-lock.json");
  lock.packages[""].version = "0.7.0";
  writeFileSync(join(mismatched.root, "package-lock.json"), JSON.stringify(lock));
  sha = mismatched.commit("Mismatch");
  before = mismatched.snapshot();
  assert.throws(() => prepareDevPackage(mismatched.root, { sha }), /Version sources must agree/);
  assert.deepEqual(mismatched.snapshot(), before);

  const wrong = fixture(t);
  wrong.commit("Source");
  before = wrong.snapshot();
  for (const value of ["b".repeat(40), "bad", undefined]) {
    assert.throws(() => prepareDevPackage(wrong.root, { sha: value }));
    assert.deepEqual(wrong.snapshot(), before);
  }
});

test("the preparation CLI only runs for main pushes", (t) => {
  const f = fixture(t);
  const sha = f.commit("Source");
  const before = f.snapshot();
  const script = fileURLToPath(new URL("../scripts/prepare-dev-package.mjs", import.meta.url));
  for (const [event, ref] of [["pull_request", "refs/heads/main"], ["push", "refs/heads/develop"], ["release", "refs/tags/v0.8.1"]]) {
    const result = spawnSync(process.execPath, [script], { cwd: f.root, encoding: "utf8", env: {
      ...process.env, GITHUB_EVENT_NAME: event, GITHUB_REF: ref, GITHUB_SHA: sha,
    } });
    assert.notEqual(result.status, 0);
    assert.deepEqual(f.snapshot(), before);
  }
});

test("set-version accepts only committed forms and next-dev follows RC and stable releases", (t) => {
  const f = fixture(t);
  for (const version of ["0.8.1-dev.3", "0.8.1-dev", "0.8.1-beta.1", "v0.8.1", "0.8.1-rc.0"]) {
    assert.throws(() => setVersion(f.root, version), /Unsupported version/);
  }
  assert.equal(setVersion(f.root, "0.8.1-rc.2"), "0.8.1-rc.2");
  assert.equal(setVersion(f.root, "1.0.0"), "1.0.0");
  assert.equal(nextDevVersion("0.8.1-rc.2"), "0.8.1-dev.0");
  assert.equal(nextDevVersion("0.8.1"), "0.8.2-dev.0");
  assert.throws(() => nextDevVersion("0.8.1-dev.4"), /Expected an RC or stable version/);
});
