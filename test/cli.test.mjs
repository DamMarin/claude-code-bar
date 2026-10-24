import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, symlinkSync, lstatSync, chmodSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compareVersions } from "../src/core/version.mjs";
import { buildCommand, commandExecutable, isOwnStatusLine, splitCommand } from "../src/core/status-line.mjs";

const BIN = fileURLToPath(new URL("../bin/claude-code-bar.mjs", import.meta.url));
const PKG = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const G = "\x1b[32m";
const R = "\x1b[0m";

// Isolated HOME with a fresh update-check cache, so nothing touches the network
function makeHome(t) {
  const home = mkdtempSync(join(tmpdir(), "ccb-test-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, ".claude"));
  mkdirSync(join(home, ".cache", "claude-code-bar"), { recursive: true });
  writeFileSync(
    join(home, ".cache", "claude-code-bar", "update-check.json"),
    JSON.stringify({ latest: PKG.version, checkedAt: Date.now() }),
  );
  return home;
}

function run(home, args, input = "", extraEnv = {}) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, ...extraEnv };
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  return spawnSync(process.execPath, [BIN, ...args], { input, env, encoding: "utf8", timeout: 10_000 });
}

test("compareVersions follows semver precedence", () => {
  assert.ok(compareVersions("0.0.6", "0.0.5") > 0);
  assert.ok(compareVersions("0.0.4", "0.0.5") < 0);
  assert.equal(compareVersions("0.0.5", "0.0.5"), 0);
  assert.ok(compareVersions("1.0.0-beta.2", "1.0.0") < 0);
  assert.ok(compareVersions("1.0.0-beta.10", "1.0.0-beta.2") > 0);
  assert.ok(compareVersions("1.0.0-alpha", "1.0.0-alpha.1") < 0);
  assert.equal(compareVersions("junk", "0.0.1"), null);
});

test("isOwnStatusLine", () => {
  assert.ok(isOwnStatusLine({ command: "claude-code-bar" }));
  assert.ok(isOwnStatusLine({ command: "/usr/local/bin/claude-code-bar" }));
  assert.ok(isOwnStatusLine({ command: "node /opt/ccb/bin/claude-code-bar.mjs" }));
  assert.ok(!isOwnStatusLine({ command: "ccusage statusline" }));
  assert.ok(!isOwnStatusLine({ command: "claude-code-bar-fork" }));
  assert.ok(!isOwnStatusLine(null));
});

test("isOwnStatusLine and splitCommand know package runners", () => {
  const commands = [
    ["npx claude-code-bar@latest --theme=ocean", "npx claude-code-bar@latest"],
    ["npx -y claude-code-bar@1.0.0 --theme=ocean", "npx -y claude-code-bar@1.0.0"],
    ["npx -p claude-code-bar@^1 claude-code-bar --theme=ocean", "npx -p claude-code-bar@^1 claude-code-bar"],
    ["bunx claude-code-bar --theme=ocean", "bunx claude-code-bar"],
    ["bunx --bun claude-code-bar@latest --theme=ocean", "bunx --bun claude-code-bar@latest"],
    ["pnpm dlx claude-code-bar@latest --theme=ocean", "pnpm dlx claude-code-bar@latest"],
    ["pnpx claude-code-bar@1.0.0 --theme=ocean", "pnpx claude-code-bar@1.0.0"],
    ["pnpm exec claude-code-bar --theme=ocean", "pnpm exec claude-code-bar"],
    ["yarn dlx claude-code-bar@latest --theme=ocean", "yarn dlx claude-code-bar@latest"],
    ["yarn dlx -q claude-code-bar@1.0.0 --theme=ocean", "yarn dlx -q claude-code-bar@1.0.0"],
    ["yarn dlx -p claude-code-bar@^1 claude-code-bar --theme=ocean", "yarn dlx -p claude-code-bar@^1 claude-code-bar"],
    ["yarn claude-code-bar --theme=ocean", "yarn claude-code-bar"],
    ["yarn exec claude-code-bar --theme=ocean", "yarn exec claude-code-bar"],
  ];
  for (const [command, binary] of commands) {
    assert.ok(isOwnStatusLine({ command }), command);
    assert.deepEqual(splitCommand(command), { binary, args: ["--theme=ocean"], suffix: "" }, command);
  }
  assert.ok(!isOwnStatusLine({ command: "npx claude-code-bar-fork@latest" }));
  assert.ok(!isOwnStatusLine({ command: "pnpm dlx other-bar@latest" }));
});

test("render prints the full status bar from stdin", (t) => {
  const home = makeHome(t);
  const cwd = mkdtempSync(join(tmpdir(), "ccb-project-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));

  const nineDaysFiveHours = Math.floor(Date.now() / 1000) + (9 * 24 + 5.5) * 3600;
  const input = JSON.stringify({
    model: { display_name: "Opus 5.5" },
    context_window: { used_percentage: 30 },
    workspace: { current_dir: cwd },
    cost: { total_duration_ms: 134_000 },
    rate_limits: {
      five_hour: { used_percentage: 48 },
      seven_day: { used_percentage: 21, resets_at: nineDaysFiveHours },
      extra_usage: { is_enabled: true, used_credits: 1560, monthly_limit: 8500, utilization: 18.35, currency: "EUR" },
    },
  });

  const result = run(home, [], input);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, [
    `🤖 Opus 5.5 │ 🧠 ${G}30%${R} │ ⏱️ 2m14s │ ${basename(cwd)}`,
    `⏱️ 5h  ${G}▓▓▓▓▓░░░░░ 48%${R}  resets ?`,
    `📅 7d  ${G}▓▓░░░░░░░░ 21%${R}  resets 9d5h`,
    `💰 Extra  ${G}▓▓░░░░░░░░ 18%${R}  €15.60 / €85`,
    "",
  ].join("\n"));
});

test("render prints nothing for empty or invalid stdin", (t) => {
  const home = makeHome(t);
  for (const input of ["", "not json", "[1,2]"]) {
    const result = run(home, [], input);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  }
});

test("install backs up a foreign statusLine and uninstall restores it", (t) => {
  const home = makeHome(t);
  const settingsPath = join(home, ".claude", "settings.json");
  const foreign = { type: "command", command: "ccusage statusline" };
  writeFileSync(settingsPath, JSON.stringify({ model: "opus", statusLine: foreign }));
  const readSettings = () => JSON.parse(readFileSync(settingsPath, "utf8"));

  assert.equal(run(home, ["--install"]).status, 0);
  assert.equal(readSettings().statusLine.command, "claude-code-bar");
  assert.equal(readSettings().model, "opus");

  // Reinstalling must not overwrite the backup with our own statusLine
  assert.equal(run(home, ["--install"]).status, 0);

  assert.equal(run(home, ["--uninstall"]).status, 0);
  assert.deepEqual(readSettings(), { model: "opus", statusLine: foreign });
  assert.ok(!existsSync(join(home, ".claude", "claude-code-bar.statusline-backup.json")));
});

test("uninstall leaves a foreign statusLine untouched", (t) => {
  const home = makeHome(t);
  const settingsPath = join(home, ".claude", "settings.json");
  const original = JSON.stringify({ statusLine: { type: "command", command: "ccusage statusline" } });
  writeFileSync(settingsPath, original);

  assert.equal(run(home, ["--uninstall"]).status, 0);
  assert.equal(readFileSync(settingsPath, "utf8"), original);
});

test("uninstall removes our statusLine when there is no backup", (t) => {
  const home = makeHome(t);
  const settingsPath = join(home, ".claude", "settings.json");
  writeFileSync(settingsPath, JSON.stringify({ model: "opus" }));

  assert.equal(run(home, ["--install"]).status, 0);
  assert.equal(run(home, ["--uninstall"]).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(settingsPath, "utf8")), { model: "opus" });
});

test("--help and -h print usage", (t) => {
  const home = makeHome(t);
  for (const flag of ["--help", "-h"]) {
    const result = run(home, [flag]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^\n █▀▀ █   ▄▀█/); // a blank line above the logo
    assert.match(result.stdout, new RegExp(`█▀▄  ${PKG.version.replace(/\./g, "\\.")}\\n`));
    assert.doesNotMatch(result.stdout, /\x1b/); // not a terminal, so no color
    assert.match(result.stdout, /--install/);
    assert.match(result.stdout, /--uninstall/);
  }
});

test("--install rejects unknown or invalid options", (t) => {
  const home = makeHome(t);
  for (const [arg, message] of [["--instal", /^Unknown option: --instal\n/], ["--theme=neon", /^--theme: unknown value "neon"/]]) {
    const result = run(home, ["--install", arg]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
    assert.match(result.stderr, /Usage:/);
  }
  assert.ok(!existsSync(join(home, ".claude", "settings.json")));
});

test("display options are refused outside --install and the status bar", (t) => {
  const home = makeHome(t);
  const result = run(home, ["--uninstall", "--theme=ocean"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /only work with --install/);
});

test("--install writes display options into the command and reinstall keeps them", (t) => {
  const home = makeHome(t);
  const settingsPath = join(home, ".claude", "settings.json");
  const command = () => JSON.parse(readFileSync(settingsPath, "utf8")).statusLine.command;

  assert.equal(run(home, ["--install", "--hide=dir", "--theme=ocean"]).status, 0);
  assert.equal(command(), "claude-code-bar --theme=ocean --hide=dir");

  assert.equal(run(home, ["--install"]).status, 0);
  assert.equal(command(), "claude-code-bar --theme=ocean --hide=dir");
});

test("--config refuses to run without a terminal", (t) => {
  const home = makeHome(t);
  const result = run(home, ["--config"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /needs an interactive terminal/);
});

test("render applies display flags and skips bad ones", (t) => {
  const home = makeHome(t);
  const input = JSON.stringify({
    model: { display_name: "Opus 5.5" },
    context_window: { used_percentage: 30 },
    workspace: { current_dir: "/tmp/demo" },
    rate_limits: { five_hour: { used_percentage: 48 } },
  });
  const result = run(home, ["--layout=compact", "--hide=duration,dir", "--no-color", "--bar=bogus"], input);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "🤖 Opus 5.5 │ 🧠 30% │ 5h 48%\n");
});

test("render keeps the git branch when the status is too big for the buffer", (t) => {
  const home = makeHome(t);
  const cwd = mkdtempSync(join(tmpdir(), "ccb-repo-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd });
  // Over 64 KB of `git status --porcelain` output
  for (let i = 0; i < 2000; i++) writeFileSync(join(cwd, `untracked-file-with-a-long-name-${i}.txt`), "");

  const input = JSON.stringify({ workspace: { current_dir: cwd } });
  const result = run(home, ["--hide=model,context,duration,dir,update,5h,7d,sonnet,extra", "--no-color"], input);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "main*\n");
});

test("commands report unexpected errors instead of exiting silently", { skip: process.getuid?.() === 0 && "root can read any file" }, (t) => {
  const home = makeHome(t);
  const settingsPath = join(home, ".claude", "settings.json");
  writeFileSync(settingsPath, "{}");
  chmodSync(settingsPath, 0o000);

  for (const flag of ["--install", "--uninstall"]) {
    const result = run(home, [flag]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^❌ Error: EACCES/);
  }
});

test("install writes through a symlinked settings.json", (t) => {
  const home = makeHome(t);
  const settingsPath = join(home, ".claude", "settings.json");
  const dotfile = join(home, "dotfiles-settings.json");
  writeFileSync(dotfile, JSON.stringify({ model: "opus" }));
  symlinkSync(dotfile, settingsPath);

  assert.equal(run(home, ["--install"]).status, 0);
  assert.ok(lstatSync(settingsPath).isSymbolicLink());
  assert.equal(JSON.parse(readFileSync(dotfile, "utf8")).statusLine.command, "claude-code-bar");

  assert.equal(run(home, ["--uninstall"]).status, 0);
  assert.ok(lstatSync(settingsPath).isSymbolicLink());
  assert.deepEqual(JSON.parse(readFileSync(dotfile, "utf8")), { model: "opus" });
});

test("install keeps a package runner command and uninstall removes it", (t) => {
  const home = makeHome(t);
  const settingsPath = join(home, ".claude", "settings.json");
  const command = () => JSON.parse(readFileSync(settingsPath, "utf8")).statusLine?.command;
  writeFileSync(settingsPath, JSON.stringify({ statusLine: { type: "command", command: "pnpm dlx claude-code-bar@latest --hide=dir" } }));

  assert.equal(run(home, ["--install", "--theme=ocean"]).status, 0);
  assert.equal(command(), "pnpm dlx claude-code-bar@latest --theme=ocean");
  assert.ok(!existsSync(join(home, ".claude", "claude-code-bar.statusline-backup.json")));

  const result = run(home, ["--uninstall"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /uninstalled/);
  assert.equal(command(), undefined);
});

test("splitCommand keeps quoted paths and shell syntax", () => {
  const cases = [
    ['"/Users/John Doe/bin/claude-code-bar" --theme=ocean', '"/Users/John Doe/bin/claude-code-bar"', ["--theme=ocean"], ""],
    ["'/Users/John Doe/bin/claude-code-bar' --theme=ocean", "'/Users/John Doe/bin/claude-code-bar'", ["--theme=ocean"], ""],
    ["/Users/John\\ Doe/bin/claude-code-bar --theme=ocean", "/Users/John\\ Doe/bin/claude-code-bar", ["--theme=ocean"], ""],
    ["node \"/opt/my tools/bin/claude-code-bar.mjs\" --hide=\"dir,git\"", 'node "/opt/my tools/bin/claude-code-bar.mjs"', ["--hide=dir,git"], ""],
    ["claude-code-bar --theme=ocean 2>/dev/null", "claude-code-bar", ["--theme=ocean"], "2>/dev/null"],
    ["claude-code-bar --theme=ocean 2> /dev/null | head -3", "claude-code-bar", ["--theme=ocean"], "2> /dev/null | head -3"],
    ["NO_COLOR=1 claude-code-bar --hide=dir", "NO_COLOR=1 claude-code-bar", ["--hide=dir"], ""],
    ["C:\\Users\\me\\AppData\\Roaming\\npm\\claude-code-bar --theme=ocean", "C:\\Users\\me\\AppData\\Roaming\\npm\\claude-code-bar", ["--theme=ocean"], ""],
  ];
  for (const [command, binary, args, suffix] of cases) {
    assert.ok(isOwnStatusLine({ command }), command);
    assert.deepEqual(splitCommand(command), { binary, args, suffix }, command);
  }
  // claude-code-bar only after a pipe is someone else's command
  assert.ok(!isOwnStatusLine({ command: "ccusage statusline 2>&1 | grep claude-code-bar" }));
  assert.equal(buildCommand('"/a b/claude-code-bar"', ["--theme=ocean"], "2>/dev/null"), '"/a b/claude-code-bar" --theme=ocean 2>/dev/null');
  assert.equal(buildCommand("claude-code-bar", []), "claude-code-bar");
});

test("commandExecutable finds the program the shell will run", () => {
  assert.equal(commandExecutable("claude-code-bar --theme=ocean"), "claude-code-bar");
  assert.equal(commandExecutable("NO_COLOR=1 npx -y claude-code-bar@latest"), "npx");
  assert.equal(commandExecutable('"/Users/John Doe/bin/claude-code-bar" --hide=dir'), "/Users/John Doe/bin/claude-code-bar");
  assert.equal(commandExecutable(""), null);
});

// An executable file, for tests that need a program to exist (or to be on PATH)
function makeProgram(dir, name) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, "#!/bin/sh\n", { mode: 0o755 });
  return path;
}

test("install keeps a quoted program path and a shell suffix", (t) => {
  const home = makeHome(t);
  const settingsPath = join(home, ".claude", "settings.json");
  const program = makeProgram(join(home, "my tools"), "claude-code-bar");
  writeFileSync(settingsPath, JSON.stringify({ statusLine: { type: "command", command: `"${program}" --hide=dir 2>/dev/null` } }));

  const result = run(home, ["--install", "--theme=ocean"], "", { PATH: dirname(process.execPath) });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(readFileSync(settingsPath, "utf8")).statusLine.command, `"${program}" --theme=ocean 2>/dev/null`);
  assert.doesNotMatch(result.stderr, /not found/);
});

test("install warns only when the program can't be found", (t) => {
  const home = makeHome(t);
  const emptyDir = join(home, "empty-bin");
  mkdirSync(emptyDir);

  const missing = run(home, ["--install"], "", { PATH: emptyDir });
  assert.equal(missing.status, 0);
  assert.match(missing.stderr, /'claude-code-bar' is not found on your PATH/);
  assert.match(missing.stderr, /npm prefix -g/);

  const binDir = join(home, "bin");
  makeProgram(binDir, "claude-code-bar");
  const found = run(home, ["--install"], "", { PATH: binDir });
  assert.equal(found.status, 0);
  assert.doesNotMatch(found.stderr, /not found/);

  // Run through node: node has to be found, not claude-code-bar
  const settingsPath = join(home, ".claude", "settings.json");
  writeFileSync(settingsPath, JSON.stringify({ statusLine: { type: "command", command: "node /opt/ccb/bin/claude-code-bar.mjs" } }));
  const viaNode = run(home, ["--install"], "", { PATH: dirname(process.execPath) });
  assert.equal(viaNode.status, 0);
  assert.doesNotMatch(viaNode.stderr, /not found/);

  writeFileSync(settingsPath, JSON.stringify({ statusLine: { type: "command", command: "pnpm dlx claude-code-bar@latest" } }));
  const noPnpm = run(home, ["--install"], "", { PATH: emptyDir });
  assert.match(noPnpm.stderr, /'pnpm' is not found on your PATH/);
  assert.doesNotMatch(noPnpm.stderr, /npm prefix -g/);
});

test("the update check never writes through a symlink in the cache", (t) => {
  const home = makeHome(t);
  const cacheFile = join(home, ".cache", "claude-code-bar", "update-check.json");
  const target = join(home, "elsewhere.json");
  writeFileSync(target, "{}");
  rmSync(cacheFile);
  symlinkSync(target, cacheFile);

  const input = JSON.stringify({ workspace: { current_dir: home } });
  assert.equal(run(home, ["--hide=git,5h,7d,sonnet,extra"], input).status, 0);
  assert.equal(readFileSync(target, "utf8"), "{}");
});
