import { basename } from "node:path";
import { parseStdin } from "../providers/stdin-parser.mjs";
import { getGitInfo } from "../providers/git-provider.mjs";
import { getSettings } from "../providers/settings-provider.mjs";
import { fetchUsage, parseExtraUsage } from "../providers/oauth-provider.mjs";
import { getUpdateInfo, scheduleUpdateCheck } from "../cli/update-check.mjs";
import { DEFAULT_OPTIONS, RATE_LIMITS } from "../shared/options.mjs";
import { renderStatus } from "./status.mjs";

function safeString(val, fallback) {
  return typeof val === "string" && val.length > 0 && val.length < 256 ? val : fallback;
}

function safeNumber(val, fallback, min = 0, max = Infinity) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function parseRateLimit(obj) {
  if (!obj || typeof obj !== "object") return null;
  const pct = safeNumber(obj.used_percentage, null, 0, 100);
  if (pct === null) return null;
  // Missing reset time stays null (rendered as "?"), not the 1970 epoch
  const ts = safeNumber(obj.resets_at, 0, 0);
  return { percentage: pct, resetsAt: ts > 0 ? new Date(ts * 1000) : null };
}

// Rate limits: prefer stdin data, fall back to the OAuth usage API.
// Nothing is fetched (and no token is read) for limits that are hidden.
async function loadRateLimits(data, hidden) {
  if (RATE_LIMITS.every((key) => hidden.has(key))) return {};

  if (data?.rate_limits && typeof data.rate_limits === "object") {
    const limits = {
      fiveHour: parseRateLimit(data.rate_limits.five_hour),
      sevenDay: parseRateLimit(data.rate_limits.seven_day),
      sevenDaySonnet: parseRateLimit(data.rate_limits.seven_day_sonnet),
      extraUsage: parseExtraUsage(data.rate_limits.extra_usage),
    };
    // Stdin doesn't always include rich extra_usage fields — fill from OAuth.
    if (!limits.extraUsage && !hidden.has("extra")) {
      const oauth = await fetchUsage();
      if (oauth?.extraUsage) limits.extraUsage = oauth.extraUsage;
    }
    return limits;
  }

  return (await fetchUsage()) ?? {};
}

export async function render(options = DEFAULT_OPTIONS) {
  try {
    const data = await parseStdin();
    if (!data) process.exit(0);

    // Extract with fallbacks and type validation
    const hidden = new Set(options.hidden);
    const settings = getSettings();
    const cwd = safeString(data?.workspace?.current_dir, process.cwd());
    const status = {
      model: safeString(data?.model?.display_name, null) || safeString(settings.model, "unknown"),
      contextPct: safeNumber(data?.context_window?.used_percentage, 0, 0, 100),
      durationMs: safeNumber(data?.cost?.total_duration_ms, 0, 0),
      dir: basename(cwd),
      git: hidden.has("git") ? null : getGitInfo(cwd),
      update: hidden.has("update") ? null : (getUpdateInfo()?.latest ?? null),
      limits: {},
    };

    if (!hidden.has("update")) {
      // Trigger background check for next time
      scheduleUpdateCheck();
    }

    // Print the first line before any network call, so a slow API never blanks the bar
    const compact = options.layout === "compact";
    if (!compact) {
      const { head } = renderStatus(status, options);
      if (head) console.log(head);
    }

    status.limits = await loadRateLimits(data, hidden);
    const { head, rows } = renderStatus(status, options);
    if (compact && head) console.log(head);
    for (const row of rows) console.log(row);
  } catch {
    // Never crash, never print errors to stdout
    process.exit(0);
  }
}
