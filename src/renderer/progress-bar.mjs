import { COLORS } from "../shared/colors.mjs";

export function renderBar(percentage) {
  const width = 10;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percentage) ? percentage : 0));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  const color = clamped >= 80 ? COLORS.red
              : clamped >= 50 ? COLORS.yellow
              : COLORS.green;
  return `${color}${"▓".repeat(filled)}${"░".repeat(empty)}${COLORS.reset} ${Math.round(clamped)}%`;
}
