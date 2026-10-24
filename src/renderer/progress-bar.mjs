import { BAR_STYLES } from "../shared/options.mjs";

// The bar's cells for a fill percentage, without color or label
export function barCells(percentage, styleName = "shade", width = 10) {
  const style = BAR_STYLES[styleName] ?? BAR_STYLES.shade;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percentage) ? percentage : 0));
  const exact = (clamped / 100) * width;

  if (style.partial) {
    const full = Math.floor(exact);
    if (full >= width) return style.fill.repeat(width);
    const step = Math.round((exact - full) * (style.partial.length - 1));
    return style.fill.repeat(full) + style.partial[step] + style.empty.repeat(width - full - 1);
  }

  const filled = Math.round(exact);
  return style.fill.repeat(filled) + style.empty.repeat(width - filled);
}
