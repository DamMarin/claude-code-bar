import { paint } from "../renderer/style.mjs";

// "claude code bar" in two rows of half blocks
const BANNER = [
  ["█▀▀ █   ▄▀█ █ █ █▀▄ █▀▀", "█▀▀ █▀█ █▀▄ █▀▀", "██▀ ▄▀█ █▀█"],
  ["█▄▄ █▄▄ █▀█ █▄█ █▄▀ ██▄", "█▄▄ █▄█ █▄▀ ██▄", "█▄█ █▀█ █▀▄"],
];
export const BANNER_WIDTH = 60;

// The two logo lines. style: "color" (bold, "bar" in cyan), "bold" (no color) or "plain"
export function bannerLines(style = "color") {
  return BANNER.map(([claude, code, bar]) => {
    if (style === "plain") return ` ${claude}   ${code}   ${bar}`;
    const bold = { bold: true };
    return ` ${paint(bold, claude)}   ${paint(bold, code)}   ${paint({ ...bold, color: style === "color" ? "cyan" : undefined }, bar)}`;
  });
}
