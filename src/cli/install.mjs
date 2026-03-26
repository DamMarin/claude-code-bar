import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

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

  // Set statusLine config
  settings.statusLine = {
    type: "command",
    command: "claude-code-bar",
    padding: 0,
  };

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
