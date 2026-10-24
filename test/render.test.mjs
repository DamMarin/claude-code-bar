// How the rate limit windows from stdin and the usage API are combined
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRateLimits } from "../src/commands/render.mjs";

const window = (percentage) => ({ percentage, resetsAt: null });
const API = {
  fiveHour: window(99),
  sevenDay: window(21),
  sevenDaySonnet: window(5),
  extraUsage: { percentage: 18.35, usedCredits: 1560, monthlyLimit: 8500, currency: "EUR" },
};
const SENT = { rate_limits: { five_hour: { used_percentage: 48, resets_at: 1_738_425_600 }, seven_day: { used_percentage: 41 } } };

// A stand-in for fetchUsage that counts its calls
function answering(value) {
  let calls = 0;
  return { usage: async () => { calls++; return value; }, calls: () => calls };
}

test("windows Claude Code did not send come from the usage API; the ones it sent win", async () => {
  const api = answering(API);
  const limits = await loadRateLimits(SENT, new Set(), api);
  assert.deepEqual(limits, {
    fiveHour: { percentage: 48, resetsAt: new Date(1_738_425_600_000) },
    sevenDay: { percentage: 41, resetsAt: null },
    sevenDaySonnet: API.sevenDaySonnet,
    extraUsage: API.extraUsage,
  });
  assert.equal(api.calls(), 1);
});

test("a window Claude Code dropped after its reset comes back from the API", async () => {
  const api = answering(API);
  const limits = await loadRateLimits({ rate_limits: { seven_day: { used_percentage: 41 } } }, new Set(["sonnet", "extra"]), api);
  assert.deepEqual(limits, { fiveHour: API.fiveHour, sevenDay: window(41), sevenDaySonnet: null, extraUsage: null });
  assert.equal(api.calls(), 1);
});

test("nothing is fetched while every shown window is known", async () => {
  const api = answering(API);
  const limits = await loadRateLimits(SENT, new Set(["sonnet", "extra"]), api);
  assert.equal(limits.fiveHour.percentage, 48);
  assert.equal(limits.sevenDaySonnet, null);
  assert.equal(api.calls(), 0);
});

test("nothing is fetched when every window is hidden", async () => {
  const api = answering(API);
  const limits = await loadRateLimits({}, new Set(["5h", "7d", "sonnet", "extra"]), api);
  assert.deepEqual(limits, { fiveHour: null, sevenDay: null, sevenDaySonnet: null, extraUsage: null });
  assert.equal(api.calls(), 0);
});

test("without rate limits on stdin everything comes from the API", async () => {
  assert.deepEqual(await loadRateLimits({ model: {} }, new Set(), answering(API)), API);
  assert.deepEqual(await loadRateLimits({ rate_limits: "junk" }, new Set(), answering(API)), API);
});

test("a failed fetch leaves the missing windows empty", async () => {
  const limits = await loadRateLimits(SENT, new Set(), answering(null));
  assert.equal(limits.fiveHour.percentage, 48);
  assert.equal(limits.sevenDaySonnet, null);
  assert.equal(limits.extraUsage, null);
});
