// The status bar itself: gathers data from io/, renders it with core/, prints it
import { basename } from "node:path";
import { DEFAULT_OPTIONS, RATE_LIMITS } from "../core/options.mjs";
import { renderStatus } from "../core/status.mjs";
import { stripControl } from "../core/sanitize.mjs";
import { readStdin, parseRateLimit, safeNumber, safeString } from "../io/stdin.mjs";
import { getGitInfo } from "../io/git.mjs";
import { readDefaultModel } from "../io/settings-file.mjs";
import { fetchUsage, parseExtraUsage } from "../io/usage-api.mjs";
import { getUpdateInfo, scheduleUpdateCheck } from "../io/update-check.mjs";

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
    const data = await readStdin();
    if (!data) process.exit(0);

    // Extract with fallbacks and type validation. Names that end up on screen are stripped
    // of control characters, so a folder or model name can't send escape codes to the terminal.
    const hidden = new Set(options.hidden);
    const cwd = safeString(data?.workspace?.current_dir, process.cwd());
    const status = {
      model: stripControl(safeString(data?.model?.display_name, null) || safeString(readDefaultModel(), "unknown")),
      contextPct: safeNumber(data?.context_window?.used_percentage, 0, 0, 100),
      durationMs: safeNumber(data?.cost?.total_duration_ms, 0, 0),
      dir: stripControl(basename(cwd)),
      git: hidden.has("git") ? null : getGitInfo(cwd),
      update: hidden.has("update") ? null : stripControl(getUpdateInfo()?.latest ?? "") || null,
      limits: {},
    };

    if (!hidden.has("update")) {
      // Trigger background check for next time
      scheduleUpdateCheck();
    }

    // Print the first line before any network call, so a slow API never blanks the bar
    const compact = options.layout === "compact";
    const noColor = Boolean(process.env.NO_COLOR);
    if (!compact) {
      const { head } = renderStatus(status, options, { noColor });
      if (head) console.log(head);
    }

    status.limits = await loadRateLimits(data, hidden);
    const { head, rows } = renderStatus(status, options, { noColor });
    if (compact && head) console.log(head);
    for (const row of rows) console.log(row);
  } catch {
    // Never crash, never print errors to stdout
    process.exit(0);
  }
}
