import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { prepareDevPackage } from "../scripts/prepare-dev-package.mjs";
import { compareVersions, readVersion, setVersion } from "../scripts/version.mjs";

const paths = ["package.json", "package-lock.json", "examples/package-lock.json", "jsr.json", "src/lib/config.ts"];

function fixture(t, version = "0.8.0") {
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

test("dev builds continue from the committed release and count first-parent commits since the newest stable tag", (t) => {
  const f = fixture(t, "0.8.0");
  f.commit("Release 0.8.0");
  f.git("tag", "v0.8.0");
  f.commit("Feature");
  let sha = f.commit("Fix");
  const before = f.snapshot();
  // A stable committed version continues as the next patch.
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

  // An RC continues with the same core, below the RC; RC tags do not reset the count.
  for (const [path, text] of Object.entries(before)) writeFileSync(join(f.root, path), text);
  setVersion(f.root, "0.9.0-rc.1");
  f.commit("Release 0.9.0-rc.1");
  f.git("tag", "v0.9.0-rc.1");
  sha = f.commit("Feature after the RC");
  assert.equal(prepareDevPackage(f.root, { sha }), "0.9.0-dev.4");
  assert.ok(compareVersions("0.9.0-dev.4", "0.9.0-rc.1") < 0);

  // A stable tag restarts the count; merge commits count once on the first-parent line.
  f.git("checkout", "--", ".");
  setVersion(f.root, "0.9.0");
  f.commit("Release 0.9.0");
  f.git("tag", "v0.9.0");
  f.git("checkout", "-q", "-b", "topic");
  f.commit("Topic 1");
  f.commit("Topic 2");
  f.git("checkout", "-q", "main");
  f.git("merge", "--no-ff", "topic", "-m", "Merge topic");
  sha = f.git("rev-parse", "HEAD");
  assert.equal(prepareDevPackage(f.root, { sha }), "0.9.1-dev.1");
});

test("the tagged stable release commit itself has no development version and is skipped", (t) => {
  const f = fixture(t, "0.8.0");
  f.commit("Feature");
  const sha = f.commit("Release 0.8.0");
  f.git("tag", "v0.8.0");
  const before = f.snapshot();
  assert.equal(prepareDevPackage(f.root, { sha }), undefined);
  assert.deepEqual(f.snapshot(), before);

  // The CLI succeeds with a notice and reports ready=false; a later commit is ready again.
  const script = fileURLToPath(new URL("../scripts/prepare-dev-package.mjs", import.meta.url));
  const output = join(f.root, "github-output");
  const run = (head) => {
    writeFileSync(output, "");
    const result = spawnSync(process.execPath, [script], { cwd: f.root, encoding: "utf8", env: {
      ...process.env, GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main", GITHUB_SHA: head, GITHUB_OUTPUT: output,
    } });
    return { status: result.status, stdout: result.stdout, output: readFileSync(output, "utf8") };
  };
  const skipped = run(sha);
  assert.equal(skipped.status, 0, skipped.stdout);
  assert.match(skipped.stdout, /::notice title=Development publication skipped::.* is the tagged stable release v0\.8\.0/);
  assert.equal(skipped.output, "ready=false\n");
  assert.deepEqual(f.snapshot(), before);
  const next = run(f.commit("Feature after the release"));
  assert.deepEqual([next.status, next.output], [0, "ready=true\n"]);
  assert.equal(readVersion(f.root), "0.8.1-dev.1");
});

test("a committed version tag pushed after the checkout is fetched from origin before numbering", (t) => {
  const f = fixture(t, "0.7.0");
  f.commit("Release 0.7.0");
  f.git("tag", "v0.7.0");
  setVersion(f.root, "0.8.0");
  const sha = f.commit("Release 0.8.0");
  const origin = mkdtempSync(join(tmpdir(), "lambdadb-dev-package-origin-"));
  t.after(() => rmSync(origin, { recursive: true, force: true }));
  f.git("init", "-q", "--bare", origin);
  f.git("remote", "add", "origin", origin);
  // Origin has v0.8.0 (so run-mode selection chose development), but the checkout predates the tag.
  f.git("tag", "v0.8.0");
  f.git("push", "-q", "origin", "main", "v0.8.0");
  f.git("tag", "-d", "v0.8.0");
  const before = f.snapshot();
  // Without the fetch, numbering would count from v0.7.0 and publish 0.8.1-dev.1 from the release commit.
  assert.equal(prepareDevPackage(f.root, { sha }), undefined);
  assert.deepEqual(f.snapshot(), before);
  assert.equal(f.git("rev-parse", "v0.8.0^{commit}"), sha);

  // A committed version whose tag exists neither locally nor on origin fails without mutation.
  setVersion(f.root, "0.9.0-rc.1");
  const untagged = f.commit("Untagged release candidate");
  const untaggedBefore = f.snapshot();
  assert.throws(() => prepareDevPackage(f.root, { sha: untagged }),
    /require the tag v0\.9\.0-rc\.1 of the committed version; it is missing locally and could not be fetched from origin/);
  assert.deepEqual(f.snapshot(), untaggedBefore);
});

test("without a stable tag the count starts at the root commit", (t) => {
  const f = fixture(t, "0.1.0-rc.1");
  f.commit("Initial");
  f.git("tag", "v0.1.0-rc.1");
  const sha = f.commit("Second");
  assert.equal(prepareDevPackage(f.root, { sha }), "0.1.0-dev.2");
});

test("dev builds reject dev forms, regressions, mismatches and wrong commits without mutation", (t) => {
  const devForm = fixture(t, "0.8.1-dev.0");
  let sha = devForm.commit("Committed dev form");
  let before = devForm.snapshot();
  assert.throws(() => prepareDevPackage(devForm.root, { sha }), /require a committed RC or stable version/);
  assert.deepEqual(devForm.snapshot(), before);

  // An RC whose stable version is already tagged would publish below the stable release.
  const regressed = fixture(t, "0.8.0");
  regressed.commit("Release 0.8.0");
  regressed.git("tag", "v0.8.0");
  setVersion(regressed.root, "0.8.0-rc.2");
  sha = regressed.commit("Version regressed");
  regressed.git("tag", "v0.8.0-rc.2");
  before = regressed.snapshot();
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

test("set-version accepts only RC and stable forms, and versions compare by SemVer", (t) => {
  const f = fixture(t);
  for (const version of ["0.8.1-dev.0", "0.8.1-dev.3", "0.8.1-dev", "0.8.1-beta.1", "v0.8.1", "0.8.1-rc.0"]) {
    assert.throws(() => setVersion(f.root, version), /Unsupported version/);
  }
  assert.equal(readVersion(f.root), "0.8.0");
  assert.equal(setVersion(f.root, "0.8.1-rc.2"), "0.8.1-rc.2");
  assert.equal(setVersion(f.root, "1.0.0"), "1.0.0");

  const ascending = ["0.9.0", "0.9.1-dev.1", "0.9.1-dev.2", "0.9.1-dev.10", "0.9.1-rc.1", "0.9.1-rc.2", "0.9.1",
    "0.10.0-dev.1"];
  for (let i = 0; i < ascending.length; i += 1) {
    for (let j = 0; j < ascending.length; j += 1) {
      assert.equal(Math.sign(compareVersions(ascending[i], ascending[j])), Math.sign(i - j), `${ascending[i]} vs ${ascending[j]}`);
    }
  }
  assert.throws(() => compareVersions("0.9.1", "0.9.1-beta.1"), /Unsupported version/);
  const script = fileURLToPath(new URL("../scripts/version.mjs", import.meta.url));
  const compare = (a, b) => spawnSync(process.execPath, [script, "compare", a, b], { encoding: "utf8" }).stdout.trim();
  assert.deepEqual([compare("0.11.1-dev.1", "0.11.0-dev.6"), compare("0.11.0-dev.6", "0.11.0-dev.6"),
    compare("0.11.0-dev.6", "0.11.0-rc.1")], ["1", "0", "-1"]);
});
