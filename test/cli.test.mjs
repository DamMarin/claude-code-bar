import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compareVersions } from "../src/cli/update-check.mjs";
import { isOwnStatusLine } from "../src/cli/status-line.mjs";

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

function run(home, args, input = "") {
  const env = { ...process.env, HOME: home, USERPROFILE: home };
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
    assert.match(result.stdout, new RegExp(`^claude-code-bar ${PKG.version.replace(/\./g, "\\.")}\\n`));
    assert.match(result.stdout, /--install/);
    assert.match(result.stdout, /--uninstall/);
  }
});

test("an unknown option fails with usage on stderr", (t) => {
  const home = makeHome(t);
  const result = run(home, ["--instal"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^Unknown option: --instal\n/);
  assert.match(result.stderr, /Usage:/);
});
