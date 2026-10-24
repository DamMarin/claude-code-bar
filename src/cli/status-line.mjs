import { homedir } from "node:os";
import { join } from "node:path";

export const STATUS_LINE = {
  type: "command",
  command: "claude-code-bar",
  padding: 0,
};

// Holds a statusLine that --install replaced, so --uninstall can restore it
export const BACKUP_PATH = join(homedir(), ".claude", "claude-code-bar.statusline-backup.json");

export function isOwnStatusLine(statusLine) {
  return statusLine !== null
    && typeof statusLine === "object"
    && typeof statusLine.command === "string"
    && /(^|[\s/\\])claude-code-bar(\.mjs)?(\s|$)/.test(statusLine.command.trim());
}
