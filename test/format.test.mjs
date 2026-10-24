import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration } from "../src/shared/format-duration.mjs";
import { formatMoney } from "../src/shared/format-money.mjs";
import { formatReset } from "../src/shared/format-reset.mjs";

const HOUR = 60 * 60 * 1000;

test("formatDuration", () => {
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(NaN), "0s");
  assert.equal(formatDuration(-5000), "0s");
  assert.equal(formatDuration(59_999), "59s");
  assert.equal(formatDuration(134_000), "2m14s");
  assert.equal(formatDuration(3_900_000), "1h5m");
});

test("formatMoney uses the currency's symbol and minor unit", () => {
  assert.equal(formatMoney(1560, "EUR"), "€15.60");
  assert.equal(formatMoney(8500, "EUR"), "€85");
  assert.equal(formatMoney(1234, "USD"), "$12.34");
  assert.equal(formatMoney(500, "GBP"), "£5");
  assert.equal(formatMoney(1500, "JPY"), "¥1,500");
  assert.match(formatMoney(1560, "CHF"), /^CHF\s15\.60$/); // ICU uses a no-break space
});

test("formatMoney falls back for unknown or missing currency", () => {
  assert.equal(formatMoney(1560, "zz"), "zz 15.60");
  assert.equal(formatMoney(1560, null), "15.60");
  assert.equal(formatMoney(8500, null), "85");
  assert.equal(formatMoney(NaN, "EUR"), "?");
});

test("formatReset", () => {
  assert.equal(formatReset(null), "?");
  assert.equal(formatReset(new Date(NaN)), "?");
  assert.equal(formatReset(new Date(Date.now() - 1000)), "now");
  assert.match(formatReset(new Date(Date.now() + 2 * HOUR)), /^\d{2}:\d{2}$/);
  assert.match(formatReset(new Date(Date.now() + 3 * 24 * HOUR)), /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
  assert.equal(formatReset(new Date(Date.now() + 9 * 24 * HOUR + 5.5 * HOUR)), "9d5h");
});
