import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExtraUsage } from "../src/providers/oauth-provider.mjs";
import { parseRateLimit } from "../src/renderer/bar-builder.mjs";
import { renderBar } from "../src/renderer/progress-bar.mjs";
import { COLORS } from "../src/shared/colors.mjs";

test("parseRateLimit", () => {
  assert.equal(parseRateLimit(null), null);
  assert.equal(parseRateLimit({}), null);
  assert.equal(parseRateLimit({ used_percentage: "abc" }), null);

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

test("renderBar colors and clamps", () => {
  assert.equal(renderBar(48), `${COLORS.green}▓▓▓▓▓░░░░░ 48%${COLORS.reset}`);
  assert.equal(renderBar(50), `${COLORS.yellow}▓▓▓▓▓░░░░░ 50%${COLORS.reset}`);
  assert.equal(renderBar(80), `${COLORS.red}▓▓▓▓▓▓▓▓░░ 80%${COLORS.reset}`);
  assert.equal(renderBar(150), `${COLORS.red}▓▓▓▓▓▓▓▓▓▓ 100%${COLORS.reset}`);
  assert.equal(renderBar(-5), `${COLORS.green}░░░░░░░░░░ 0%${COLORS.reset}`);
  assert.equal(renderBar(NaN), `${COLORS.green}░░░░░░░░░░ 0%${COLORS.reset}`);
});
