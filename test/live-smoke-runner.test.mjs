import assert from "node:assert/strict";
import test from "node:test";
import { runLiveSmoke } from "../scripts/run-live-smoke.mjs";

const env = { LAMBDADB_BASE_URL: "https://test.example", LAMBDADB_PROJECT_NAME: "sdk-smoke",
  LAMBDADB_SMOKE_SECRET_ARN: "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:smoke-key", PATH: "/bin" };

test("smoke keys are read through AWS, masked, and passed only to the test child environment", () => {
  const calls = [];
  runLiveSmoke(env, (command, args, options) => {
    assert.equal(command, "aws");
    assert.deepEqual(args, ["secretsmanager", "get-secret-value", "--region", "ap-northeast-2",
      "--secret-id", env.LAMBDADB_SMOKE_SECRET_ARN, "--query", "SecretString", "--output", "text"]);
    assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe"]);
    return "synthetic%test-key\n";
  }, (command, args, options) => {
    calls.push("test");
    assert.equal(command, "npm");
    assert.deepEqual(args, ["run", "test:live:docs-url"]);
    assert.equal(options.env.LAMBDADB_PROJECT_API_KEY, "synthetic%test-key");
    return { status: 0 };
  }, (value) => { calls.push("mask"); assert.equal(value, "::add-mask::synthetic%25test-key"); });
  assert.deepEqual(calls, ["mask", "test"]);
  assert.equal(env.LAMBDADB_PROJECT_API_KEY, undefined);
});

test("missing configuration, secret read failures, and invalid keys fail before starting a smoke", () => {
  const unexpected = () => assert.fail("Must not start smoke");
  for (const name of Object.keys(env).filter((name) => name !== "PATH")) {
    assert.throws(() => runLiveSmoke({ ...env, [name]: "" }, unexpected, unexpected), /Missing smoke configuration/);
  }
  assert.throws(() => runLiveSmoke(env, () => { throw new Error("sensitive output"); }, unexpected),
    { message: "Unable to read the dedicated smoke project key from Secrets Manager" });
  for (const key of ["", "None", "key\nother-key"]) {
    assert.throws(() => runLiveSmoke(env, () => key, unexpected), /single project API key/);
  }
});

test("smoke process failures prevent publication", () => {
  for (const result of [{ status: 1 }, { status: null, signal: "SIGTERM" }, { error: new Error("spawn failed") }]) {
    assert.throws(() => runLiveSmoke(env, () => "synthetic-key", () => result, () => {}), /docsUrl smoke failed/);
  }
});
