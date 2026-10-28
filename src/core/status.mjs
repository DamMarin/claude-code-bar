import { SEPARATORS } from "./options.mjs";
import { formatDuration } from "./format-duration.mjs";
import { formatMoney } from "./format-money.mjs";
import { formatCountdown, formatReset } from "./format-reset.mjs";
import { formatTokens } from "./format-tokens.mjs";
import { barCells } from "./progress-bar.mjs";
import { paint, resolvePalette, styleFor } from "./style.mjs";

const clamp = (pct) => Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
const money = (e, joiner) => `${formatMoney(e.usedCredits, e.currency)}${joiner}${formatMoney(e.monthlyLimit, e.currency)}`;

/**
 * Renders the status bar.
 *
 * data: { model, contextPct (null until known), contextTokens, contextSize, durationMs, dir,
 *         git: { branch, dirty, ahead, behind } | null, costUsd | null, lines: { added, removed } | null,
 *         update: latest version | null,
 *         limits: { fiveHour, sevenDay, sevenDaySonnet, extraUsage } }
 *
 * Returns { head, rows }: the first line (null when every segment on it is hidden)
 * and one row per rate limit. In the compact layout everything is in `head`.
 *
 * `mark` lists what to underline, for the --config preview: segment keys,
 * "levels", "lvl-low|medium|high", "accent", "pct", "bars", "reset", "sep", "labels".
 * `noColor` turns colors off, as NO_COLOR does.
 */
export function renderStatus(data, options, { mark = [], noColor = false } = {}) {
  const palette = resolvePalette(options, noColor);
  const marks = new Set(mark);
  const m = (...categories) => categories.some((c) => marks.has(c));
  const emoji = options.emoji;
  const hidden = new Set(options.hidden);

  const level = (pct) => (pct >= options.thHigh ? "high" : pct >= options.thMedium ? "medium" : "low");
  const levelStyle = (pct) => styleFor(palette, level(pct));
  const levelMarked = (pct) => m("levels", `lvl-${level(pct)}`);
  const pctText = (pct) => (options.left ? `${Math.round(100 - pct)}% left` : `${Math.round(pct)}%`);
  const label = (text, underline) => (text ? paint({}, text, underline || m("labels")) : "");

  const accent = styleFor(palette, "accent");
  // The update notice uses the accent when there is one, otherwise the medium level color
  const updateStyle = palette.none ? {}
    : palette.mono || palette.hc || (palette.accent && palette.accent !== "none") ? accent
    : styleFor(palette, "medium");

  // Early in a session Claude Code doesn't know the context size yet: show "–", not 0%
  const ctx = data.contextPct === null || data.contextPct === undefined ? null : clamp(data.contextPct);
  const contextText = () => {
    const size = data.contextSize;
    const used = Number.isFinite(data.contextTokens) ? data.contextTokens : size > 0 ? Math.round((ctx * size) / 100) : null;
    // Without a window size there are no tokens to show, only the percentage
    if (options.context === "percent" || !(size > 0) || used === null) return pctText(ctx);
    const tokens = options.left ? `${formatTokens(Math.max(0, size - used))} left` : `${formatTokens(used)}/${formatTokens(size)}`;
    if (options.context === "tokens") return tokens;
    return options.left ? `${pctText(ctx)} (${formatTokens(Math.max(0, size - used))})` : `${pctText(ctx)} (${tokens})`;
  };
  const git = data.git
    ? `${data.git.branch}${data.git.dirty ? "*" : ""}${data.git.ahead > 0 || data.git.behind > 0 ? " " : ""}`
      + `${data.git.ahead > 0 ? `⇡${data.git.ahead}` : ""}${data.git.behind > 0 ? `⇣${data.git.behind}` : ""}`
    : null;
  const lines = data.lines && (data.lines.added > 0 || data.lines.removed > 0) ? data.lines : null;
  const parts = {
    model: (u) => label(emoji ? "🤖 " : "", u) + paint(accent, data.model, u || m("accent")),
    context: (u) => label(emoji ? "🧠 " : "ctx ", u) + (ctx === null
      ? paint({}, "–", u || m("pct"))
      : paint(levelStyle(ctx), contextText(), u || m("pct") || levelMarked(ctx))),
    duration: (u) => label(emoji ? "⏱️ " : "", u) + paint({}, formatDuration(data.durationMs), u),
    dir: (u) => (data.dir ? paint({}, data.dir, u) : null),
    git: (u) => (git ? paint(accent, git, u || m("accent")) : null),
    cost: (u) => (Number.isFinite(data.costUsd) ? paint({}, formatMoney(Math.round(data.costUsd * 100), "USD"), u) : null),
    lines: (u) => (lines
      ? paint(styleFor(palette, "low"), `+${lines.added}`, u) + paint({}, " ", u) + paint(styleFor(palette, "high"), `−${lines.removed}`, u)
      : null),
    update: (u) => (data.update ? paint(updateStyle, `↑ ${data.update}`, u || m("accent")) : null),
  };
  const line1 = options.order
    .filter((key) => !hidden.has(key))
    .map((key) => parts[key](m(key)))
    .filter(Boolean);
  const sep = paint({}, SEPARATORS[options.sep].joiner, m("sep"));

  const all = data.limits ?? {};
  const extra = all.extraUsage && all.extraUsage.monthlyLimit > 0 ? all.extraUsage : null;
  const limits = [
    { key: "5h", entry: all.fiveHour, emoji: "⏱️ 5h", text: "5h", short: ["5h", "5h"] },
    { key: "7d", entry: all.sevenDay, emoji: "📅 7d", text: "7d", short: ["7d", "7d"] },
    { key: "sonnet", entry: all.sevenDaySonnet, emoji: "📜 S", text: "Sonnet", short: ["S", "Sonnet"] },
    { key: "extra", entry: extra, emoji: "💰 Extra", text: "Extra", short: ["💰", "Extra"], money: true },
  ].filter((l) => l.entry && !hidden.has(l.key));

  if (options.layout === "compact") {
    const items = limits.map((l) => {
      const u = m(l.key);
      const pct = clamp(l.entry.percentage);
      const value = l.money ? money(l.entry, "/") : pctText(pct);
      const valueMarked = u || (!l.money && m("pct")) || levelMarked(pct);
      return label(l.short[emoji ? 0 : 1], u) + paint({}, " ", u) + paint(levelStyle(pct), value, valueMarked);
    });
    const segments = items.length ? [...line1, items.join("  ")] : line1;
    return { head: segments.length ? segments.join(sep) : null, rows: [] };
  }

  const rows = limits.map((l) => {
    const u = m(l.key);
    const pct = clamp(l.entry.percentage);
    // In "left" mode the bar shows what remains, like a battery; the color still follows usage
    const cells = barCells(options.left ? 100 - pct : pct, options.bar, options.barWidth);
    const bar = paint(levelStyle(pct), `${cells} ${pctText(pct)}`, u || m("bars", "pct") || levelMarked(pct));
    const name = emoji ? l.emoji : l.text.padEnd(6);
    const tail = l.money
      ? paint({}, money(l.entry, " / "), u)
      : paint({}, options.countdown ? formatCountdown(l.entry.resetsAt) : `resets ${formatReset(l.entry.resetsAt)}`, u || m("reset"));
    return `${label(name, u)}  ${bar}  ${tail}`;
  });

  return { head: line1.length ? line1.join(sep) : null, rows };
}
