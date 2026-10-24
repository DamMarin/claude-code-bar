import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOptions } from "../src/shared/options.mjs";
import { renderStatus } from "../src/renderer/status.mjs";
import { formatCountdown } from "../src/shared/format-reset.mjs";

const MIN = 60000;
const ESC = /\x1b\[[0-9;]*m/g;
const plain = (s) => s.replace(ESC, "");

function data(overrides = {}) {
  const now = Date.now();
  return {
    model: "Opus 5.5",
    contextPct: 30,
    durationMs: 134000,
    dir: "demo",
    git: { branch: "main", dirty: true },
    update: null,
    limits: {
      fiveHour: { percentage: 34, resetsAt: new Date(now + 130 * MIN + 30000) },
      sevenDay: { percentage: 63, resetsAt: new Date(now + (3 * 1440 + 240) * MIN + 30000) },
      sevenDaySonnet: { percentage: 88, resetsAt: new Date(now + (5 * 1440 + 60) * MIN + 30000) },
      extraUsage: { percentage: 18.35, usedCredits: 1560, monthlyLimit: 8500, currency: "EUR" },
    },
    ...overrides,
  };
}

const render = (flags, d = data(), env = {}) => renderStatus(d, parseOptions(flags).options, { env });

test("default rendering", () => {
  const { head, rows } = render([]);
  assert.equal(head, "🤖 Opus 5.5 │ 🧠 \x1b[32m30%\x1b[0m │ ⏱️ 2m14s │ demo │ main*");
  assert.equal(rows.length, 4);
  assert.ok(plain(rows[1]).startsWith("📅 7d  ▓▓▓▓▓▓░░░░ 63%  resets "));
  assert.equal(rows[2].includes("\x1b[31m▓▓▓▓▓▓▓▓▓░ 88%\x1b[0m"), true);
  assert.equal(plain(rows[3]), "💰 Extra  ▓▓░░░░░░░░ 18%  €15.60 / €85");
});

test("text labels, order, hidden segments and separator", () => {
  const { head, rows } = render(["--no-emoji", "--order=git,model", "--hide=duration,sonnet", "--separator=slash", "--no-color"]);
  assert.equal(head, "main* / Opus 5.5 / ctx 30% / demo");
  // Text labels are padded so every bar starts in the same column
  assert.deepEqual(rows.map((r) => r.slice(0, 9)), ["5h      ▓", "7d      ▓", "Extra   ▓"]);
});

test("compact layout puts limits on the first line", () => {
  const { head, rows } = render(["--layout=compact", "--no-color", "--hide=dir"]);
  assert.equal(head, "🤖 Opus 5.5 │ 🧠 30% │ ⏱️ 2m14s │ main* │ 5h 34%  7d 63%  S 88%  💰 €15.60/€85");
  assert.deepEqual(rows, []);
});

test("bar style, width, left and countdown", () => {
  const { head, rows } = render(["--bar=dots", "--bar-width=5", "--show=left", "--reset=countdown", "--no-color"]);
  assert.match(head, /🧠 70% left/);
  assert.equal(rows[0], "⏱️ 5h  ●●●○○ 66% left  in 2h10m");
  assert.equal(rows[1], "📅 7d  ●●○○○ 37% left  in 3d4h");
});

test("thresholds change the level colors", () => {
  const { head } = render(["--thresholds=20,30"]);
  assert.match(head, /\x1b\[31m30%/);
});

test("themes", () => {
  const ocean = render(["--theme=ocean"]);
  assert.match(ocean.head, /\x1b\[96mOpus 5\.5\x1b\[0m/);
  assert.match(ocean.head, /\x1b\[36m30%/);

  const hc = render(["--theme=high-contrast"]);
  assert.match(hc.rows[2], /\x1b\[1;7;31m/);

  for (const theme of ["none", "mono"]) {
    const { head, rows } = render([`--theme=${theme}`]);
    assert.doesNotMatch([head, ...rows].join(""), /\x1b\[(3|9)\d/, theme);
  }
});

test("NO_COLOR removes every color", () => {
  const { head, rows } = render(["--theme=ocean"], data(), { NO_COLOR: "1" });
  assert.doesNotMatch([head, ...rows].join(""), /\x1b/);
});

test("missing segments and limits are left out", () => {
  const { head, rows } = render(["--no-color"], data({ git: null, limits: { sevenDay: data().limits.sevenDay } }));
  assert.equal(head, "🤖 Opus 5.5 │ 🧠 30% │ ⏱️ 2m14s │ demo");
  assert.equal(rows.length, 1);

  const allHidden = render(["--hide=model,context,duration,dir,git,update", "--no-color"]);
  assert.equal(allHidden.head, null);
});

test("marks underline what a setting affects", () => {
  const { head } = renderStatus(data(), parseOptions(["--no-color"]).options, { mark: ["git"], env: {} });
  assert.match(head, /\x1b\[4mmain\*\x1b\[0m/);
});

test("formatCountdown", () => {
  const now = Date.now();
  assert.equal(formatCountdown(null), "?");
  assert.equal(formatCountdown(new Date(now - 1000)), "now");
  assert.equal(formatCountdown(new Date(now + 45 * MIN + 30000)), "in 45m");
  assert.equal(formatCountdown(new Date(now + 130 * MIN + 30000)), "in 2h10m");
  assert.equal(formatCountdown(new Date(now + (3 * 1440 + 240) * MIN + 30000)), "in 3d4h");
});
