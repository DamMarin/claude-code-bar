import { SettingsError, removeStatusLine } from "../io/settings-file.mjs";

const MESSAGES = {
  absent: "Nothing to uninstall — no statusLine is configured.",
  foreign: "Nothing to uninstall — the configured statusLine is not claude-code-bar. Leaving it untouched.",
  removed: "✅ Claude Code Bar uninstalled.",
  restored: "✅ Claude Code Bar uninstalled. Your previous statusLine was restored.",
};

export async function uninstall() {
  let result;
  try {
    result = removeStatusLine();
  } catch (err) {
    if (!(err instanceof SettingsError)) throw err;
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }

  console.log(MESSAGES[result]);
  if (result === "removed" || result === "restored") {
    console.log("   Restart Claude Code to apply.");
    console.log("   To also remove the package: npm uninstall -g claude-code-bar");
  }
}
