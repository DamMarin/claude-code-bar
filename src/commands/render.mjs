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

// The segment that shows each rate limit window
const WINDOWS = { "5h": "fiveHour", "7d": "sevenDay", sonnet: "sevenDaySonnet", extra: "extraUsage" };

/**
 * Rate limits: what Claude Code sent on stdin, with every shown window it left out filled
 * from the OAuth usage API. Claude Code sends five_hour and seven_day (and drops a window
 * once it resets); the Sonnet and extra usage windows only come from the API. Nothing is
 * fetched, and no token is read, while every window that is shown is already known.
 * `usage` stands in for fetchUsage, for tests.
 */
export async function loadRateLimits(data, hidden, { usage = fetchUsage } = {}) {
  const sent = data?.rate_limits && typeof data.rate_limits === "object" ? data.rate_limits : {};
  const limits = {
    fiveHour: parseRateLimit(sent.five_hour),
    sevenDay: parseRateLimit(sent.seven_day),
    sevenDaySonnet: parseRateLimit(sent.seven_day_sonnet),
    extraUsage: parseExtraUsage(sent.extra_usage),
  };
  const missing = RATE_LIMITS.filter((segment) => !hidden.has(segment) && !limits[WINDOWS[segment]]).map((segment) => WINDOWS[segment]);
  if (missing.length === 0) return limits;

  const oauth = await usage();
  for (const key of missing) if (oauth?.[key]) limits[key] = oauth[key];
  return limits;
}

// Lines added and removed this session, or null when Claude Code sent neither
function readLines(cost) {
  const added = safeNumber(cost?.total_lines_added, null, 0);
  const removed = safeNumber(cost?.total_lines_removed, null, 0);
  return added === null && removed === null ? null : { added: added ?? 0, removed: removed ?? 0 };
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
      contextPct: safeNumber(data?.context_window?.used_percentage, null, 0, 100), // null until known
      contextTokens: safeNumber(data?.context_window?.total_input_tokens, null, 0),
      contextSize: safeNumber(data?.context_window?.context_window_size, null, 0),
      durationMs: safeNumber(data?.cost?.total_duration_ms, 0, 0),
      costUsd: safeNumber(data?.cost?.total_cost_usd, null, 0),
      lines: readLines(data?.cost),
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
