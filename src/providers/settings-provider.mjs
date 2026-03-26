import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function getSettings() {
  try {
    const raw = readFileSync(join(homedir(), ".claude", "settings.json"), "utf8");
    const settings = JSON.parse(raw);
    return {
      effortLevel: settings.effortLevel || "high",
      model: settings.model || null,
    };
  } catch {
    return { effortLevel: "high", model: null };
  }
}
