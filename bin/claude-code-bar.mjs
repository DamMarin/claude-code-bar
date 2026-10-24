#!/usr/bin/env node
import { argv } from "node:process";

const KNOWN_OPTIONS = new Set(["--install", "--uninstall", "--version", "-v", "--help", "-h"]);
const args = argv.slice(2);
const unknown = args.filter((arg) => !KNOWN_OPTIONS.has(arg));

// Global safety: never let the process hang longer than 5 seconds
const isRenderer = args.length === 0;
if (isRenderer) {
  setTimeout(() => process.exit(0), 5000).unref();
}

// Catch anything that slips through
process.on("uncaughtException", () => process.exit(0));
process.on("unhandledRejection", () => process.exit(0));

if (unknown.length > 0) {
  const { helpText } = await import("../src/cli/help.mjs");
  console.error(`Unknown option: ${unknown[0]}\n`);
  console.error(helpText());
  process.exit(1);
} else if (args.includes("--help") || args.includes("-h")) {
  const { helpText } = await import("../src/cli/help.mjs");
  console.log(helpText());
} else if (args.includes("--version") || args.includes("-v")) {
  const { readFileSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  console.log(pkg.version);
  const { printUpdateMessage } = await import("../src/cli/update-check.mjs");
  printUpdateMessage();
} else if (args.includes("--install")) {
  const { install } = await import("../src/cli/install.mjs");
  await install();
} else if (args.includes("--uninstall")) {
  const { uninstall } = await import("../src/cli/uninstall.mjs");
  await uninstall();
} else if (process.stdin.isTTY) {
  // Run by hand in a terminal: there is no status JSON to read, so explain instead of exiting silently
  const { helpText } = await import("../src/cli/help.mjs");
  console.log("claude-code-bar expects Claude Code's status JSON on stdin.\n");
  console.log(helpText());
} else {
  const { render } = await import("../src/renderer/bar-builder.mjs");
  await render();
}
