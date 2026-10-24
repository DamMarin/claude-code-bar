// Checks npm for a newer claude-code-bar, at most once a day, in the background
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { compareVersions } from "../core/version.mjs";
import { CACHE_DIR, readJson } from "./files.mjs";

const CACHE_FILE = join(CACHE_DIR, "update-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETRY_INTERVAL_MS = 60 * 60 * 1000; // after a failed or in-flight check

export function getPkg() {
  return JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  );
}

function readCache() {
  return readJson(CACHE_FILE) ?? null;
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
