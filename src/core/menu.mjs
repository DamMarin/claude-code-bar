// The --config menu as pure state: keys go in, options and screen lines come out.
// The terminal side (raw mode, drawing, saving) lives in commands/configure.mjs.
import {
  BAR_STYLES, DEFAULT_OPTIONS, FIRST_LINE, OPT_IN, PALETTE, RATE_LIMITS, ROLES, SEGMENTS, SEPARATORS, THEMES,
  applyTheme, cloneOptions, roleColor, toCustom,
} from "./options.mjs";
import { renderStatus } from "./status.mjs";
import { barCells } from "./progress-bar.mjs";
import { paint } from "./style.mjs";
import { BANNER_WIDTH, bannerLines } from "./banner.mjs";

/* ---------- Text helpers for the menu itself ---------- */

const dim = (text) => paint({ dim: true }, text);
const bold = (text) => paint({ bold: true }, text);
const inverse = (text) => paint({ inverse: true }, text);
const visibleLength = (s) => Array.from(s.replace(/\x1b\[[0-9;]*m/g, "")).length;
const pad = (s, n) => s + " ".repeat(Math.max(0, n - visibleLength(s)));
export const plural = (n) => `${n} change${n === 1 ? "" : "s"}`;
const keyHint = (k, action) => `${inverse(` ${k} `)} ${dim(action)}`;

/* ---------- Menu content ---------- */

const THEME_INFO = {
  default: ["Default", "Green, yellow, red. The classic look."],
  colorblind: ["Colorblind", "No red/green pair, so levels stay distinct with color blindness."],
  ocean: ["Ocean", "Cool colors, with cyan on the model and branch."],
  "high-contrast": ["High contrast", "Bold everywhere, and inverse colors at the high level, so it stands out in any terminal."],
  mono: ["Mono", "No color. Levels differ by dim, normal and bold text."],
  none: ["None", "No ANSI codes at all, same as NO_COLOR."],
  custom: ["Custom", "Your own colors, set in the COLORS list below."],
};

const SEGMENT_INFO = {
  model: ["Model", "Opus 4.6", "Shows which model the session is running."],
  context: ["Context", "30%", "How full the context window is, colored by level."],
  duration: ["Duration", "2m14s", "How long this session has been running."],
  dir: ["Directory", "my-project", "The folder Claude Code runs in. Hide it if you share screenshots."],
  git: ["Git branch", "main* ⇡2", "Current branch, with * when there are uncommitted changes and ⇡⇣ for commits ahead of or behind its upstream."],
  cost: ["Cost", "$0.42", "Estimated session cost at API list prices, as Claude Code computes it. Not what a subscription bills."],
  lines: ["Lines changed", "+156 −23", "Lines of code added and removed in this session."],
  update: ["Update notice", "↑ new version", "Appears only when a newer claude-code-bar is published."],
  "5h": ["5-hour", "34%", "Usage of the 5-hour rate limit window."],
  "7d": ["7-day", "63%", "Usage of the weekly limit."],
  sonnet: ["Sonnet 7-day", "88%", "Weekly limit for Sonnet models."],
  extra: ["Extra usage", "€15.60 / €85", "Extra usage spent this month, against your monthly limit."],
};

const PRESETS = [
  ["default", "Default", [...OPT_IN]],
  ["full", "Full", []],
  ["minimal", "Minimal", ["duration", "dir", ...OPT_IN, "update", "sonnet", "extra"]],
  ["limits", "Limits only", [...FIRST_LINE]],
];

const TABS = ["Segments", "Theme", "Bar", "Layout"];

// Example data for the preview, with one limit at each usage level
export function sampleStatus(now = Date.now()) {
  const at = (minutes) => new Date(now + minutes * 60000);
  return {
    model: "Opus 4.6",
    contextPct: 30,
    contextTokens: 60000,
    contextSize: 200000,
    durationMs: 134000,
    dir: "my-project",
    git: { branch: "main", dirty: true, ahead: 2, behind: 0 },
    costUsd: 0.42,
    lines: { added: 156, removed: 23 },
    update: "9.9.9",
    limits: {
      fiveHour: { percentage: 34, resetsAt: at(130) },
      sevenDay: { percentage: 63, resetsAt: at(3 * 1440 + 240) },
      sevenDaySonnet: { percentage: 88, resetsAt: at(5 * 1440 + 60) },
      extraUsage: { percentage: 18.35, usedCredits: 1560, monthlyLimit: 8500, currency: "EUR" },
    },
  };
}

function presetOf(o) {
  const hidden = o.hidden.toSorted().join();
  const match = PRESETS.find(([, , h]) => h.toSorted().join() === hidden);
  return match ? match[0] : "custom";
}

const choice = (def) => ({ type: "choice", ...def });

function rowsFor(tab, o) {
  if (tab === 0) {
    const allRatesHidden = RATE_LIMITS.every((k) => o.hidden.includes(k));
    return [
      choice({
        label: "Preset", defaultValue: "default", mark: [],
        desc: "Start from a ready-made selection, then fine-tune the list below.",
        options: () => [...PRESETS.map(([id, label]) => [id, label]), ...(presetOf(o) === "custom" ? [["custom", "Custom"]] : [])],
        get: () => presetOf(o),
        set: (v) => { const p = PRESETS.find(([id]) => id === v); if (p) o.hidden = [...p[2]]; },
      }),
      { type: "header", label: "FIRST LINE" },
      ...o.order.map((key) => ({ type: "segment", key, movable: true })),
      { type: "header", label: "RATE LIMITS" },
      ...RATE_LIMITS.map((key) => ({
        type: "segment", key,
        note: allRatesHidden ? " With every rate limit hidden, claude-code-bar never reads your login token." : "",
      })),
    ];
  }

  if (tab === 1) {
    const theme = THEMES[o.theme];
    const colorless = Boolean(theme && (theme.mono || theme.none));
    const fixed = Boolean(theme && theme.fixed);
    const roleDesc = {
      low: () => `Color below ${o.thMedium}%.`,
      medium: () => `Color from ${o.thMedium}% up to ${o.thHigh}%.`,
      high: () => `Color from ${o.thHigh}% up.`,
      accent: () => "Color of the model name, git branch and update notice.",
    };
    return [
      { type: "header", label: "THEME" },
      ...[...Object.keys(THEMES), "custom"].map((id) => ({ type: "theme", id })),
      { type: "header", label: "COLORS" },
      ...ROLES.map((role) => choice({
        label: role[0].toUpperCase() + role.slice(1), swatch: true, muted: colorless,
        defaultValue: THEMES.default[role],
        mark: role === "accent" ? ["accent"] : [`lvl-${role}`],
        desc: () => roleDesc[role]() + (colorless
          ? ` ${THEME_INFO[o.theme][0]} uses no colors. Changing this switches to Custom, starting from the Default colors.`
          : fixed ? ` Changing it switches from ${THEME_INFO[o.theme][0]} to Custom colors.` : ""),
        options: () => PALETTE.map((c) => [c, c]),
        get: () => roleColor(o, role),
        set: (v) => { toCustom(o); o[role] = v; },
      })),
      { type: "header", label: "THRESHOLDS" },
      choice({
        label: "Medium from", defaultValue: 50, mark: ["levels"],
        desc: "Context and limits switch to the Medium color at this percentage.",
        options: () => [40, 50, 60, 70].map((n) => [n, `${n}%`]),
        get: () => o.thMedium, set: (v) => { o.thMedium = v; },
      }),
      choice({
        label: "High from", defaultValue: 80, mark: ["levels"],
        desc: "Context and limits switch to the High color at this percentage.",
        options: () => [70, 80, 85, 90].map((n) => [n, `${n}%`]),
        get: () => o.thHigh, set: (v) => { o.thHigh = v; },
      }),
    ];
  }

  if (tab === 2) {
    const off = o.layout === "compact" ? "Not shown in the one-line layout. Switch Layout to multi-line to use it." : null;
    return [
      choice({
        label: "Style", defaultValue: "shade", mark: ["bars"], disabled: off,
        desc: () => (o.bar === "braille"
          ? "Braille fills each cell in steps, so short bars still show small changes."
          : "How the usage bars are drawn."),
        options: () => Object.keys(BAR_STYLES).map((id) => [id, `${barCells(60, id, 6)}  ${id}`]),
        get: () => o.bar, set: (v) => { o.bar = v; },
      }),
      choice({
        label: "Width", defaultValue: 10, mark: ["bars"], disabled: off,
        desc: "How many characters each bar takes.",
        options: () => [...new Set([5, 8, 10, 12, 15, 20, o.barWidth])].toSorted((a, b) => a - b).map((n) => [n, `${n} cells`]),
        get: () => o.barWidth, set: (v) => { o.barWidth = v; },
      }),
      choice({
        label: "Show", defaultValue: false, mark: ["pct", "bars"],
        desc: "Used counts up as you spend. Left counts down, like a battery. Colors always follow what is used.",
        options: () => [[false, "used"], [true, "left"]],
        get: () => o.left, set: (v) => { o.left = v; },
      }),
      choice({
        label: "Reset", defaultValue: false, mark: ["reset"], disabled: off,
        desc: "Clock time shows when a limit resets (14:30). Countdown shows how long until then (in 2h10m).",
        options: () => [[false, "clock time"], [true, "countdown"]],
        get: () => o.countdown, set: (v) => { o.countdown = v; },
      }),
    ];
  }

  return [
    choice({
      label: "Layout", defaultValue: "lines", mark: [],
      desc: "Multi-line shows a bar per limit. One line fits everything on a single line, without bars.",
      options: () => [["lines", "multi-line"], ["compact", "one line"]],
      get: () => o.layout, set: (v) => { o.layout = v; },
    }),
    choice({
      label: "Context", defaultValue: "percent", mark: ["context"],
      desc: "How the context segment counts: a percentage, tokens out of the window size, or both.",
      options: () => [["percent", "30%"], ["tokens", "60k/200k"], ["both", "30% (60k/200k)"]],
      get: () => o.context, set: (v) => { o.context = v; },
    }),
    choice({
      label: "Separator", defaultValue: "pipe", mark: ["sep"],
      desc: "The character between segments.",
      options: () => Object.entries(SEPARATORS).map(([id, s]) => [id, `${s.glyph}  ${id}`]),
      get: () => o.sep, set: (v) => { o.sep = v; },
    }),
    choice({
      label: "Icons", defaultValue: true, mark: ["labels"],
      desc: "Text labels work in every terminal and font.",
      options: () => [[true, "emoji"], [false, "text"]],
      get: () => o.emoji, set: (v) => { o.emoji = v; },
    }),
  ];
}

// Colors count as one change: the theme name, plus each color for custom ones
const colorsOf = (o) => (o.theme === "custom" ? [o.theme, ...ROLES.map((r) => o[r])].join() : o.theme);

export function countChanges(a, b) {
  let n = 0;
  for (const key of SEGMENTS) if (a.hidden.includes(key) !== b.hidden.includes(key)) n++;
  if (a.order.join() !== b.order.join()) n++;
  if (colorsOf(a) !== colorsOf(b)) n++;
  for (const key of ["thMedium", "thHigh", "bar", "barWidth", "left", "countdown", "context", "layout", "sep", "emoji"]) {
    if (a[key] !== b[key]) n++;
  }
  return n;
}

function isDefaultRow(row, o) {
  if (row.type === "segment") return o.hidden.includes(row.key) === DEFAULT_OPTIONS.hidden.includes(row.key);
  if (row.type === "theme") return row.id !== o.theme || o.theme === "default";
  return row.get() === row.defaultValue;
}

function resetRow(row, o) {
  if (row.type === "segment") {
    o.hidden = o.hidden.filter((k) => k !== row.key);
    if (DEFAULT_OPTIONS.hidden.includes(row.key)) o.hidden.push(row.key);
  }
  else if (row.type === "theme") applyTheme(o, "default");
  else row.set(row.defaultValue);
}

function describe(row, o) {
  if (row.disabled) return row.disabled;
  if (row.type === "segment") return SEGMENT_INFO[row.key][2] + (row.note ?? "");
  if (row.type === "theme") {
    const state = row.id === o.theme ? "In use." : "Previewing it below. Press space to use it.";
    return `${THEME_INFO[row.id][1]} ${state}`;
  }
  return typeof row.desc === "function" ? row.desc() : row.desc;
}

// A small sample of a theme's look, shown next to its name
function themeSwatch(id, o, color) {
  const t = THEMES[id];
  if (id === "custom") return ROLES.map((r) => (o[r] === "none" ? dim("□") : color(o[r], "■"))).join("");
  if (t.none) return dim("no color");
  if (t.mono) return `${dim("■")}■${bold("■")}`;
  if (t.hc) return `${bold(color("green", "■"))}${bold(color("yellow", "■"))}${inverse(bold(color("red", "■")))}`;
  return [t.low, t.medium, t.high, t.accent].filter((c) => c !== "none").map((c) => color(c, "■")).join("");
}

/**
 * The menu without any terminal I/O, so it can be driven by tests.
 * onKey returns "save", "quit" or null; frame returns the lines to draw.
 */
export function createMenu(initial, { version = "", sample = sampleStatus(), color: useColor = true } = {}) {
  const color = (name, text) => (useColor ? paint({ color: name }, text) : text);
  const ui = { saved: cloneOptions(initial), draft: cloneOptions(initial), tab: 0, focus: [0, 0, 0, 0], moving: null, confirm: false, fullPreview: false };

  function focusedRow() {
    const focusable = rowsFor(ui.tab, ui.draft).filter((r) => r.type !== "header");
    ui.focus[ui.tab] = Math.min(ui.focus[ui.tab], focusable.length - 1);
    return { focusable, index: ui.focus[ui.tab], row: focusable[ui.focus[ui.tab]] };
  }

  function rowLine(row, focused) {
    const o = ui.draft;
    if (row.type === "header") return `   ${bold(dim(row.label))}`;
    const caret = focused ? color("cyan", "▌ ") : "  ";
    const off = row.disabled || row.muted;
    const label = (text) => (focused ? bold(text) : off ? dim(text) : text);
    const dirty = isDefaultRow(row, o) ? " " : color("yellow", "•");

    if (row.type === "theme") {
      const inUse = row.id === o.theme;
      const name = THEME_INFO[row.id][0];
      return `${caret}${inUse ? color("cyan", "◉") : dim("○")}  ${pad(focused || inUse ? bold(name) : name, 17)}${pad(themeSwatch(row.id, o, color), 32)}${dirty}`;
    }

    if (row.type === "segment") {
      const [name, example] = SEGMENT_INFO[row.key];
      const on = !o.hidden.includes(row.key);
      const moving = ui.moving && ui.moving.key === row.key;
      const value = moving ? color("cyan", "⇅ moving") : on ? example : dim(example);
      return `${caret}${on ? color("green", "●") : dim("○")}  ${pad(on ? label(name) : dim(name), 17)}${pad(value, 32)}${dirty} ${row.movable ? dim("≡") : ""}`;
    }

    const opts = row.options();
    const current = row.get();
    const idx = opts.findIndex(([v]) => v === current);
    const text = idx >= 0 ? opts[idx][1] : String(current);
    const swatch = !row.swatch ? "" : current === "none" ? `${dim("□")} ` : `${color(current, "■")} `;
    const active = focused && !row.disabled;
    const [l, r] = ["‹", "›"].map((a) => (active ? color("cyan", a) : dim(a)));
    const position = active ? ` ${dim(`${idx + 1}/${opts.length}`)}` : "";
    const body = `${l} ${swatch}${text} ${r}${position}`;
    return `${caret}   ${pad(label(row.label), 17)}${pad(off ? dim(body) : body, 32)}${dirty}`;
  }

  function hints(row) {
    if (ui.confirm) {
      return `${color("yellow", `Discard ${plural(countChanges(ui.draft, ui.saved))}?`)}  ${keyHint("y", "discard")}  ${keyHint("n", "keep editing")}`;
    }
    if (ui.moving) return [keyHint("↑↓", "move"), keyHint("enter", "drop"), keyHint("esc", "cancel")].join("  ");
    const list = [];
    if (row.type === "segment") {
      list.push(keyHint("space", "show/hide"));
      if (row.movable) list.push(keyHint("m", "move"));
    }
    if (row.type === "theme" && row.id !== ui.draft.theme) list.push(keyHint("space", "use theme"));
    if (row.type === "choice" && !row.disabled) list.push(keyHint("←→", "change"));
    if (!row.disabled && !isDefaultRow(row, ui.draft)) list.push(keyHint("r", "reset"));
    list.push(keyHint("tab", "next tab"), keyHint("enter", "save"), keyHint("esc", "quit"));
    return list.join("  ");
  }

  function frame(columns = 80, rows = 30) {
    const width = Math.min(columns, 96);
    const o = ui.draft;
    const all = rowsFor(ui.tab, o);
    const { row: focused } = focusedRow();
    const changes = countChanges(o, ui.saved);

    const right = changes ? `${color("yellow", "●")} ${plural(changes)} ` : `${dim("no changes")} `;
    const tabs = TABS.map((t, i) => (i === ui.tab
      ? paint({ bold: true, color: useColor ? "cyan" : undefined }, `${i + 1} ${t}`, true)
      : dim(`${i + 1} ${t}`))).join("   ");

    const textHeader = [pad(` ${bold("claude-code-bar")} ${dim(version)}`, width - visibleLength(right)) + right];
    const [logoTop, logoBottom] = bannerLines(useColor ? "color" : "bold");
    const bannerHeader = [logoTop, pad(`${logoBottom}  ${dim(version)}`, width - visibleLength(right)) + right, ""];

    const menu = [
      `  ${tabs}`,
      dim("─".repeat(width)),
      ...all.map((row) => rowLine(row, row === focused)),
      "",
    ];

    // Hovering a theme previews it before it is chosen
    const shown = focused.type === "theme" && focused.id !== o.theme ? cloneOptions(o) : o;
    if (shown !== o) applyTheme(shown, focused.id);
    const mark = focused.type === "segment" ? [focused.key]
      : focused.type === "theme" ? ["levels", "accent"]
      : focused.mark;
    const { head, rows: limitRows } = renderStatus(sample, shown, { mark });
    const lines = [head, ...limitRows].filter((l) => l !== null);
    let preview = (lines.length ? lines : [dim("(nothing to show)")]).map((l) => `${color("cyan", " ┃")} ${l}`);

    const description = ui.confirm ? "" : focused.disabled ? color("yellow", describe(focused, o)) : describe(focused, o);
    const footer = ["", ` ${description}`, ` ${hints(focused)}`];

    // Small terminals give up the logo first, then collapse the preview to its first line
    const body = menu.length + preview.length + footer.length;
    const header = columns >= BANNER_WIDTH && body + bannerHeader.length <= rows ? bannerHeader : textHeader;
    if (header.length + body > rows && !ui.fullPreview && preview.length > 1) {
      preview = [preview[0], dim(`   … ${preview.length - 1} more lines, press p to show them`)];
    }
    return [...header, ...menu, ...preview, ...footer];
  }

  function onKey(key, shift = false) {
    const o = ui.draft;

    if (ui.confirm) {
      if (key === "y") return "quit";
      if (["n", "Escape", "Enter"].includes(key)) ui.confirm = false;
      return null;
    }

    if (ui.moving) {
      const order = o.order;
      const i = order.indexOf(ui.moving.key);
      if ((key === "ArrowUp" || key === "k") && i > 0) {
        [order[i - 1], order[i]] = [order[i], order[i - 1]];
        ui.focus[0]--;
      } else if ((key === "ArrowDown" || key === "j") && i < order.length - 1) {
        [order[i + 1], order[i]] = [order[i], order[i + 1]];
        ui.focus[0]++;
      } else if (key === "Enter" || key === "m" || key === " ") {
        ui.moving = null;
      } else if (key === "Escape") {
        o.order = ui.moving.original;
        ui.focus[0] = ui.moving.focus;
        ui.moving = null;
      }
      return null;
    }

    const { focusable, index, row } = focusedRow();
    switch (key) {
      case "ArrowUp": case "k": ui.focus[ui.tab] = Math.max(0, index - 1); break;
      case "ArrowDown": case "j": ui.focus[ui.tab] = Math.min(focusable.length - 1, index + 1); break;
      case "Tab": ui.tab = (ui.tab + (shift ? TABS.length - 1 : 1)) % TABS.length; break;
      case "1": case "2": case "3": case "4": ui.tab = Number(key) - 1; break;
      case "ArrowLeft": case "h": case "ArrowRight": case "l": {
        if (row.type !== "choice" || row.disabled) break;
        const opts = row.options();
        const step = key === "ArrowLeft" || key === "h" ? -1 : 1;
        const idx = Math.max(0, opts.findIndex(([v]) => v === row.get()));
        row.set(opts[(idx + step + opts.length) % opts.length][0]);
        break;
      }
      case " ":
        if (row.type === "theme") applyTheme(o, row.id);
        else if (row.type === "segment") {
          o.hidden = o.hidden.includes(row.key) ? o.hidden.filter((k) => k !== row.key) : [...o.hidden, row.key];
        }
        break;
      case "m": if (row.movable) ui.moving = { key: row.key, original: [...o.order], focus: index }; break;
      case "r": if (!row.disabled) resetRow(row, o); break;
      case "R": ui.draft = cloneOptions(DEFAULT_OPTIONS); break;
      case "p": ui.fullPreview = !ui.fullPreview; break;
      case "Enter": return "save";
      case "Escape":
        if (countChanges(o, ui.saved)) ui.confirm = true;
        else return "quit";
        break;
    }
    return null;
  }

  return { onKey, frame, options: () => ui.draft, changes: () => countChanges(ui.draft, ui.saved) };
}
