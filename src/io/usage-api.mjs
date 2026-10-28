// Rate limits from the Claude Code OAuth usage API, with the login token.
// The endpoint is not a public, documented API: it can change or disappear without notice.
// Every failure just hides the limits, and Claude Code's own stdin data is preferred anyway.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readCacheJson, writeCacheJson } from "./files.mjs";

const CACHE_NAME = "usage-cache.json";
const CACHE_TTL_MS = 60000;
const FAILURE_TTL_MS = 60000; // missing token, network error, bad response
const RATE_LIMITED_TTL_MS = 5 * 60000; // HTTP 429
const GONE_TTL_MS = 60 * 60000; // HTTP 404 or 410: the endpoint may have been removed
const MAX_RETRY_AFTER_MS = 30 * 60000;
const MAX_BUFFER = 16 * 1024; // 16 KB — credentials JSON is small
// The keychain tools run directly, without a shell in between
const EXEC_OPTS = { encoding: "utf8", timeout: 2000, maxBuffer: MAX_BUFFER, stdio: ["pipe", "pipe", "pipe"] };
const MAX_RESPONSE_BYTES = 64 * 1024; // 64 KB — reject oversized API responses

function isValidToken(token) {
  return typeof token === "string"
    && token.length >= 10
    && token.length <= 4096
    && /^[\x20-\x7e]+$/.test(token); // printable ASCII only
}

function extractToken(raw) {
  try {
    const parsed = JSON.parse(raw);
    const token = parsed?.claudeAiOauth?.accessToken;
    return isValidToken(token) ? token : null;
  } catch {
    return null;
  }
}

const CREDENTIALS_FILE = join(homedir(), ".claude", ".credentials.json");
// Where the token is stored: the file above, the macOS login keychain, the GNOME keyring
const CREDENTIAL_STORES = [
  CREDENTIALS_FILE,
  join(homedir(), "Library", "Keychains", "login.keychain-db"),
  join(homedir(), ".local", "share", "keyrings", "login.keyring"),
];

/**
 * Changes whenever the login may have: a different CLAUDE_CODE_OAUTH_TOKEN, or a write
 * to any place the token is stored (a new /login, a token refresh). The cache is only used
 * while this matches, so another account never sees the last one's usage. It is cheap
 * (a hash and a few stats), unlike reading the token, which can run `security` every render.
 */
function credentialsFingerprint() {
  const envToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const parts = [typeof envToken === "string" ? createHash("sha256").update(envToken).digest("hex").slice(0, 16) : ""];
  for (const store of CREDENTIAL_STORES) {
    try {
      parts.push(statSync(store).mtimeMs);
    } catch {
      parts.push(0);
    }
  }
  return parts.join(":");
}

function resolveToken() {
  // 1. Environment variable
  const envToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (isValidToken(envToken)) return envToken;

  // 2. macOS Keychain
  try {
    const raw = execFileSync(
      "security", ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      EXEC_OPTS
    ).trim();
    const token = extractToken(raw);
    if (token) return token;
  } catch { /* not on macOS or not found */ }

  // 3. File: ~/.claude/.credentials.json
  try {
    const raw = readFileSync(CREDENTIALS_FILE, "utf8");
    const token = extractToken(raw);
    if (token) return token;
  } catch { /* file not found */ }

  // 4. Linux secret-tool
  try {
    const raw = execFileSync(
      "secret-tool", ["lookup", "service", "Claude Code-credentials"],
      EXEC_OPTS
    ).trim();
    const token = extractToken(raw);
    if (token) return token;
  } catch { /* not on Linux or not found */ }

  return null;
}

// Returns undefined on a cache miss, null for a cached failure, or the usage data
function readCache(fingerprint) {
  try {
    const cache = readCacheJson(CACHE_NAME);
    if (!cache || typeof cache !== "object" || cache.fingerprint !== fingerprint) return undefined;
    const ttl = Number.isFinite(cache.ttl) ? cache.ttl : CACHE_TTL_MS;
    if (typeof cache.timestamp !== "number" || (Date.now() - cache.timestamp) >= ttl) {
      return undefined;
    }
    // Rehydrate Date objects from serialized cache
    const data = cache.data;
    if (data === null) return null;
    if (!data || typeof data !== "object") return undefined;
    for (const key of ["fiveHour", "sevenDay", "sevenDaySonnet"]) {
      if (data[key] && typeof data[key].resetsAt === "string") {
        data[key].resetsAt = new Date(data[key].resetsAt);
        if (isNaN(data[key].resetsAt)) data[key] = null;
      }
    }
    return data;
  } catch { /* no cache */ }
  return undefined;
}

function writeCache(fingerprint, data, ttl = CACHE_TTL_MS) {
  writeCacheJson(CACHE_NAME, { timestamp: Date.now(), ttl, fingerprint, data });
}

// Cache a failure so the API isn't retried on every render
function cacheFailure(fingerprint, ttl = FAILURE_TTL_MS) {
  writeCache(fingerprint, null, ttl);
  return null;
}

function failureTtl(res) {
  if (res.status === 429) return rateLimitedTtl(res);
  if (res.status === 404 || res.status === 410) return GONE_TTL_MS;
  return FAILURE_TTL_MS;
}

function rateLimitedTtl(res) {
  const seconds = Number(res.headers.get("retry-after"));
  if (!Number.isFinite(seconds) || seconds <= 0) return RATE_LIMITED_TTL_MS;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(RATE_LIMITED_TTL_MS, seconds * 1000));
}

function parseUsageEntry(obj) {
  if (!obj || typeof obj !== "object") return null;
  const pct = Number(obj.utilization);
  if (!Number.isFinite(pct)) return null;
  const resetsAt = new Date(obj.resets_at);
  if (isNaN(resetsAt)) return null;
  return { percentage: Math.max(0, Math.min(100, pct)), resetsAt };
}

export function parseExtraUsage(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.is_enabled === false) return null;
  const usedCredits = Number(obj.used_credits);
  const monthlyLimit = Number(obj.monthly_limit);
  if (!Number.isFinite(usedCredits) || !Number.isFinite(monthlyLimit)) return null;
  const pct = Number(obj.utilization);
  const percentage = Number.isFinite(pct)
    ? Math.max(0, Math.min(100, pct))
    : (monthlyLimit > 0 ? Math.max(0, Math.min(100, (usedCredits / monthlyLimit) * 100)) : 0);
  return {
    percentage,
    usedCredits: Math.max(0, usedCredits),
    monthlyLimit: Math.max(0, monthlyLimit),
    currency: typeof obj.currency === "string" ? obj.currency : null,
  };
}

export const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";

/**
 * Usage data for the logged-in account, from the cache or the API; null when unavailable.
 * `request` stands in for fetch, so tests can answer without the network.
 */
export async function fetchUsage({ request = fetch } = {}) {
  // Check cache first
  const fingerprint = credentialsFingerprint();
  const cached = readCache(fingerprint);
  if (cached !== undefined) return cached;

  const token = resolveToken();
  if (!token) return cacheFailure(fingerprint);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {

    const res = await request(USAGE_URL, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "claude-code-bar",
        "anthropic-beta": "oauth-2025-04-20",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      clearTimeout(timeout);
      return cacheFailure(fingerprint, failureTtl(res));
    }

    // Guard against oversized responses
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      clearTimeout(timeout);
      return cacheFailure(fingerprint);
    }

    const text = await res.text();
    clearTimeout(timeout);

    if (text.length > MAX_RESPONSE_BYTES) return cacheFailure(fingerprint);

    const json = JSON.parse(text);

    const result = {
      fiveHour: parseUsageEntry(json.five_hour),
      sevenDay: parseUsageEntry(json.seven_day),
      sevenDaySonnet: parseUsageEntry(json.seven_day_sonnet),
      extraUsage: parseExtraUsage(json.extra_usage),
    };

    writeCache(fingerprint, result);
    return result;
  } catch {
    clearTimeout(timeout);
    return cacheFailure(fingerprint);
  }
}
