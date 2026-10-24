import { readFileSync } from "node:fs";
import { constants } from "node:os";
import readline from "node:readline";
import { parseOptions, serializeOptions } from "../core/options.mjs";
import { createMenu, plural } from "../core/menu.mjs";
import { STATUS_LINE, buildCommand, isOwnStatusLine, splitCommand } from "../core/status-line.mjs";
import { SettingsError, readSettings, writeStatusLine } from "../io/settings-file.mjs";
import { warnReplaced } from "./install.mjs";

const CSI = "\x1b[";
const KEY_NAMES = {
  up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight",
  return: "Enter", enter: "Enter", escape: "Escape", tab: "Tab", space: " ",
};

/**
 * The interactive --config menu. `stdin` and `stdout` are the terminal; tests pass
 * stand-ins that act as one, so the menu can be driven without a real terminal.
 */
export async function configure({ stdin = process.stdin, stdout = process.stdout } = {}) {
  if (!stdin.isTTY || !stdout.isTTY) {
    console.error(
      "❌ --config needs an interactive terminal.\n" +
      "   To set options without the menu, pass them to --install, e.g.\n" +
      "   claude-code-bar --install --theme=ocean --hide=dir"
    );
    process.exit(1);
  }

  let current;
  try {
    current = readSettings().statusLine;
  } catch (err) {
    if (!(err instanceof SettingsError)) throw err;
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const ours = isOwnStatusLine(current);
  const { binary, args, suffix } = ours ? splitCommand(current.command) : { binary: STATUS_LINE.command, args: [], suffix: "" };
  const { options, errors } = parseOptions(args);
  const menu = createMenu(options, { version: pkg.version, color: !process.env.NO_COLOR });

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    try {
      stdout.write(`${CSI}?7h${CSI}?25h${CSI}?1049l`);
      if (stdin.isTTY) stdin.setRawMode(false);
    } catch { /* the terminal is already gone, e.g. after SIGHUP */ }
  };
  // Leave the terminal usable however the process ends. A signal skips the "exit"
  // event unless it is handled, so a killed or hung-up menu restores the terminal too.
  process.on("exit", restore);
  for (const signal of ["SIGTERM", "SIGHUP"]) {
    process.on(signal, () => {
      restore();
      process.exit(128 + constants.signals[signal]);
    });
  }

  const finish = (message) => {
    restore();
    if (message) console.log(message);
    process.exit(0);
  };

  const draw = () => {
    const lines = menu.frame(stdout.columns || 80, stdout.rows || 30);
    stdout.write(`${CSI}H${lines.map((l) => `${l}${CSI}0m${CSI}K`).join("\r\n")}${CSI}J`);
  };

  readline.emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  // Alternate screen, hidden cursor, no line wrapping (long lines are clipped)
  stdout.write(`${CSI}?1049h${CSI}?25l${CSI}?7l`);
  stdout.on("resize", draw);

  stdin.on("keypress", (str, key = {}) => {
    if (key.ctrl && key.name === "c") finish("Cancelled. Nothing was saved.");
    const name = KEY_NAMES[key.name] ?? (key.shift && key.name === "r" ? "R" : str);
    if (!name) return;
    const action = menu.onKey(name, Boolean(key.shift));

    if (action === "save") {
      restore();
      const command = buildCommand(binary, serializeOptions(menu.options()), suffix);
      const replaced = writeStatusLine(command);
      console.log(`✅ Saved to ~/.claude/settings.json\n\n   ${command}\n`);
      warnReplaced(replaced);
      finish("   Restart Claude Code to apply.");
    } else if (action === "quit") {
      const changes = menu.changes();
      finish(changes ? `Discarded ${plural(changes)}. Nothing was saved.` : "No changes.");
    } else {
      draw();
    }
  });

  draw();
  if (errors.length) {
    // Shown after the menu closes, so the user knows some flags were not understood
    process.on("exit", () => console.error(`\n⚠️  Ignored in your current command: ${errors.join("; ")}`));
  }
}
