import { readFileSync, writeFileSync, mkdirSync, renameSync, lstatSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CACHE_DIR = join(homedir(), ".cache", "claude-code-bar");

// False when the path is a symlink, so a planted link can't redirect our writes
export function isSafeToWrite(filePath) {
  try {
    return !lstatSync(filePath).isSymbolicLink();
  } catch (err) {
    // ENOENT = file doesn't exist yet, safe to create
    return err.code === "ENOENT";
  }
}

// Write to a temp file, then rename, so readers never see a half-written file
export function atomicWriteJson(filePath, data) {
  const tmp = filePath + ".tmp." + process.pid;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, filePath);
}

// Parsed JSON from a file, or undefined if it is missing or invalid
export function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

// Best-effort cache write in CACHE_DIR; a failed write is never an error
export function writeCacheJson(name, data) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
    const filePath = join(CACHE_DIR, name);
    if (isSafeToWrite(filePath)) writeFileSync(filePath, JSON.stringify(data), { mode: 0o600 });
  } catch { /* cache write failed — not critical */ }
}

export function readCacheJson(name) {
  return readJson(join(CACHE_DIR, name));
}
