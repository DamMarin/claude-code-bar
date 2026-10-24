import { readFileSync, writeFileSync, mkdirSync, renameSync, lstatSync, realpathSync, statSync, chmodSync } from "node:fs";
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

// The file a symlink points to, or the path itself when it is not a link or doesn't exist yet
function resolveLink(filePath) {
  try {
    return realpathSync(filePath);
  } catch {
    return filePath;
  }
}

// How an existing JSON file is laid out: its indent (tabs, spaces, or 0 for a one-line file),
// whether it ends with a newline, and its permissions. A new file gets 2 spaces and mode 0600.
function layoutOf(filePath) {
  let raw;
  let mode;
  try {
    raw = readFileSync(filePath, "utf8");
    mode = statSync(filePath).mode & 0o777;
  } catch {
    return { indent: 2, newline: true, mode: 0o600 };
  }
  const indented = /^([ \t]+)["}\]]/m.exec(raw);
  const oneLine = !indented && raw.trim().length > 2; // "{}" alone says nothing about the style
  return { indent: indented ? indented[1] : oneLine ? 0 : 2, newline: raw.endsWith("\n") || !raw.trim(), mode };
}

// Write to a temp file, then rename, so readers never see a half-written file.
// A symlinked file (e.g. settings.json kept in a dotfiles repo) is written through, not replaced,
// and the file keeps its layout and permissions, so a rewrite changes only the data.
export function atomicWriteJson(filePath, data) {
  const target = resolveLink(filePath);
  const { indent, newline, mode } = layoutOf(target);
  const tmp = target + ".tmp." + process.pid;
  writeFileSync(tmp, JSON.stringify(data, null, indent) + (newline ? "\n" : ""), { mode });
  chmodSync(tmp, mode); // exactly the old mode, whatever the umask
  renameSync(tmp, target);
}

// Parsed JSON from a file, or undefined if it is missing or invalid
export function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

// Best-effort cache write in CACHE_DIR; a failed write is never an error.
// Returns whether the file was written.
export function writeCacheJson(name, data) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
    const filePath = join(CACHE_DIR, name);
    if (!isSafeToWrite(filePath)) return false;
    writeFileSync(filePath, JSON.stringify(data), { mode: 0o600 });
    return true;
  } catch {
    return false; // cache write failed — not critical
  }
}

export function readCacheJson(name) {
  return readJson(join(CACHE_DIR, name));
}
