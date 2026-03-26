import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, lstatSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CACHE_DIR = join(homedir(), ".cache", "claude-code-bar");
const CACHE_PATH = join(CACHE_DIR, "usage-cache.json");
const CACHE_TTL_MS = 60000;
const MAX_BUFFER = 16 * 1024; // 16 KB — credentials JSON is small
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

function resolveToken() {
  // 1. Environment variable
  const envToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (isValidToken(envToken)) return envToken;

  // 2. macOS Keychain
  try {
    const raw = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      EXEC_OPTS
    ).trim();
    const token = extractToken(raw);
    if (token) return token;
  } catch { /* not on macOS or not found */ }

  // 3. File: ~/.claude/.credentials.json
  try {
    const raw = readFileSync(join(homedir(), ".claude", ".credentials.json"), "utf8");
    const token = extractToken(raw);
    if (token) return token;
  } catch { /* file not found */ }

  // 4. Linux secret-tool
  try {
    const raw = execSync(
      'secret-tool lookup service "Claude Code-credentials"',
      EXEC_OPTS
    ).trim();
    const token = extractToken(raw);
    if (token) return token;
  } catch { /* not on Linux or not found */ }

  return null;
}

function isValidUsageEntry(entry) {
  return entry === null || (
    typeof entry === "object"
    && typeof entry.percentage === "number"
    && Number.isFinite(entry.percentage)
    && entry.resetsAt instanceof Date
    && !isNaN(entry.resetsAt)
  );
}

function isValidCacheData(data) {
  return data
    && typeof data === "object"
    && isValidUsageEntry(data.fiveHour)
    && isValidUsageEntry(data.sevenDay);
}

function isSafeToWrite(filePath) {
  try {
    const stat = lstatSync(filePath);
    return !stat.isSymbolicLink();
  } catch (err) {
    return err.code === "ENOENT";
  }
}

function readCache() {
  try {
    const cache = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
    if (typeof cache.timestamp !== "number" || (Date.now() - cache.timestamp) >= CACHE_TTL_MS) {
      return null;
    }
    // Rehydrate Date objects from serialized cache
    const data = cache.data;
    if (!data || typeof data !== "object") return null;
    for (const key of ["fiveHour", "sevenDay", "sevenDaySonnet", "extraUsage"]) {
      if (data[key] && typeof data[key].resetsAt === "string") {
        data[key].resetsAt = new Date(data[key].resetsAt);
        if (isNaN(data[key].resetsAt)) data[key] = null;
      }
    }
    return data;
  } catch { /* no cache */ }
  return null;
}

function writeCache(data) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
    if (isSafeToWrite(CACHE_PATH)) {
      writeFileSync(CACHE_PATH, JSON.stringify({ timestamp: Date.now(), data }), { mode: 0o600 });
    }
  } catch { /* cache write failed */ }
}

function parseUsageEntry(obj) {
  if (!obj || typeof obj !== "object") return null;
  const pct = Number(obj.utilization);
  if (!Number.isFinite(pct)) return null;
  const resetsAt = new Date(obj.resets_at);
  if (isNaN(resetsAt)) return null;
  return { percentage: Math.max(0, Math.min(100, pct)), resetsAt };
}

export async function fetchUsage() {
  // Check cache first
  const cached = readCache();
  if (cached) return cached;

  const token = resolveToken();
  if (!token) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
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
      return null;
    }

    // Guard against oversized responses
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      clearTimeout(timeout);
      return null;
    }

    const text = await res.text();
    clearTimeout(timeout);

    if (text.length > MAX_RESPONSE_BYTES) return null;

    const json = JSON.parse(text);

    const result = {
      fiveHour: parseUsageEntry(json.five_hour),
      sevenDay: parseUsageEntry(json.seven_day),
      sevenDaySonnet: parseUsageEntry(json.seven_day_sonnet),
      extraUsage: parseUsageEntry(json.extra_usage),
    };

    writeCache(result);
    return result;
  } catch {
    return null;
  }
}
