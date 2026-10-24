export const STATUS_LINE = {
  type: "command",
  command: "claude-code-bar",
  padding: 0,
};

// The program name as it appears in a command: a path to the bin script, or a package
// runner spec with a version, e.g. `npx claude-code-bar@latest` or `pnpm dlx claude-code-bar@1.0.0`
const PROGRAM_TOKEN = /(^|[/\\])claude-code-bar(\.mjs|@[^\s/\\]+)?$/;
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Splits a command into words the way a POSIX shell does, so quoted paths with
 * spaces stay one word. Each token keeps where it starts and ends in the command.
 * A backslash escapes only whitespace, a quote or a backslash, so Windows paths keep theirs.
 * `shell` marks a word with unquoted shell syntax: a redirect, pipe, `;` or `&`.
 */
function tokenize(command) {
  const tokens = [];
  let token = null;
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    const next = command[i + 1] ?? "";
    if (!token) {
      if (/\s/.test(ch)) continue;
      token = { value: "", start: i, end: command.length, shell: false };
    }
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && /["\\]/.test(next)) token.value += command[++i];
      else token.value += ch;
    } else if (/\s/.test(ch)) {
      token.end = i;
      tokens.push(token);
      token = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "\\" && /[\s"'\\]/.test(next)) {
      token.value += command[++i];
    } else {
      if (/[|&;<>]/.test(ch)) token.shell = true;
      token.value += ch;
    }
  }
  if (token) tokens.push(token);
  return tokens;
}

// The words before any shell syntax, and the index of the last one that runs claude-code-bar
// (the last, so `npx -p claude-code-bar@1 claude-code-bar` keeps both in the program)
function findProgram(tokens) {
  const stop = tokens.findIndex((t) => t.shell);
  const words = stop === -1 ? tokens : tokens.slice(0, stop);
  return { stop: stop === -1 ? tokens.length : stop, end: words.findLastIndex((t) => PROGRAM_TOKEN.test(t.value)) };
}

export function isOwnStatusLine(statusLine) {
  return statusLine !== null
    && typeof statusLine === "object"
    && typeof statusLine.command === "string"
    && findProgram(tokenize(statusLine.command.trim())).end !== -1;
}

/**
 * Splits a statusLine command into the program (e.g. "claude-code-bar",
 * "node /opt/ccb/bin/claude-code-bar.mjs" or "npx -y claude-code-bar@latest"),
 * the display flags after it, and any shell syntax after those (e.g. "2>/dev/null").
 * The program and the suffix are kept exactly as written, quotes included.
 */
export function splitCommand(command) {
  const text = String(command ?? "").trim();
  const tokens = tokenize(text);
  const { stop, end } = findProgram(tokens);
  if (end === -1) return { binary: STATUS_LINE.command, args: [], suffix: "" };
  return {
    binary: text.slice(0, tokens[end].end),
    args: tokens.slice(end + 1, stop).map((t) => t.value),
    suffix: stop < tokens.length ? text.slice(tokens[stop].start) : "",
  };
}

// The statusLine command for a program, its display flags and a shell suffix
export function buildCommand(binary, flags, suffix = "") {
  return [binary, ...flags, suffix].filter(Boolean).join(" ");
}

// The executable the shell will look for: the first word that is not a VAR=value assignment
export function commandExecutable(command) {
  const tokens = tokenize(String(command ?? "").trim());
  const first = tokens.find((t) => t.shell || !ENV_ASSIGNMENT.test(t.value));
  return first && !first.shell ? first.value : null;
}
