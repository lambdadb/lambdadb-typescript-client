import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const core = String.raw`(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)`;
/** Versions that may be committed: the dev placeholder between releases, or an RC/stable release. */
export const COMMITTED_VERSION = new RegExp(`^${core}(?:-dev\\.0|-rc\\.([1-9]\\d*))?$`);
/** Versions that may be published: automatic dev builds, RCs, and stable releases. */
export const PUBLISHED_VERSION = new RegExp(`^${core}(?:-(dev|rc)\\.([1-9]\\d*))?$`);
const STABLE_TAG = new RegExp(`^v${core}$`);

const files = {
  package: "package.json",
  lock: "package-lock.json",
  examples: "examples/package-lock.json",
  jsr: "jsr.json",
  config: "src/lib/config.ts",
};

function read(root, path) {
  return readFileSync(join(root, path), "utf8");
}

/** Read every version source; throws unless all agree. */
export function readVersion(root) {
  const pkg = JSON.parse(read(root, files.package));
  const lock = JSON.parse(read(root, files.lock));
  const examples = JSON.parse(read(root, files.examples));
  const jsr = JSON.parse(read(root, files.jsr));
  const config = read(root, files.config);
  const sdkVersion = /sdkVersion:\s*"([^"]+)"/.exec(config)?.[1];
  const sources = [lock.version, lock.packages?.[""]?.version, examples.packages?.[".."]?.version, jsr.version, sdkVersion];
  if (sources.some((version) => version !== pkg.version) || !config.includes(`speakeasy-sdk/typescript ${pkg.version} `)) {
    throw new Error("Version sources must agree: package.json, both package-lock.json entries, " +
      "examples/package-lock.json, jsr.json, and SDK_METADATA in src/lib/config.ts");
  }
  return pkg.version;
}

// Replace one exact `"version": "<old>"` occurrence after `anchor`, keeping each file's formatting.
function replaceVersionField(text, old, version, anchor = "") {
  const start = anchor ? text.indexOf(anchor) : 0;
  const needle = `"version": "${old}"`;
  const index = start < 0 ? -1 : text.indexOf(needle, start);
  if (index < 0) throw new Error(`Cannot find ${needle}${anchor ? ` after ${anchor}` : ""}`);
  return text.slice(0, index) + `"version": "${version}"` + text.slice(index + needle.length);
}

/** Set every version source to `version`, preserving formatting, and verify the result. */
export function setVersion(root, version, { allowed = COMMITTED_VERSION } = {}) {
  if (!allowed.test(version)) throw new Error(`Unsupported version ${version}`);
  const old = readVersion(root);
  let lock = replaceVersionField(read(root, files.lock), old, version);
  lock = replaceVersionField(lock, old, version, '"packages": {');
  const updates = {
    [files.package]: replaceVersionField(read(root, files.package), old, version),
    [files.lock]: lock,
    [files.examples]: replaceVersionField(read(root, files.examples), old, version, '"..": {'),
    [files.jsr]: replaceVersionField(read(root, files.jsr), old, version),
    [files.config]: read(root, files.config)
      .replace(/(sdkVersion:\s*")[^"]+(")/, (_text, start, end) => `${start}${version}${end}`)
      .replace(`speakeasy-sdk/typescript ${old} `, `speakeasy-sdk/typescript ${version} `),
  };
  for (const [path, text] of Object.entries(updates)) writeFileSync(join(root, path), text);
  if (readVersion(root) !== version) throw new Error("Version update did not reach every source");
  return version;
}

export function parseVersion(version) {
  const match = PUBLISHED_VERSION.exec(version) ?? COMMITTED_VERSION.exec(version);
  if (!match) throw new Error(`Unsupported version ${version}`);
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], text: `${match[1]}.${match[2]}.${match[3]}` };
}

export function compareCores(a, b) {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** The newest stable release tag (`vX.Y.Z`) among `tags`, or undefined. */
export function latestStableTag(tags) {
  return tags.filter((tag) => STABLE_TAG.test(tag))
    .sort((a, b) => compareCores(parseVersion(a.slice(1)).core, parseVersion(b.slice(1)).core)).at(-1);
}

/** The committed dev placeholder that follows a published RC (same version) or stable release (next patch). */
export function nextDevVersion(released) {
  if (/-rc\.[1-9]\d*$/.test(released)) return `${parseVersion(released).text}-dev.0`;
  if (!/^\d+\.\d+\.\d+$/.test(released)) throw new Error(`Expected an RC or stable version, got ${released}`);
  const [major, minor, patch] = parseVersion(released).core;
  return `${major}.${minor}.${patch + 1}-dev.0`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, value] = process.argv.slice(2);
  if (command === "get") {
    console.log(readVersion(process.cwd()));
  } else if (command === "set" && value) {
    console.log(setVersion(process.cwd(), value));
  } else if (command === "next-dev" && value) {
    console.log(nextDevVersion(value));
  } else {
    console.error("Usage: node scripts/version.mjs get | set <version> | next-dev <released-version>");
    process.exit(2);
  }
}
