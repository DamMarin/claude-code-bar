import { parseStdin } from "../providers/stdin-parser.mjs";
import { getGitInfo } from "../providers/git-provider.mjs";
import { getSettings } from "../providers/settings-provider.mjs";
import { fetchUsage } from "../providers/oauth-provider.mjs";
import * as seg from "./segments.mjs";

function safeString(val, fallback) {
  return typeof val === "string" && val.length > 0 && val.length < 256 ? val : fallback;
}

function safeNumber(val, fallback, min = 0, max = Infinity) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseRateLimit(obj) {
  if (!obj || typeof obj !== "object") return null;
  const pct = safeNumber(obj.used_percentage, null, 0, 100);
  if (pct === null) return null;
  const ts = safeNumber(obj.resets_at, 0, 0);
  return { percentage: pct, resetsAt: new Date(ts * 1000) };
}

export async function render() {
  try {
    const data = await parseStdin();
    if (!data) process.exit(0);

    // Extract with fallbacks and type validation
    const settings = getSettings();
    const model = safeString(data?.model?.display_name, null)
      || safeString(settings.model, "unknown");
    const ctxPct = safeNumber(data?.context_window?.used_percentage, 0, 0, 100);
    const cwd = safeString(data?.workspace?.current_dir, process.cwd());
    const durationMs = safeNumber(data?.cost?.total_duration_ms, 0, 0);
    const gitInfo = getGitInfo(cwd);
    const compact = (process.stdout.columns || 80) < 80;

    // Build Line 1
    const parts = [
      seg.modelSegment(model, compact),
      seg.contextSegment(ctxPct, compact),
      seg.directorySegment(cwd, compact),
      seg.gitSegment(gitInfo, compact),
      seg.durationSegment(durationMs, compact),
      seg.effortSegment(settings.effortLevel, compact),
    ].filter(Boolean);

    console.log(parts.join(" │ "));

    // Rate limits: prefer stdin data, fallback to OAuth
    let rateLimits = null;

    if (data?.rate_limits && typeof data.rate_limits === "object") {
      rateLimits = {
        fiveHour: parseRateLimit(data.rate_limits.five_hour),
        sevenDay: parseRateLimit(data.rate_limits.seven_day),
        sevenDaySonnet: parseRateLimit(data.rate_limits.seven_day_sonnet),
        extraUsage: parseRateLimit(data.rate_limits.extra_usage),
      };
    } else {
      rateLimits = await fetchUsage();
    }

    if (rateLimits?.fiveHour) {
      console.log(seg.rateLimitSegment("⏱️ 5h", rateLimits.fiveHour.percentage, rateLimits.fiveHour.resetsAt));
    }
    if (rateLimits?.sevenDay) {
      console.log(seg.rateLimitSegment("📅 7d", rateLimits.sevenDay.percentage, rateLimits.sevenDay.resetsAt));
    }
    if (rateLimits?.sevenDaySonnet) {
      console.log(seg.rateLimitSegment("🎵 S", rateLimits.sevenDaySonnet.percentage, rateLimits.sevenDaySonnet.resetsAt));
    }
    if (rateLimits?.extraUsage && rateLimits.extraUsage.percentage > 0) {
      console.log(seg.rateLimitSegment("💰 Extra", rateLimits.extraUsage.percentage, rateLimits.extraUsage.resetsAt));
    }

  } catch {
    // Never crash, never print errors to stdout
    process.exit(0);
  }
}
