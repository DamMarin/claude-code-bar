export const STATUS_LINE = {
  type: "command",
  command: "claude-code-bar",
  padding: 0,
};

export function isOwnStatusLine(statusLine) {
  return statusLine !== null
    && typeof statusLine === "object"
    && typeof statusLine.command === "string"
    && /(^|[\s/\\])claude-code-bar(\.mjs)?(\s|$)/.test(statusLine.command.trim());
}

// Splits a statusLine command into the program (e.g. "claude-code-bar" or
// "node /opt/ccb/bin/claude-code-bar.mjs") and the display flags after it
export function splitCommand(command) {
  const tokens = String(command ?? "").trim().split(/\s+/).filter(Boolean);
  const end = tokens.findIndex((t) => /(^|[/\\])claude-code-bar(\.mjs)?$/.test(t));
  if (end === -1) return { binary: STATUS_LINE.command, args: [] };
  return { binary: tokens.slice(0, end + 1).join(" "), args: tokens.slice(end + 1) };
}
