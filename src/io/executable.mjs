import { accessSync, constants, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const isWindows = process.platform === "win32";

function isExecutableFile(filePath) {
  try {
    if (!statSync(filePath).isFile()) return false;
    // Windows has no execute bit; PATHEXT decides what runs
    if (!isWindows) accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Like `which`, but in Node so it works on every platform: true when `name`
 * (a program on PATH, or a path to one) can be run.
 */
export function canRun(name, env = process.env) {
  const exts = isWindows ? ["", ...(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")] : [""];
  const expanded = name.startsWith("~/") ? join(homedir(), name.slice(2)) : name;
  const candidates = /[/\\]/.test(expanded)
    ? [expanded]
    : (env.PATH ?? "").split(delimiter).filter(Boolean).map((dir) => join(dir, expanded));
  return candidates.some((base) => exts.some((ext) => isExecutableFile(base + ext)));
}
