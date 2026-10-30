import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

// Each case runs in a fresh process because env() memoizes process.env.
const script = `
import { LambdaDBClient } from "./dist/esm/index.js";
import { HTTPClient } from "./dist/esm/lib/http.js";
const httpClient = new HTTPClient({
  fetcher: async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
});
await new LambdaDBClient({ httpClient, projectApiKey: "debug-env-test-key" }).listCollectionsSafe();
`;

function requestLogged(value) {
  const env = { ...process.env };
  delete env.LAMBDADB_DEBUG;
  if (value !== undefined) env.LAMBDADB_DEBUG = value;
  const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: new URL("..", import.meta.url),
    env,
    encoding: "utf8",
  });
  return stdout.includes("> Request:");
}

test("LAMBDADB_DEBUG enables the default logger only for true or 1", () => {
  for (const value of [undefined, "", "false", "FALSE", "0", "no", "off"]) {
    assert.equal(requestLogged(value), false, `LAMBDADB_DEBUG=${value}`);
  }
  for (const value of ["true", "TRUE", " true ", "1"]) {
    assert.equal(requestLogged(value), true, `LAMBDADB_DEBUG=${value}`);
  }
});
