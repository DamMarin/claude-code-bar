import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { stripControl } from "../core/sanitize.mjs";
import { readCacheJson, writeCacheJson } from "./files.mjs";

const CACHE_TTL_MS = 5000;
const MAX_BUFFER = 64 * 1024; // 64 KB — plenty for the branch headers; a bigger status just means dirty
// git runs directly, without a shell in between
const EXEC_OPTS = { encoding: "utf8", timeout: 2000, maxBuffer: MAX_BUFFER, stdio: ["ignore", "pipe", "ignore"] };

const git = (cwd, args) => spawnSync("git", args, { ...EXEC_OPTS, cwd });

function isValidCache(cache) {
  return cache
    && typeof cache === "object"
    && typeof cache.cwd === "string"
    && typeof cache.timestamp === "number"
    && typeof cache.branch === "string"
    && typeof cache.dirty === "boolean"
    && Number.isInteger(cache.ahead)
    && Number.isInteger(cache.behind)
    && cache.branch.length > 0
    && cache.branch.length < 256;
}

/**
 * Reads `git status --porcelain=v2 --branch`: the branch (or the short commit on a
 * detached HEAD), commits ahead of and behind the upstream, and whether anything changed.
 * Returns null without a branch header, e.g. outside a repository.
 */
export function parseStatus(text) {
  let head = null;
  let oid = null;
  let ahead = 0;
  let behind = 0;
  let dirty = false;
  for (const line of String(text ?? "").split("\n")) {
    if (line.startsWith("# branch.head ")) head = line.slice(14).trim();
    else if (line.startsWith("# branch.oid ")) oid = line.slice(13).trim();
    else if (line.startsWith("# branch.ab ")) {
      const match = /^\+(\d+) -(\d+)$/.exec(line.slice(12).trim());
      if (match) [ahead, behind] = [Number(match[1]), Number(match[2])];
    } else if (line.trim() && !line.startsWith("#")) dirty = true;
  }
  const branch = head && head !== "(detached)" ? head : oid && oid !== "(initial)" ? oid.slice(0, 7) : null;
  return branch ? { branch, dirty, ahead, behind } : null;
}

// A status that timed out still tells the branch, so a slow repo loses only the "*"
function branchOnly(cwd) {
  const name = git(cwd, ["branch", "--show-current"]).stdout?.trim()
    || git(cwd, ["rev-parse", "--short", "HEAD"]).stdout?.trim();
  return name ? { branch: name, dirty: false, ahead: 0, behind: 0 } : null;
}

function readStatus(cwd) {
  const result = git(cwd, ["status", "--porcelain=v2", "--branch"]);
  // A status that overflows the buffer still has its headers, and means there are changes
  const status = parseStatus(result.stdout);
  if (status) return result.error?.code === "ENOBUFS" ? { ...status, dirty: true } : status;
  return result.error?.code === "ETIMEDOUT" ? branchOnly(cwd) : null;
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
    return { branch: cache.branch, dirty: cache.dirty, ahead: cache.ahead, behind: cache.behind };
  }

  const status = readStatus(cwd);
  if (!status) return null;

  // Clamp branch name length for display safety
  let branch = stripControl(status.branch);
  if (!branch) return null;
  if (branch.length > 64) branch = branch.slice(0, 61) + "...";

  const result = { ...status, branch };
  writeCacheJson(cacheName, { timestamp: Date.now(), cwd, ...result });
  return result;
}
