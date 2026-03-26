#!/usr/bin/env node
import { argv } from "node:process";

// Global safety: never let the process hang longer than 5 seconds
const isRenderer = !argv.includes("--install") && !argv.includes("--uninstall");
if (isRenderer) {
  setTimeout(() => process.exit(0), 5000).unref();
}

// Catch anything that slips through
process.on("uncaughtException", () => process.exit(0));
process.on("unhandledRejection", () => process.exit(0));

if (argv.includes("--version") || argv.includes("-v")) {
  const { readFileSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  console.log(pkg.version);
} else if (argv.includes("--install")) {
  const { install } = await import("../src/cli/install.mjs");
  await install();
} else if (argv.includes("--uninstall")) {
  const { uninstall } = await import("../src/cli/uninstall.mjs");
  await uninstall();
} else {
  const { render } = await import("../src/renderer/bar-builder.mjs");
  await render();
}
