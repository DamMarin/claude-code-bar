import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { STATUS_LINE, BACKUP_PATH, isOwnStatusLine } from "./status-line.mjs";

function atomicWriteJson(filePath, data) {
  const tmp = filePath + ".tmp." + process.pid;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, filePath);
}

export async function install() {
  const claudeDir = join(homedir(), ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  // Ensure ~/.claude/ exists
  mkdirSync(claudeDir, { recursive: true });

  // Read existing settings
  let settings = {};
  try {
    const raw = readFileSync(settingsPath, "utf8");
    settings = JSON.parse(raw);
    if (typeof settings !== "object" || Array.isArray(settings) || settings === null) {
      console.error("❌ Error: ~/.claude/settings.json is not a JSON object. Fix it manually before installing.");
      process.exit(1);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      // File doesn't exist — start fresh
      settings = {};
    } else if (err instanceof SyntaxError) {
      console.error("❌ Error: ~/.claude/settings.json contains invalid JSON. Fix it manually before installing.");
      process.exit(1);
    } else {
      throw err;
    }
  }

  // Back up a statusLine from another tool before replacing it
  const existing = settings.statusLine;
  if (existing !== undefined && !isOwnStatusLine(existing)) {
    atomicWriteJson(BACKUP_PATH, { statusLine: existing, savedAt: new Date().toISOString() });
    const described = typeof existing?.command === "string" ? `"${existing.command}"` : "(custom config)";
    console.warn(
      `⚠️  Replacing your existing statusLine ${described}.\n` +
      `   A copy was saved to ${BACKUP_PATH}\n` +
      "   and will be restored by `claude-code-bar --uninstall`."
    );
  }

  // Set statusLine config
  settings.statusLine = { ...STATUS_LINE };

  // Atomic write: write to temp file, then rename
  atomicWriteJson(settingsPath, settings);

  // Verify PATH
  try {
    execSync("which claude-code-bar", { stdio: "pipe", timeout: 3000 });
  } catch {
    console.warn(
      "⚠️  Warning: 'claude-code-bar' is not found on your PATH.\n" +
      "   Claude Code won't be able to run it.\n" +
      "   Make sure npm's global bin directory is in your PATH:\n" +
      `   export PATH="$(npm prefix -g)/bin:$PATH"`
    );
  }

  console.log("✅ Claude Code Bar installed successfully.");
  console.log("   Restart Claude Code to activate.");
}
