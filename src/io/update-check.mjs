// Checks npm for a newer claude-code-bar, at most once a day, in the background
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { compareVersions } from "../core/version.mjs";
import { readCacheJson, writeCacheJson } from "./files.mjs";

const CACHE_NAME = "update-check.json";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETRY_INTERVAL_MS = 60 * 60 * 1000; // after a failed or in-flight check

export function getPkg() {
  return JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  );
}

function readCache() {
  return readCacheJson(CACHE_NAME) ?? null;
}

function normalizedLatest(cache) {
  if (!cache || typeof cache.latest !== "string") return "";
  return cache.latest.trim();
}

function isRecent(timestamp, intervalMs) {
  return typeof timestamp === "number"
    && Number.isFinite(timestamp)
    && Date.now() - timestamp < intervalMs;
}

function shouldThrottleScheduledCheck(cache) {
  if (!cache) return false;
  if (normalizedLatest(cache) && isRecent(cache.checkedAt, CHECK_INTERVAL_MS)) return true;
  return isRecent(cache.attemptedAt, RETRY_INTERVAL_MS);
}

/**
 * Returns { current, latest } if a newer version is published, null otherwise.
 */
export function getUpdateInfo() {
  const cache = readCache();
  const latest = normalizedLatest(cache);
  if (!latest) return null;

  const pkg = getPkg();
  if (compareVersions(latest, pkg.version) > 0) {
    return { current: pkg.version, latest };
  }
  return null;
}

/**
 * Asks npm for the latest version and caches it. The background process started by
 * scheduleUpdateCheck runs this. `request` stands in for fetch, for tests. Never throws.
 */
export async function checkLatest({ request = fetch } = {}) {
  try {
    const res = await request(`https://registry.npmjs.org/${getPkg().name}/latest`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data?.version !== "string") return;
    writeCacheJson(CACHE_NAME, { latest: data.version, checkedAt: Date.now() });
  } catch { /* offline or slow: the next scheduled check tries again */ }
}

/**
 * Spawns a detached background process to check npm for updates.
 * Skips if the last successful check is fresher than 24 hours, or if a check
 * was attempted within the last hour (so failures don't retry on every render).
 * `start` stands in for child_process.spawn, for tests.
 */
export function scheduleUpdateCheck({ start = spawn } = {}) {
  const cache = readCache();
  if (shouldThrottleScheduledCheck(cache)) return;

  // Record the attempt before spawning, so concurrent renders don't spawn too.
  // No record (unwritable cache, or a symlink in its place) means no check at all.
  if (!writeCacheJson(CACHE_NAME, { ...cache, attemptedAt: Date.now() })) return;

  const script = `import { checkLatest } from ${JSON.stringify(import.meta.url)}; await checkLatest();`;
  const child = start(process.execPath, ["--input-type=module", "-e", script], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
