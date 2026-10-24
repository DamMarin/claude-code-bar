import { readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BACKUP_PATH, isOwnStatusLine } from "./status-line.mjs";

function atomicWriteJson(filePath, data) {
  const tmp = filePath + ".tmp." + process.pid;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, filePath);
}

// Returns the statusLine saved by --install, or null if there is no usable backup
function readBackup() {
  try {
    const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8"));
    const statusLine = backup?.statusLine;
    if (statusLine === null || typeof statusLine !== "object" || Array.isArray(statusLine)) return null;
    return statusLine;
  } catch {
    return null;
  }
}

export async function uninstall() {
  const settingsPath = join(homedir(), ".claude", "settings.json");

  let settings;
  try {
    const raw = readFileSync(settingsPath, "utf8");
    settings = JSON.parse(raw);
    if (typeof settings !== "object" || Array.isArray(settings) || settings === null) {
      console.error("❌ Error: ~/.claude/settings.json is not a JSON object. Fix it manually.");
      process.exit(1);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log("Nothing to uninstall — ~/.claude/settings.json not found.");
      process.exit(0);
    } else if (err instanceof SyntaxError) {
      console.error("❌ Error: ~/.claude/settings.json contains invalid JSON. Fix it manually.");
      process.exit(1);
    } else {
      throw err;
    }
  }

  if (settings.statusLine === undefined) {
    console.log("Nothing to uninstall — no statusLine is configured.");
    process.exit(0);
  }

  // Never remove a statusLine that belongs to another tool
  if (!isOwnStatusLine(settings.statusLine)) {
    console.log("Nothing to uninstall — the configured statusLine is not claude-code-bar. Leaving it untouched.");
    process.exit(0);
  }

  const backup = readBackup();
  if (backup) {
    settings.statusLine = backup;
  } else {
    delete settings.statusLine;
  }

  // Atomic write: write to temp file, then rename
  atomicWriteJson(settingsPath, settings);

  if (backup) {
    try { unlinkSync(BACKUP_PATH); } catch { /* already gone */ }
    console.log("✅ Claude Code Bar uninstalled. Your previous statusLine was restored.");
  } else {
    console.log("✅ Claude Code Bar uninstalled.");
  }
  console.log("   Restart Claude Code to apply.");
  console.log("   To also remove the package: npm uninstall -g claude-code-bar");
}
