import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function runLiveSmoke(env, spawn = spawnSync) {
  for (const name of ["LAMBDADB_BASE_URL", "LAMBDADB_PROJECT_NAME", "LAMBDADB_PROJECT_API_KEY"]) {
    if (!env[name]?.trim()) throw new Error(`Missing smoke configuration: ${name}`);
  }
  if (/[\r\n]/.test(env.LAMBDADB_PROJECT_API_KEY.trim())) throw new Error("Expected a single project API key");
  // The key comes from the GitHub Environment secret, which Actions masks in logs.
  const result = spawn("npm", ["run", "test:live"], { stdio: "inherit", env });
  if (result.error || result.status !== 0) throw new Error("Deployed live smoke failed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLiveSmoke(process.env);
}
