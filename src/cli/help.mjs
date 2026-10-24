import { readFileSync } from "node:fs";
import { BAR_STYLES, SEGMENTS, SEPARATORS, THEMES } from "../shared/options.mjs";
import { bannerLines } from "./banner.mjs";

// The logo is for --help and manual runs; error messages use the plain title
export function helpText({ banner = false } = {}) {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
  const title = banner
    ? (([top, bottom]) => `\n${top}\n${bottom}  ${pkg.version}\n`)(bannerLines(color ? "color" : "plain"))
    : `claude-code-bar ${pkg.version}`;
  return `${title}
${pkg.description}

Usage:
  claude-code-bar --config      Choose what to show in an interactive menu
  claude-code-bar --install     Set claude-code-bar as the statusLine in ~/.claude/settings.json
  claude-code-bar --uninstall   Remove it and restore any statusLine it replaced
  claude-code-bar --version     Print the version and check for updates
  claude-code-bar --help        Show this help

Display options (use with --install, or let --config write them for you):
  --theme=<name>          ${Object.keys(THEMES).join(", ")}
  --colors=<role:color>   Custom colors for low, medium, high and accent, e.g. low:cyan,high:bright-red
  --thresholds=<m>,<h>    Percentages where colors switch to medium and high (default 50,80)
  --hide=<names>          Hide segments: ${SEGMENTS.join(", ")}
  --order=<names>         Order of the first line, e.g. git,model,context
  --layout=compact        Everything on one line, without bars
  --bar=<style>           ${Object.keys(BAR_STYLES).join(", ")}
  --bar-width=<n>         Bar width in characters (default 10)
  --separator=<name>      ${Object.keys(SEPARATORS).join(", ")}
  --show=left             Show what is left instead of what is used
  --reset=countdown       Show time until reset (in 2h10m) instead of the clock time
  --no-emoji              Text labels instead of emoji
  --no-color              No colors (NO_COLOR is also respected)

Claude Code runs claude-code-bar itself and sends its session state as JSON on stdin.
To preview the bar by hand:
  echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":30}}' | claude-code-bar
`;
}
