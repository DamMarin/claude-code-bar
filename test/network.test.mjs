// The usage API and update check, answered by stand-in fetches: nothing touches the network.
// HOME points at a temp folder before the modules load, since their cache paths come from it.
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOKEN = "sk-ant-oat01-test-token";
const home = mkdtempSync(join(tmpdir(), "ccb-network-"));
process.env.HOME = home;
process.env.USERPROFILE = home;
// Neither `security` nor `secret-tool` can be found, so the env token is the only one ever read
process.env.PATH = join(home, "empty-bin");
process.env.CLAUDE_CODE_OAUTH_TOKEN = TOKEN;
after(() => rmSync(home, { recursive: true, force: true }));

const { fetchUsage, USAGE_URL } = await import("../src/io/usage-api.mjs");
const { checkLatest, getUpdateInfo, scheduleUpdateCheck } = await import("../src/io/update-check.mjs");
const PKG = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const CACHE_DIR = join(home, ".cache", "claude-code-bar");
const USAGE_CACHE = join(CACHE_DIR, "usage-cache.json");
const UPDATE_CACHE = join(CACHE_DIR, "update-check.json");
const readCache = (file) => JSON.parse(readFileSync(file, "utf8"));

beforeEach(() => {
  rmSync(USAGE_CACHE, { force: true });
  rmSync(UPDATE_CACHE, { force: true });
});

// A fetch that records its calls and answers each with the next response
function answering(...responses) {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error("unexpected request");
    return next;
  };
  return { request, calls };
}

const json = (body, init) => new Response(JSON.stringify(body), init);

const USAGE = {
  five_hour: { utilization: 48, resets_at: "2026-10-24T15:00:00Z" },
  seven_day: { utilization: 21.5, resets_at: "2026-10-30T09:00:00Z" },
  seven_day_sonnet: null,
  extra_usage: { is_enabled: true, used_credits: 1560, monthly_limit: 8500, utilization: 18.35, currency: "EUR" },
};

/* ---------- usage API ---------- */

test("fetchUsage sends the login token and parses the answer", async () => {
  const { request, calls } = answering(json(USAGE));
  const usage = await fetchUsage({ request });

  assert.deepEqual(usage, {
    fiveHour: { percentage: 48, resetsAt: new Date("2026-10-24T15:00:00Z") },
    sevenDay: { percentage: 21.5, resetsAt: new Date("2026-10-30T09:00:00Z") },
    sevenDaySonnet: null,
    extraUsage: { percentage: 18.35, usedCredits: 1560, monthlyLimit: 8500, currency: "EUR" },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, USAGE_URL);
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test("fetchUsage answers from the cache for a minute", async () => {
  const first = await fetchUsage(answering(json(USAGE)));
  assert.equal(readCache(USAGE_CACHE).ttl, 60_000);

  // A second request would throw: the cached data comes back, dates included
  const { request, calls } = answering();
  assert.deepEqual(await fetchUsage({ request }), first);
  assert.equal(calls.length, 0);
});

test("a rate limited answer waits for retry-after, between 5 and 30 minutes", async () => {
  for (const [retryAfter, ttl] of [["600", 600_000], [null, 300_000], ["10", 300_000], ["86400", 1_800_000], ["soon", 300_000]]) {
    rmSync(USAGE_CACHE, { force: true });
    const headers = retryAfter ? { "retry-after": retryAfter } : {};
    assert.equal(await fetchUsage(answering(new Response("", { status: 429, headers }))), null);
    assert.equal(readCache(USAGE_CACHE).ttl, ttl, `retry-after: ${retryAfter}`);

    // The failure is cached: no new request until it expires
    const { request, calls } = answering();
    assert.equal(await fetchUsage({ request }), null);
    assert.equal(calls.length, 0);
  }
});

test("a missing endpoint waits an hour, other errors a minute", async () => {
  for (const [status, ttl] of [[404, 3_600_000], [410, 3_600_000], [500, 60_000], [401, 60_000]]) {
    rmSync(USAGE_CACHE, { force: true });
    assert.equal(await fetchUsage(answering(new Response("", { status }))), null);
    assert.equal(readCache(USAGE_CACHE).ttl, ttl, `HTTP ${status}`);
  }
});

test("oversized, invalid or failed answers are cached failures", async () => {
  const answers = [
    new Response("{}", { headers: { "content-length": "100000" } }),
    new Response(`{"padding":"${"x".repeat(70_000)}"}`),
    new Response("not json"),
    new Error("network down"),
  ];
  for (const answer of answers) {
    rmSync(USAGE_CACHE, { force: true });
    assert.equal(await fetchUsage(answering(answer)), null);
    const cache = readCache(USAGE_CACHE);
    assert.equal(cache.data, null);
    assert.equal(cache.ttl, 60_000);
  }
});

test("without a token nothing is sent", async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = "short";
  try {
    const { request, calls } = answering();
    assert.equal(await fetchUsage({ request }), null);
    assert.equal(calls.length, 0);
  } finally {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = TOKEN;
  }
});

/* ---------- update check ---------- */

test("getUpdateInfo reports only a newer version", () => {
  mkdirSync(CACHE_DIR, { recursive: true });
  for (const [latest, expected] of [["99.0.0", { current: PKG.version, latest: "99.0.0" }], [PKG.version, null], ["0.0.1", null], ["junk", null]]) {
    writeFileSync(UPDATE_CACHE, JSON.stringify({ latest, checkedAt: Date.now() }));
    assert.deepEqual(getUpdateInfo(), expected, latest);
  }
  rmSync(UPDATE_CACHE);
  assert.equal(getUpdateInfo(), null);
});

test("checkLatest caches the version npm reports", async () => {
  const { request, calls } = answering(json({ name: PKG.name, version: "9.9.9" }));
  await checkLatest({ request });
  assert.equal(calls[0].url, `https://registry.npmjs.org/${PKG.name}/latest`);
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  const cache = readCache(UPDATE_CACHE);
  assert.equal(cache.latest, "9.9.9");
  assert.equal(typeof cache.checkedAt, "number");
});

test("checkLatest writes nothing for a bad answer and never throws", async () => {
  for (const answer of [new Response("", { status: 503 }), json({ version: 42 }), new Response("not json"), new Error("offline")]) {
    await checkLatest(answering(answer));
    assert.ok(!existsSync(UPDATE_CACHE));
  }
});

// A stand-in for child_process.spawn that records what would be started
function starter() {
  const started = [];
  const start = (command, args, options) => {
    const child = { unrefed: false, unref() { this.unrefed = true; } };
    started.push({ command, args, options, child });
    return child;
  };
  return { start, started };
}

test("scheduleUpdateCheck starts one detached check and records the attempt", () => {
  const { start, started } = starter();
  scheduleUpdateCheck({ start });

  assert.equal(started.length, 1);
  const [{ command, args, options, child }] = started;
  assert.equal(command, process.execPath);
  assert.deepEqual(args.slice(0, 2), ["--input-type=module", "-e"]);
  assert.deepEqual(options, { detached: true, stdio: "ignore" });
  assert.ok(child.unrefed);
  assert.equal(typeof readCache(UPDATE_CACHE).attemptedAt, "number");

  // The script loads: the import the background process makes resolves
  const loadOnly = args[2].replace("await checkLatest();", "");
  assert.notEqual(loadOnly, args[2]);
  assert.equal(spawnSync(process.execPath, ["--input-type=module", "-e", loadOnly]).status, 0);

  // A check was just attempted, so the next render starts none
  scheduleUpdateCheck({ start });
  assert.equal(started.length, 1);
});

test("scheduleUpdateCheck waits a day after a check and an hour after an attempt", () => {
  mkdirSync(CACHE_DIR, { recursive: true });
  const hour = 3_600_000;
  const cases = [
    [{ latest: "1.0.0", checkedAt: Date.now() - 23 * hour }, 0],
    [{ latest: "1.0.0", checkedAt: Date.now() - 25 * hour }, 1],
    [{ attemptedAt: Date.now() - 30 * 60_000 }, 0],
    [{ attemptedAt: Date.now() - 2 * hour }, 1],
  ];
  for (const [cache, expected] of cases) {
    writeFileSync(UPDATE_CACHE, JSON.stringify(cache));
    const { start, started } = starter();
    scheduleUpdateCheck({ start });
    assert.equal(started.length, expected, JSON.stringify(cache));
  }
});
