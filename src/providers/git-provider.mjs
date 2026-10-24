import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, lstatSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CACHE_DIR = join(homedir(), ".cache", "claude-code-bar");
const CACHE_TTL_MS = 5000;
const MAX_BUFFER = 64 * 1024; // 64 KB — plenty for branch names and porcelain output
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

// One cache file per working directory, so concurrent sessions don't evict each other
function cachePathFor(cwd) {
  const key = createHash("sha256").update(cwd).digest("hex").slice(0, 16);
  return join(CACHE_DIR, `git-${key}.json`);
}

function isSafeToWrite(filePath) {
  try {
    const stat = lstatSync(filePath);
    return !stat.isSymbolicLink();
  } catch (err) {
    // ENOENT = file doesn't exist yet, safe to create
    return err.code === "ENOENT";
  }
}

export function getGitInfo(cwd) {
  if (typeof cwd !== "string" || cwd.length === 0) return null;
  const cachePath = cachePathFor(cwd);

  // Try cache first
  try {
    const cache = JSON.parse(readFileSync(cachePath, "utf8"));
    if (isValidCache(cache) && cache.cwd === cwd && (Date.now() - cache.timestamp) < CACHE_TTL_MS) {
      return { branch: cache.branch, dirty: cache.dirty };
    }
  } catch { /* no cache or invalid */ }

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

    const isDirty = execSync("git status --porcelain", { ...EXEC_OPTS, cwd }).trim().length > 0;

    const result = { branch, dirty: isDirty };

    // Write cache (skip if path is a symlink)
    try {
      mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
      if (isSafeToWrite(cachePath)) {
        writeFileSync(cachePath, JSON.stringify({
          timestamp: Date.now(), cwd, ...result
        }), { mode: 0o600 });
      }
    } catch { /* cache write failed — not critical */ }

    return result;
  } catch {
    return null;
  }
}
