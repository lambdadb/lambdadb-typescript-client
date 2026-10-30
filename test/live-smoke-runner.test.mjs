import assert from "node:assert/strict";
import test from "node:test";
import { runLiveSmoke } from "../scripts/run-live-smoke.mjs";

const env = { LAMBDADB_BASE_URL: "https://test.example", LAMBDADB_PROJECT_NAME: "sdk-smoke",
  LAMBDADB_PROJECT_API_KEY: "synthetic-test-key", PATH: "/bin" };

test("the smoke runs the live suite with the configured environment", () => {
  const calls = [];
  runLiveSmoke(env, (command, args, options) => {
    calls.push([command, args]);
    assert.equal(options.env.LAMBDADB_PROJECT_API_KEY, "synthetic-test-key");
    assert.equal(options.env.LAMBDADB_BASE_URL, "https://test.example");
    return { status: 0 };
  });
  assert.deepEqual(calls, [["npm", ["run", "test:live"]]]);
});

test("missing configuration and invalid keys fail before starting a smoke", () => {
  const unexpected = () => assert.fail("Must not start smoke");
  for (const name of Object.keys(env).filter((name) => name !== "PATH")) {
    for (const value of [undefined, "", "  "]) {
      assert.throws(() => runLiveSmoke({ ...env, [name]: value }, unexpected), /Missing smoke configuration/);
    }
  }
  assert.throws(() => runLiveSmoke({ ...env, LAMBDADB_PROJECT_API_KEY: "key\nother-key" }, unexpected),
    /single project API key/);
});

test("smoke process failures prevent publication", () => {
  for (const result of [{ status: 1 }, { status: null, signal: "SIGTERM" }, { error: new Error("spawn failed") }]) {
    assert.throws(() => runLiveSmoke(env, () => result), /live smoke failed/);
  }
});
