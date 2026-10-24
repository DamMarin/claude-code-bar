import { serializeOptions } from "../core/options.mjs";
import { STATUS_LINE, buildCommand, commandExecutable, isOwnStatusLine, splitCommand } from "../core/status-line.mjs";
import { canRun } from "../io/executable.mjs";
import { BACKUP_PATH, SettingsError, readSettings, writeStatusLine } from "../io/settings-file.mjs";

export function warnReplaced(replaced) {
  if (replaced === null) return;
  const described = typeof replaced?.command === "string" ? `"${replaced.command}"` : "(custom config)";
  console.warn(
    `⚠️  Replaced your existing statusLine ${described}.\n` +
    `   A copy was saved to ${BACKUP_PATH}\n` +
    "   and will be restored by `claude-code-bar --uninstall`."
  );
}

/**
 * options: display options passed with --install, or null to keep the current ones.
 */
export async function install(options = null) {
  let replaced;
  let command = STATUS_LINE.command;
  try {
    const existing = readSettings().statusLine;
    const ours = isOwnStatusLine(existing);
    if (options) {
      // Keep a custom program path the user may have set, e.g. /opt/bin/claude-code-bar,
      // and shell syntax after the flags, e.g. 2>/dev/null
      const { binary, suffix } = ours ? splitCommand(existing.command) : { binary: STATUS_LINE.command, suffix: "" };
      command = buildCommand(binary, serializeOptions(options), suffix);
    } else if (ours) {
      // Reinstalling keeps the options chosen earlier
      command = existing.command;
    }
    replaced = writeStatusLine(command);
  } catch (err) {
    if (!(err instanceof SettingsError)) throw err;
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
  warnReplaced(replaced);

  // Check that the program the command starts with can be found: claude-code-bar itself,
  // or e.g. npx, pnpm or node when the command runs it through one of those
  const program = commandExecutable(command);
  if (program && !canRun(program)) {
    console.warn(
      `⚠️  Warning: '${program}' is not found ${/[/\\]/.test(program) ? "or is not executable" : "on your PATH"}.\n` +
      "   Claude Code won't be able to run it." +
      (program === STATUS_LINE.command
        ? "\n   Make sure npm's global bin directory is in your PATH:\n" +
          `   export PATH="$(npm prefix -g)/bin:$PATH"`
        : "")
    );
  }

  console.log("✅ Claude Code Bar installed successfully.");
  if (command !== STATUS_LINE.command) console.log(`   Command: ${command}`);
  console.log("   Restart Claude Code to activate.");
  console.log("   Run `claude-code-bar --config` to choose what to show.");
}
