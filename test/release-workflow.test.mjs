import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

const workflow = readFileSync(new URL("../.github/workflows/publish.yaml", import.meta.url), "utf8");
const nextDevWorkflow = readFileSync(new URL("../.github/workflows/next-dev-version.yaml", import.meta.url), "utf8");
const metadataScript = workflow.match(/node <<'NODE'\n([\s\S]*?)\n\s+NODE\n/)[1];
const stepScript = (name) => workflow.match(new RegExp(`- name: ${name}\\n[\\s\\S]*?run: \\|\\n([\\s\\S]*?)\\n\\s+- name:`))[1];
const modeScript = stepScript("Select the run mode");
const branchScript = stepScript("Verify release commit belongs to its channel branch");
const publishScript = workflow.match(/- name: Publish tested tarball\n[\s\S]*?run: \|\n([\s\S]*)$/)[1];
const concurrencyExpression = workflow.match(/group: npm-sdk-\$\{\{\s*(.*?)\s*\}\}/)[1];

function temp(t) {
  const directory = mkdtempSync(join(tmpdir(), "lambdadb-release-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function stub(directory, name, body) {
  const bin = join(directory, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
  chmodSync(join(bin, name), 0o755);
  return bin;
}

test("main pushes share one concurrency group while RC/stable releases keep tag groups", () => {
  const group = (event, tag) => `npm-sdk-${runInNewContext(concurrencyExpression, {
    github: { event_name: event, event: { release: { tag_name: tag } } },
  })}`;
  assert.equal(group("push", undefined), "npm-sdk-main");
  for (const tag of ["v0.8.0-rc.1", "v0.8.0-rc.2", "v0.8.0"]) assert.equal(group("release", tag), `npm-sdk-${tag}`);
  assert.match(workflow, /on:\n {2}push:\n {4}branches: \[main\]\n {2}release:\n {4}types: \[published\]\n/);
});

test("the run mode follows the committed version on main pushes", (t) => {
  const directory = temp(t);
  const bin = stub(directory, "node", 'echo "$COMMITTED_VERSION"');
  const run = (event, version) => {
    const output = join(directory, "output");
    rmSync(output, { force: true });
    const result = spawnSync("bash", ["-e", "-c", modeScript], { encoding: "utf8", env: {
      ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_OUTPUT: output,
      PUBLISH_EVENT: event, COMMITTED_VERSION: version,
    } });
    return result.status === 0 ? readFileSync(output, "utf8").trim() : `failed: ${result.stderr.trim()}`;
  };
  assert.equal(run("push", "0.9.0-dev.0"), "mode=dev");
  assert.equal(run("push", "0.9.0-rc.1"), "mode=verify");
  assert.equal(run("push", "0.9.0"), "mode=verify");
  assert.match(run("push", "0.9.0-dev.3"), /failed: .*-dev\.0 placeholder/);
  assert.equal(run("release", "0.9.0"), "mode=release");
  assert.match(workflow, /- name: Prepare automatic development version\n\s+if: steps\.mode\.outputs\.mode == 'dev'\n/);
  assert.match(workflow, /- name: Publish tested tarball\n\s+if: steps\.mode\.outputs\.mode != 'verify'\n/);
});

function metadata(version, mode, { prerelease = false, tag = `v${version}`, rootVersion = version,
  ref = "refs/heads/main", sha = "a".repeat(40), sourceCommit } = {}) {
  let output = "";
  const modules = {
    "node:fs": {
      readFileSync: () => `sdkVersion: "${version}", userAgent: "speakeasy-sdk/typescript ${version} node"`,
      appendFileSync: (_path, text) => { output += text; },
    },
    "./package.json": { version, lambdadbSourceCommit: sourceCommit },
    "./package-lock.json": { version, packages: { "": { version: rootVersion } } },
    "./examples/package-lock.json": { packages: { "..": { version } } },
    "./jsr.json": { version },
  };
  runInNewContext(metadataScript, {
    require: (name) => modules[name], console: { log() {} },
    process: { env: { RELEASE_TAG: tag, RELEASE_PRERELEASE: String(prerelease), GITHUB_OUTPUT: "output",
      RUN_MODE: mode, GITHUB_REF: ref, GITHUB_SHA: sha } },
  });
  return Object.fromEntries(output.trim().split("\n").map((line) => line.split("=")));
}

test("dev builds publish to dev from main, releases to rc/latest, and verification never publishes", () => {
  const sha = "a".repeat(40);
  assert.deepEqual(metadata("0.8.1-dev.4", "dev", { sourceCommit: sha }), {
    version: "0.8.1-dev.4", dist_tag: "dev", source_branch: "main", smoke_prefix: "LAMBDADB_DEV_",
  });
  for (const version of ["0.8.1-rc.1", "0.8.1"]) {
    assert.deepEqual(metadata(version, "verify"), {
      version, dist_tag: "", source_branch: "main", smoke_prefix: "LAMBDADB_PROD_",
    });
  }
  assert.deepEqual(metadata("0.8.1-rc.1", "release", { prerelease: true }), {
    version: "0.8.1-rc.1", dist_tag: "rc", source_branch: "main", smoke_prefix: "LAMBDADB_PROD_",
  });
  assert.deepEqual(metadata("0.8.1", "release"), {
    version: "0.8.1", dist_tag: "latest", source_branch: "main", smoke_prefix: "LAMBDADB_PROD_",
  });
});

test("each mode rejects the wrong source, channel, tag, prerelease flag or version shape", () => {
  const sha = "a".repeat(40);
  for (const override of [{ ref: "refs/heads/develop" }, { sha: "" }, { sourceCommit: "b".repeat(40) }]) {
    assert.throws(() => metadata("0.8.1-dev.4", "dev", { sourceCommit: sha, ...override }), /exact main push/);
  }
  assert.throws(() => metadata("0.8.1", "dev", { sourceCommit: sha }), /exact main push/);
  assert.throws(() => metadata("0.8.1", "verify", { ref: "refs/heads/feature" }), /committed on main/);
  assert.throws(() => metadata("0.8.1-dev.4", "verify"), /committed on main/);
  assert.throws(() => metadata("0.8.1-dev.4", "release", { prerelease: true }), /publish automatically from main pushes/);
  assert.throws(() => metadata("0.8.1", "release", { tag: "v0.8.0" }), /does not match/);
  for (const [version, prerelease] of [["0.8.1-rc.1", false], ["0.8.1", true]]) {
    assert.throws(() => metadata(version, "release", { prerelease }), /requires GitHub prerelease/);
  }
  for (const version of ["0.8.1-beta.1", "0.8.1-rc.0", "0.8.1-dev.0"]) {
    assert.throws(() => metadata(version, "release"), /Unsupported release version/);
  }
  assert.throws(() => metadata("0.8.1", "release", { rootVersion: "0.8.0" }), /expected 0\.8\.1/);
  assert.throws(() => metadata("0.8.1", "other"), /Unknown run mode/);
});

test("live smoke Variables come from the selected environment without a fallback", () => {
  // Indexing by a non-empty literal name keeps a missing Variable empty.
  for (const name of ["SMOKE_AWS_ROLE_ARN", "BASE_URL", "PROJECT_NAME", "SMOKE_SECRET_ARN"]) {
    assert.ok(workflow.includes(`\${{ vars[format('{0}${name}', steps.release.outputs.smoke_prefix)] }}`), name);
  }
  assert.doesNotMatch(workflow, /vars\.LAMBDADB_/);
});

test("the next development version workflow runs only after a successful release publication", () => {
  assert.match(nextDevWorkflow, /workflow_run:\n\s+workflows: \["Publish to npm"\]\n\s+types: \[completed\]/);
  assert.ok(nextDevWorkflow.includes(
    "if: github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'release'"));
  assert.match(nextDevWorkflow, /node scripts\/version\.mjs next-dev "\$RELEASED"/);
  assert.match(nextDevWorkflow, /node scripts\/version\.mjs set "\$NEXT"/);
  assert.match(nextDevWorkflow, /gh pr create --base main/);
  // A rerun reuses an existing branch and opens the pull request only when none exists.
  assert.doesNotMatch(nextDevWorkflow, /already exists"\n\s+exit 0/);
  assert.match(nextDevWorkflow, /gh pr list --head "\$BRANCH" --base main --state all/);
});

test("release commits must be on main and only the current main head publishes a dev build", (t) => {
  const directory = temp(t);
  function git(...args) {
    const result = spawnSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false",
      "-c", "user.name=Release Test", "-c", "user.email=release-test@example.com", ...args],
    { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git("init", "--initial-branch=main");
  git("commit", "--allow-empty", "-m", "Base");
  const older = git("rev-parse", "HEAD");
  git("commit", "--allow-empty", "-m", "Head");
  const head = git("rev-parse", "HEAD");
  git("checkout", "-b", "feature");
  git("commit", "--allow-empty", "-m", "Unmerged change");
  const feature = git("rev-parse", "HEAD");
  git("remote", "add", "origin", directory);
  for (const [commit, status] of [[head, 0], [older, 0], [feature, 1]]) {
    git("checkout", "--detach", commit);
    const result = spawnSync("bash", ["-e", "-c", branchScript], { cwd: directory, encoding: "utf8",
      env: { ...process.env, SOURCE_BRANCH: "main" } });
    assert.equal(result.status, status, result.stderr);
  }

  // Execute the real final publication step using a local npm stub, never the registry.
  const log = join(directory, "npm-publish");
  const bin = stub(directory, "npm",
    'if [ "$1" = view ]; then [ -n "$PUBLISHED_COMMIT" ] && echo "$PUBLISHED_COMMIT"; exit 0; fi\n' +
    'printf "%s\\n" "$@" > "$NPM_CALL_LOG"');
  const publish = (commit, event, publishedCommit = "") => {
    git("checkout", "--detach", commit);
    rmSync(log, { force: true });
    const result = spawnSync("bash", ["-e", "-c", publishScript], { cwd: directory, encoding: "utf8", env: {
      ...process.env, PATH: `${bin}:${process.env.PATH}`, NPM_CALL_LOG: log, PUBLISHED_COMMIT: publishedCommit,
      PUBLISH_EVENT: event, TARBALL: "tested-package.tgz", VERSION: "0.8.1-dev.2",
      DIST_TAG: event === "push" ? "dev" : "latest",
    } });
    return { status: result.status, published: existsSync(log) ? readFileSync(log, "utf8") : undefined };
  };
  assert.deepEqual(publish(head, "push"), { status: 0,
    published: "publish\ntested-package.tgz\n--access\npublic\n--tag\ndev\n--provenance\n" });
  assert.deepEqual(publish(older, "push"), { status: 0, published: undefined });
  assert.deepEqual(publish(head, "push", head), { status: 0, published: undefined });
  assert.equal(publish(head, "push", older).status, 1);
  assert.deepEqual(publish(older, "release"), { status: 0,
    published: "publish\ntested-package.tgz\n--access\npublic\n--tag\nlatest\n--provenance\n" });
});
