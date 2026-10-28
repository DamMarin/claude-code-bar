// Display options for the status bar. They live as flags in the statusLine command,
// e.g. `claude-code-bar --theme=ocean --hide=dir`, so there is no separate config file.

export const COLOR_CODES = {
  black: 30, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37,
  "bright-black": 90, "bright-red": 91, "bright-green": 92, "bright-yellow": 93,
  "bright-blue": 94, "bright-magenta": 95, "bright-cyan": 96, "bright-white": 97,
};
export const PALETTE = ["none", ...Object.keys(COLOR_CODES)];

// Fixed themes set their own styles; the others are just a starting set of colors
export const THEMES = {
  default: { low: "green", medium: "yellow", high: "red", accent: "none" },
  colorblind: { low: "blue", medium: "yellow", high: "magenta", accent: "none" },
  ocean: { low: "cyan", medium: "blue", high: "magenta", accent: "bright-cyan" },
  "high-contrast": { fixed: true, hc: true, low: "green", medium: "yellow", high: "red", accent: "none" },
  mono: { fixed: true, mono: true },
  none: { fixed: true, none: true },
};

export const ROLES = ["low", "medium", "high", "accent"];

export const BAR_STYLES = {
  shade: { fill: "▓", empty: "░" },
  block: { fill: "█", empty: "░" },
  line: { fill: "━", empty: "─" },
  dots: { fill: "●", empty: "○" },
  squares: { fill: "■", empty: "□" },
  // Braille fills a cell in steps, so a short bar still shows small changes
  braille: { fill: "⣿", empty: "⣀", partial: ["⣀", "⣄", "⣤", "⣦", "⣶", "⣷", "⣿"] },
};

export const SEPARATORS = {
  pipe: { glyph: "│", joiner: " │ " },
  dot: { glyph: "·", joiner: " · " },
  slash: { glyph: "/", joiner: " / " },
  arrow: { glyph: "›", joiner: " › " },
};

export const FIRST_LINE = ["model", "context", "duration", "dir", "git", "cost", "lines", "update"];
// Segments that stay hidden until --add turns them on, so new ones never change a bar that works
export const OPT_IN = ["cost", "lines"];
export const RATE_LIMITS = ["5h", "7d", "sonnet", "extra"];
export const SEGMENTS = [...FIRST_LINE, ...RATE_LIMITS];

export const BAR_WIDTH_MIN = 3;
export const BAR_WIDTH_MAX = 30;

export const DEFAULT_OPTIONS = Object.freeze({
  theme: "default",
  low: "green",
  medium: "yellow",
  high: "red",
  accent: "none",
  thMedium: 50,
  thHigh: 80,
  emoji: true,
  hidden: Object.freeze([...OPT_IN]),
  order: Object.freeze([...FIRST_LINE]),
  layout: "lines",
  bar: "shade",
  barWidth: 10,
  sep: "pipe",
  left: false,
  countdown: false,
  context: "percent",
});

export function cloneOptions(options) {
  return { ...options, hidden: [...options.hidden], order: [...options.order] };
}

export function applyTheme(options, id) {
  if (id === "custom") return toCustom(options);
  options.theme = id;
  const theme = THEMES[id];
  if (!theme.fixed) Object.assign(options, { low: theme.low, medium: theme.medium, high: theme.high, accent: theme.accent });
}

// The color a role has right now. Colorless themes (mono, none) report the default
// colors, so switching from them to custom colors never starts from "none".
export function roleColor(options, role) {
  const theme = THEMES[options.theme];
  return theme && theme.fixed ? (theme[role] ?? THEMES.default[role]) : options[role];
}

export function toCustom(options) {
  if (options.theme === "custom") return;
  for (const role of ROLES) options[role] = roleColor(options, role);
  options.theme = "custom";
}

function parseList(value, allowed, name) {
  const items = value.split(",").map((s) => s.trim()).filter(Boolean);
  const bad = items.find((item) => !allowed.includes(item));
  if (bad) return { error: `--${name}: unknown name "${bad}". Use: ${allowed.join(", ")}` };
  return { items: [...new Set(items)] };
}

function oneOf(name, allowed, apply) {
  return (options, value) => {
    if (!allowed.includes(value)) return `--${name}: unknown value "${value}". Use: ${allowed.join(", ")}`;
    apply(options, value);
  };
}

const VALUE_OPTIONS = {
  theme: oneOf("theme", Object.keys(THEMES), applyTheme),
  colors: (options, value) => {
    const pairs = value.split(",").map((s) => s.trim()).filter(Boolean);
    const colors = {};
    for (const pair of pairs) {
      const [role, color] = pair.split(":").map((s) => s.trim());
      if (!ROLES.includes(role)) return `--colors: unknown role "${role}". Use: ${ROLES.join(", ")}`;
      if (!PALETTE.includes(color)) return `--colors: unknown color "${color}". Use: ${PALETTE.join(", ")}`;
      colors[role] = color;
    }
    toCustom(options);
    Object.assign(options, colors);
  },
  thresholds: (options, value) => {
    const match = /^(\d+),(\d+)$/.exec(value);
    const medium = match && Number(match[1]);
    const high = match && Number(match[2]);
    if (!match || medium < 1 || high > 100 || medium >= high) {
      return "--thresholds: use two percentages, medium then high, e.g. --thresholds=50,80";
    }
    options.thMedium = medium;
    options.thHigh = high;
  },
  hide: (options, value) => {
    const { items, error } = parseList(value, SEGMENTS, "hide");
    if (error) return error;
    // --hide lists the always-on segments; opt-in ones keep what --add gave them
    options.hidden = SEGMENTS.filter((key) => items.includes(key) || (OPT_IN.includes(key) && options.hidden.includes(key)));
  },
  add: (options, value) => {
    const { items, error } = parseList(value, OPT_IN, "add");
    if (error) return error;
    options.hidden = options.hidden.filter((key) => !items.includes(key));
  },
  order: (options, value) => {
    const { items, error } = parseList(value, FIRST_LINE, "order");
    if (error) return error;
    // Segments left out keep their default relative order, after the listed ones
    options.order = [...items, ...FIRST_LINE.filter((key) => !items.includes(key))];
  },
  layout: oneOf("layout", ["lines", "compact"], (o, v) => { o.layout = v; }),
  bar: oneOf("bar", Object.keys(BAR_STYLES), (o, v) => { o.bar = v; }),
  "bar-width": (options, value) => {
    const width = Number(value);
    if (!/^\d+$/.test(value) || width < BAR_WIDTH_MIN || width > BAR_WIDTH_MAX) {
      return `--bar-width: use a whole number from ${BAR_WIDTH_MIN} to ${BAR_WIDTH_MAX}`;
    }
    options.barWidth = width;
  },
  separator: oneOf("separator", Object.keys(SEPARATORS), (o, v) => { o.sep = v; }),
  show: oneOf("show", ["used", "left"], (o, v) => { o.left = v === "left"; }),
  reset: oneOf("reset", ["clock", "countdown"], (o, v) => { o.countdown = v === "countdown"; }),
  context: oneOf("context", ["percent", "tokens", "both"], (o, v) => { o.context = v; }),
};

const SWITCH_OPTIONS = {
  "no-emoji": (options) => { options.emoji = false; },
  "no-color": (options) => { applyTheme(options, "none"); },
};

/**
 * Parses display flags. Returns the resulting options and a list of problems;
 * a bad flag is skipped, so the status bar can still render with the rest.
 */
export function parseOptions(args) {
  const options = cloneOptions(DEFAULT_OPTIONS);
  const errors = [];
  for (const arg of args) {
    const match = /^--([a-z-]+)(?:=(.*))?$/s.exec(arg);
    const name = match?.[1];
    const value = match?.[2];
    if (name in SWITCH_OPTIONS) {
      if (value !== undefined) errors.push(`--${name} does not take a value`);
      else SWITCH_OPTIONS[name](options);
    } else if (name in VALUE_OPTIONS) {
      if (!value) errors.push(`--${name} needs a value, e.g. --${name}=…`);
      else {
        const error = VALUE_OPTIONS[name](options, value);
        if (error) errors.push(error);
      }
    } else {
      errors.push(`Unknown option: ${arg}`);
    }
  }
  return { options, errors };
}

/** The flags that reproduce these options; defaults are left out. */
export function serializeOptions(options) {
  const d = DEFAULT_OPTIONS;
  const flags = [];
  if (options.theme === "custom") {
    flags.push(`--colors=${ROLES.map((role) => `${role}:${options[role]}`).join(",")}`);
  } else if (options.theme !== d.theme) {
    flags.push(`--theme=${options.theme}`);
  }
  if (options.thMedium !== d.thMedium || options.thHigh !== d.thHigh) flags.push(`--thresholds=${options.thMedium},${options.thHigh}`);
  if (!options.emoji) flags.push("--no-emoji");
  const hide = SEGMENTS.filter((k) => !OPT_IN.includes(k) && options.hidden.includes(k));
  const add = OPT_IN.filter((k) => !options.hidden.includes(k));
  if (hide.length) flags.push(`--hide=${hide.join(",")}`);
  if (add.length) flags.push(`--add=${add.join(",")}`);
  if (options.layout !== d.layout) flags.push(`--layout=${options.layout}`);
  if (options.order.join() !== d.order.join()) flags.push(`--order=${options.order.join(",")}`);
  if (options.bar !== d.bar) flags.push(`--bar=${options.bar}`);
  if (options.barWidth !== d.barWidth) flags.push(`--bar-width=${options.barWidth}`);
  if (options.sep !== d.sep) flags.push(`--separator=${options.sep}`);
  if (options.left) flags.push("--show=left");
  if (options.countdown) flags.push("--reset=countdown");
  if (options.context !== d.context) flags.push(`--context=${options.context}`);
  return flags;
}
