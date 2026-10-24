export const STATUS_LINE = {
  type: "command",
  command: "claude-code-bar",
  padding: 0,
};

// The program name as it appears in a command: a path to the bin script, or a package
// runner spec with a version, e.g. `npx claude-code-bar@latest` or `pnpm dlx claude-code-bar@1.0.0`
const PROGRAM = String.raw`claude-code-bar(\.mjs|@[^\s/\\]+)?`;
const PROGRAM_IN_COMMAND = new RegExp(String.raw`(^|[\s/\\])${PROGRAM}(\s|$)`);
const PROGRAM_TOKEN = new RegExp(String.raw`(^|[/\\])${PROGRAM}$`);

export function isOwnStatusLine(statusLine) {
  return statusLine !== null
    && typeof statusLine === "object"
    && typeof statusLine.command === "string"
    && PROGRAM_IN_COMMAND.test(statusLine.command.trim());
}

// Splits a statusLine command into the program (e.g. "claude-code-bar",
// "node /opt/ccb/bin/claude-code-bar.mjs" or "npx -y claude-code-bar@latest")
// and the display flags after it
export function splitCommand(command) {
  const tokens = String(command ?? "").trim().split(/\s+/).filter(Boolean);
  // The last match, so `npx -p claude-code-bar@1 claude-code-bar` keeps both in the program
  const end = tokens.findLastIndex((t) => PROGRAM_TOKEN.test(t));
  if (end === -1) return { binary: STATUS_LINE.command, args: [] };
  return { binary: tokens.slice(0, end + 1).join(" "), args: tokens.slice(end + 1) };
}
