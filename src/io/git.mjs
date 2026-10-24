import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readCacheJson, writeCacheJson } from "./files.mjs";

const CACHE_TTL_MS = 5000;
const MAX_BUFFER = 64 * 1024; // 64 KB — plenty for branch names; a bigger status just means dirty
const EXEC_OPTS = { encoding: "utf8", timeout: 2000, maxBuffer: MAX_BUFFER, stdio: ["pipe", "pipe", "pipe"] };

// Strip ANSI escapes and control characters from git output
function sanitize(str) {
  return str.replace(/[\x00-\x1f\x7f-\x9f]/g, "").replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

function isValidCache(cache) {
  return cache
    && typeof cache === "object"
    && typeof cache.cwd === "string"
    && typeof cache.timestamp === "number"
    && typeof cache.branch === "string"
    && typeof cache.dirty === "boolean"
    && cache.branch.length > 0
    && cache.branch.length < 256;
}

// A status that overflows the buffer still means there are changes. A timeout counts
// as clean, so a slow repo loses only the "*", never the branch.
function isDirty(cwd) {
  try {
    return execSync("git status --porcelain", { ...EXEC_OPTS, cwd }).trim().length > 0;
  } catch (err) {
    return err.code === "ENOBUFS";
  }
}

// One cache file per working directory, so concurrent sessions don't evict each other
function cacheNameFor(cwd) {
  const key = createHash("sha256").update(cwd).digest("hex").slice(0, 16);
  return `git-${key}.json`;
}

export function getGitInfo(cwd) {
  if (typeof cwd !== "string" || cwd.length === 0) return null;
  const cacheName = cacheNameFor(cwd);

  // Try cache first
  const cache = readCacheJson(cacheName);
  if (isValidCache(cache) && cache.cwd === cwd && (Date.now() - cache.timestamp) < CACHE_TTL_MS) {
    return { branch: cache.branch, dirty: cache.dirty };
  }

  // Run git commands
  try {
    let branch = sanitize(execSync("git branch --show-current", { ...EXEC_OPTS, cwd }).trim());

    // Detached HEAD — fall back to short commit hash
    if (!branch) {
      branch = sanitize(execSync("git rev-parse --short HEAD", { ...EXEC_OPTS, cwd }).trim());
      if (!branch) return null;
    }

    // Clamp branch name length for display safety
    if (branch.length > 64) branch = branch.slice(0, 61) + "...";

    const result = { branch, dirty: isDirty(cwd) };

    writeCacheJson(cacheName, { timestamp: Date.now(), cwd, ...result });

    return result;
  } catch {
    return null;
  }
}
