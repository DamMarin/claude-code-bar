import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const CACHE_DIR = join(homedir(), ".cache", "claude-code-bar");
const CACHE_FILE = join(CACHE_DIR, "update-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETRY_INTERVAL_MS = 60 * 60 * 1000; // after a failed or in-flight check

function getPkg() {
  return JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  );
}

function readCache() {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return null;
  }
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

function parseVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(version);
  if (!match) return null;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split(".") : [],
  };
}

/**
 * Semver precedence: returns a negative number if a < b, positive if a > b, 0 if equal.
 * Returns null if either version cannot be parsed.
 */
export function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return null;

  for (let i = 0; i < 3; i++) {
    if (va.core[i] !== vb.core[i]) return va.core[i] - vb.core[i];
  }

  // A release outranks any of its prereleases
  if (!va.pre.length || !vb.pre.length) return vb.pre.length - va.pre.length;

  for (let i = 0; i < Math.max(va.pre.length, vb.pre.length); i++) {
    const x = va.pre[i];
    const y = vb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    if (xNum && yNum) return Number(x) - Number(y);
    if (xNum) return -1;
    if (yNum) return 1;
    return x < y ? -1 : 1;
  }
  return 0;
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
 * Spawns a detached background process to check npm for updates.
 * Skips if the last successful check is fresher than 24 hours, or if a check
 * was attempted within the last hour (so failures don't retry on every render).
 */
export function scheduleUpdateCheck() {
  const cache = readCache();
  if (shouldThrottleScheduledCheck(cache)) return;

  // Record the attempt before spawning, so concurrent renders don't spawn too
  try {
    mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(CACHE_FILE, JSON.stringify({ ...cache, attemptedAt: Date.now() }));
  } catch {
    return;
  }

  const pkg = getPkg();
  const script = `
    const { writeFileSync, mkdirSync } = require("node:fs");
    (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(${JSON.stringify(`https://registry.npmjs.org/${pkg.name}/latest`)}, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) process.exit(0);
        const data = await res.json();
        if (typeof data.version !== "string") process.exit(0);
        mkdirSync(${JSON.stringify(CACHE_DIR)}, { recursive: true });
        writeFileSync(${JSON.stringify(CACHE_FILE)}, JSON.stringify({
          latest: data.version,
          checkedAt: Date.now(),
        }));
      } catch {}
    })();
  `;

  const child = spawn(process.execPath, ["-e", script], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

/**
 * For --version: prints full update message if available.
 */
export function printUpdateMessage() {
  const info = getUpdateInfo();
  if (info) {
    const pkg = getPkg();
    console.log(
      `\n  Update available: ${info.current} → ${info.latest}\n` +
        `  Run \`npm install -g ${pkg.name}\` to update.\n`
    );
  }
  // Also trigger a background check for freshness
  scheduleUpdateCheck();
}
