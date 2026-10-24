import { readFileSync } from "node:fs";
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

export async function configure() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
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
    process.stdout.write(`${CSI}?7h${CSI}?25h${CSI}?1049l`);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  };
  // Leave the terminal usable however the process ends
  process.on("exit", restore);

  const finish = (message) => {
    restore();
    if (message) console.log(message);
    process.exit(0);
  };

  const draw = () => {
    const lines = menu.frame(process.stdout.columns || 80, process.stdout.rows || 30);
    process.stdout.write(`${CSI}H${lines.map((l) => `${l}${CSI}0m${CSI}K`).join("\r\n")}${CSI}J`);
  };

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  // Alternate screen, hidden cursor, no line wrapping (long lines are clipped)
  process.stdout.write(`${CSI}?1049h${CSI}?25l${CSI}?7l`);
  process.stdout.on("resize", draw);

  process.stdin.on("keypress", (str, key = {}) => {
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
