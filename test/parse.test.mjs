import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExtraUsage } from "../src/io/usage-api.mjs";
import { parseRateLimit, safeNumber } from "../src/io/stdin.mjs";
import { barCells } from "../src/core/progress-bar.mjs";
import { stripControl } from "../src/core/sanitize.mjs";

test("parseRateLimit", () => {
  assert.equal(parseRateLimit(null), null);
  assert.equal(parseRateLimit({}), null);
  assert.equal(parseRateLimit({ used_percentage: "abc" }), null);
  assert.equal(parseRateLimit({ used_percentage: null }), null);

  assert.deepEqual(parseRateLimit({ used_percentage: 48, resets_at: 1_800_000_000 }), {
    percentage: 48,
    resetsAt: new Date(1_800_000_000_000),
  });
  assert.equal(parseRateLimit({ used_percentage: "48" }).percentage, 48);
  assert.equal(parseRateLimit({ used_percentage: 150 }).percentage, 100);
  assert.equal(parseRateLimit({ used_percentage: -3 }).percentage, 0);
});

test("parseRateLimit keeps a missing reset time as null", () => {
  assert.equal(parseRateLimit({ used_percentage: 48 }).resetsAt, null);
  assert.equal(parseRateLimit({ used_percentage: 48, resets_at: 0 }).resetsAt, null);
});

test("parseExtraUsage", () => {
  assert.equal(parseExtraUsage(null), null);
  assert.equal(parseExtraUsage({ is_enabled: false, used_credits: 1, monthly_limit: 2 }), null);
  assert.equal(parseExtraUsage({ used_credits: 100 }), null);

  assert.deepEqual(
    parseExtraUsage({ is_enabled: true, used_credits: 1560, monthly_limit: 8500, utilization: 18.35, currency: "EUR" }),
    { percentage: 18.35, usedCredits: 1560, monthlyLimit: 8500, currency: "EUR" },
  );
});

test("parseExtraUsage derives and clamps the percentage", () => {
  assert.equal(parseExtraUsage({ used_credits: 250, monthly_limit: 1000 }).percentage, 25);
  assert.equal(parseExtraUsage({ used_credits: 250, monthly_limit: 0 }).percentage, 0);
  assert.equal(parseExtraUsage({ used_credits: 1, monthly_limit: 1, utilization: 140 }).percentage, 100);

  const negative = parseExtraUsage({ used_credits: -5, monthly_limit: -1, currency: 42 });
  assert.equal(negative.usedCredits, 0);
  assert.equal(negative.monthlyLimit, 0);
  assert.equal(negative.currency, null);
});

test("barCells fills and clamps", () => {
  assert.equal(barCells(48), "▓▓▓▓▓░░░░░");
  assert.equal(barCells(80), "▓▓▓▓▓▓▓▓░░");
  assert.equal(barCells(150), "▓▓▓▓▓▓▓▓▓▓");
  assert.equal(barCells(-5), "░░░░░░░░░░");
  assert.equal(barCells(NaN), "░░░░░░░░░░");
});

test("barCells styles and widths", () => {
  assert.equal(barCells(50, "dots", 4), "●●○○");
  assert.equal(barCells(50, "line", 6), "━━━───");
  assert.equal(barCells(34, "braille", 10), "⣿⣿⣿⣤⣀⣀⣀⣀⣀⣀");
  assert.equal(barCells(100, "braille", 5), "⣿⣿⣿⣿⣿");
  assert.equal(barCells(50, "unknown", 4), "▓▓░░");
});

test("stripControl removes escape sequences whole, then control characters", () => {
  assert.equal(stripControl("\x1b[31mred\x1b[0m"), "red");
  assert.equal(stripControl("\x1b[1;38;5;196mbold\x1b[m"), "bold");
  assert.equal(stripControl("a\x1b]0;new title\x07b"), "ab");
  assert.equal(stripControl("a\x1b]8;;https://example.com\x1b\\link\x1b]8;;\x1b\\b"), "alinkb");
  assert.equal(stripControl("line\nbreak\ttab\x9bc1"), "linebreaktabc1");
  assert.equal(stripControl("feature/ünïcödé-🚀"), "feature/ünïcödé-🚀");
});

test("safeNumber treats null like a missing value, not like 0", () => {
  assert.equal(safeNumber(null, "unknown"), "unknown");
  assert.equal(safeNumber(undefined, "unknown"), "unknown");
  assert.equal(safeNumber("abc", "unknown"), "unknown");
  assert.equal(safeNumber(0, "unknown"), 0);
  assert.equal(safeNumber("30", "unknown", 0, 100), 30);
  assert.equal(safeNumber(150, null, 0, 100), 100);
});
