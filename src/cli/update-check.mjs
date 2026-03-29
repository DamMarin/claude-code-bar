import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const CACHE_DIR = join(homedir(), ".cache", "claude-code-bar");
const CACHE_FILE = join(CACHE_DIR, "update-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

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

function shouldThrottleScheduledCheck(cache) {
  if (!normalizedLatest(cache)) return false;
  const { checkedAt } = cache;
  if (typeof checkedAt !== "number" || !Number.isFinite(checkedAt)) return false;
  return Date.now() - checkedAt < CHECK_INTERVAL_MS;
}

/**
 * Returns { current, latest } if an update is available, null otherwise.
 */
export function getUpdateInfo() {
  const cache = readCache();
  const latest = normalizedLatest(cache);
  if (!latest) return null;

  const pkg = getPkg();
  if (latest !== pkg.version) {
    return { current: pkg.version, latest };
  }
  return null;
}

/**
 * Spawns a detached background process to check npm for updates.
 * Skips if a complete cache (valid latest + checkedAt) is fresher than 24 hours.
 */
export function scheduleUpdateCheck() {
  const cache = readCache();
  if (shouldThrottleScheduledCheck(cache)) return;

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