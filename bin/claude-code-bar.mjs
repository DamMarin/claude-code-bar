#!/usr/bin/env node
import { argv } from "node:process";
import { parseOptions } from "../src/core/options.mjs";

const MODES = {
  "--install": "install", "--uninstall": "uninstall", "--config": "config",
  "--version": "version", "-v": "version", "--help": "help", "-h": "help",
};
const args = argv.slice(2);
const modes = [...new Set(args.filter((arg) => arg in MODES).map((arg) => MODES[arg]))];
const optionArgs = args.filter((arg) => !(arg in MODES));
const mode = modes[0] ?? "render";

// Global safety: never let the process hang longer than 5 seconds
if (mode === "render") {
  setTimeout(() => process.exit(0), 5000).unref();
}

// Commands say what went wrong instead of exiting silently
function report(err) {
  console.error(`❌ Error: ${err?.message ?? err}`);
  process.exit(1);
}

if (mode === "render") {
  // Catch anything that slips through: the status bar never crashes
  process.on("uncaughtException", () => process.exit(0));
  process.on("unhandledRejection", () => process.exit(0));
} else {
  process.on("uncaughtException", report);
  process.on("unhandledRejection", report);
}

const { options, errors } = parseOptions(optionArgs);

async function fail(messages) {
  const { helpText } = await import("../src/commands/help.mjs");
  console.error(`${messages.join("\n")}\n`);
  console.error(helpText());
  process.exit(1);
}

if (modes.length > 1) {
  await fail([`Use only one of ${Object.keys(MODES).filter((k) => k.startsWith("--")).join(", ")} at a time.`]);
} else if (mode !== "render" && mode !== "install" && optionArgs.length > 0) {
  await fail(errors.length ? errors : [`Display options only work with --install or in the statusLine command.`]);
} else if (mode === "install" && errors.length) {
  await fail(errors);
} else if (mode === "help") {
  const { helpText } = await import("../src/commands/help.mjs");
  console.log(helpText({ banner: true }));
} else if (mode === "version") {
  const { version } = await import("../src/commands/version.mjs");
  version();
} else if (mode === "install") {
  const { install } = await import("../src/commands/install.mjs");
  await install(optionArgs.length ? options : null);
} else if (mode === "uninstall") {
  const { uninstall } = await import("../src/commands/uninstall.mjs");
  await uninstall();
} else if (mode === "config") {
  const { configure } = await import("../src/commands/configure.mjs");
  await configure();
} else if (process.stdin.isTTY) {
  // Run by hand in a terminal: there is no status JSON to read, so explain instead of exiting silently
  if (errors.length) await fail(errors);
  const { helpText } = await import("../src/commands/help.mjs");
  console.log(helpText({ banner: true }));
  console.log("Nothing to show: claude-code-bar expects Claude Code's status JSON on stdin.");
} else {
  // Run by Claude Code: a bad flag is skipped so the status bar still renders
  const { render } = await import("../src/commands/render.mjs");
  await render(options);
}
