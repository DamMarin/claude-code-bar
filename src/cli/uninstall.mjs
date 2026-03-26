import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function atomicWriteJson(filePath, data) {
  const tmp = filePath + ".tmp." + process.pid;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, filePath);
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

  delete settings.statusLine;

  // Atomic write: write to temp file, then rename
  atomicWriteJson(settingsPath, settings);

  console.log("✅ Claude Code Bar uninstalled.");
  console.log("   Restart Claude Code to apply.");
  console.log("   To also remove the package: npm uninstall -g cc-bar");
}
