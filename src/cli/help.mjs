import { readFileSync } from "node:fs";

export function helpText() {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  return `claude-code-bar ${pkg.version}
${pkg.description}

Usage:
  claude-code-bar --install     Set claude-code-bar as the statusLine in ~/.claude/settings.json
  claude-code-bar --uninstall   Remove it and restore any statusLine it replaced
  claude-code-bar --version     Print the version and check for updates
  claude-code-bar --help        Show this help

Claude Code runs claude-code-bar itself and sends its session state as JSON on stdin.
To preview the bar by hand:
  echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":30}}' | claude-code-bar
`;
}
