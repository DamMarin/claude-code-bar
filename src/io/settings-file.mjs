import { mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { STATUS_LINE, isOwnStatusLine } from "../core/status-line.mjs";
import { atomicWriteJson, readJson } from "./files.mjs";

const CLAUDE_DIR = join(homedir(), ".claude");
export const SETTINGS_PATH = join(CLAUDE_DIR, "settings.json");
// Holds a statusLine that --install replaced, so --uninstall can restore it
export const BACKUP_PATH = join(CLAUDE_DIR, "claude-code-bar.statusline-backup.json");

// settings.json exists but cannot be changed safely; the message says how to fix it
export class SettingsError extends Error {}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Reads ~/.claude/settings.json; {} when it doesn't exist, SettingsError when it is unusable. */
export function readSettings() {
  let raw;
  try {
    raw = readFileSync(SETTINGS_PATH, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
  let settings;
  try {
    settings = JSON.parse(raw);
  } catch {
    throw new SettingsError("~/.claude/settings.json contains invalid JSON. Fix it manually first.");
  }
  if (!isObject(settings)) throw new SettingsError("~/.claude/settings.json is not a JSON object. Fix it manually first.");
  return settings;
}

/** The model set in settings.json, for when Claude Code doesn't send one. Never throws. */
export function readDefaultModel() {
  const model = readJson(SETTINGS_PATH)?.model;
  return typeof model === "string" ? model : null;
}

/**
 * Sets the statusLine command. A statusLine from another tool is backed up first,
 * so removeStatusLine can restore it. Returns that replaced statusLine, or null.
 */
export function writeStatusLine(command) {
  mkdirSync(CLAUDE_DIR, { recursive: true });
  const settings = readSettings();

  const existing = settings.statusLine;
  const ours = isOwnStatusLine(existing);
  const replaced = existing !== undefined && !ours ? existing : null;
  if (replaced !== null) {
    atomicWriteJson(BACKUP_PATH, { statusLine: replaced, savedAt: new Date().toISOString() });
  }

  // Our own statusLine keeps whatever else the user set on it (padding, refreshInterval);
  // only the command changes. A new or replaced one starts from the defaults.
  settings.statusLine = { type: STATUS_LINE.type, ...(ours ? existing : STATUS_LINE), command };
  atomicWriteJson(SETTINGS_PATH, settings);
  return replaced;
}

/**
 * Removes claude-code-bar's statusLine and restores a backed-up one.
 * Returns "absent", "foreign" (another tool's, left untouched), "removed" or "restored".
 */
export function removeStatusLine() {
  const settings = readSettings();
  if (settings.statusLine === undefined) return "absent";
  if (!isOwnStatusLine(settings.statusLine)) return "foreign";

  const backup = readJson(BACKUP_PATH)?.statusLine;
  if (isObject(backup)) settings.statusLine = backup;
  else delete settings.statusLine;
  atomicWriteJson(SETTINGS_PATH, settings);

  if (!isObject(backup)) return "removed";
  try { unlinkSync(BACKUP_PATH); } catch { /* already gone */ }
  return "restored";
}
