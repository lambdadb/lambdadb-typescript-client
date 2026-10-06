import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function runLiveSmoke(env, execute = execFileSync, spawn = spawnSync, mask = console.log) {
  for (const name of ["LAMBDADB_BASE_URL", "LAMBDADB_PROJECT_NAME", "LAMBDADB_SMOKE_SECRET_ARN"]) {
    if (!env[name]?.trim()) throw new Error(`Missing smoke configuration: ${name}`);
  }
  let key;
  try {
    key = execute("aws", ["secretsmanager", "get-secret-value", "--region", "ap-northeast-2",
      "--secret-id", env.LAMBDADB_SMOKE_SECRET_ARN, "--query", "SecretString", "--output", "text"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env }).trim();
  } catch {
    // Do not include AWS command output or credentials in errors.
    throw new Error("Unable to read the dedicated smoke project key from Secrets Manager");
  }
  if (!key || key === "None" || /[\r\n]/.test(key)) throw new Error("Expected a single project API key in SecretString");
  mask(`::add-mask::${key.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}`);
  // Keep the key out of files, command arguments, and the rest of the publishing job.
  const result = spawn("npm", ["run", "test:live:docs-url"], {
    stdio: "inherit", env: { ...env, LAMBDADB_PROJECT_API_KEY: key },
  });
  if (result.error || result.status !== 0) throw new Error("Deployed docsUrl smoke failed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLiveSmoke(process.env);
}
