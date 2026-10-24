import { COLOR_CODES, THEMES } from "../shared/options.mjs";

// What the current theme does with colors. NO_COLOR (no-color.org) always wins.
export function resolvePalette(options, env = process.env) {
  if (env.NO_COLOR) return THEMES.none;
  const theme = THEMES[options.theme];
  if (theme && theme.fixed) return theme;
  return { low: options.low, medium: options.medium, high: options.high, accent: options.accent };
}

// role is one of low, medium, high (usage levels) or accent
export function styleFor(palette, role) {
  if (palette.none) return {};
  if (palette.hc) {
    return {
      low: { color: "green", bold: true },
      medium: { color: "yellow", bold: true },
      high: { color: "red", bold: true, inverse: true },
      accent: { bold: true },
    }[role];
  }
  if (palette.mono) return { low: { dim: true }, medium: {}, high: { bold: true }, accent: { bold: true } }[role];
  const color = palette[role];
  return color && color !== "none" ? { color } : {};
}

// `underline` is used by the --config preview to show what a setting affects
export function paint(style, text, underline = false) {
  const codes = [];
  if (style.bold) codes.push(1);
  if (style.dim) codes.push(2);
  if (underline) codes.push(4);
  if (style.inverse) codes.push(7);
  if (style.color) codes.push(COLOR_CODES[style.color]);
  return codes.length ? `\x1b[${codes.join(";")}m${text}\x1b[0m` : text;
}
