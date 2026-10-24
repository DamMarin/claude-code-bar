// Reads and validates the JSON that Claude Code sends on stdin
const MAX_STDIN_BYTES = 1024 * 1024; // 1 MB

export async function readStdin() {
  if (process.stdin.isTTY) return null;

  return new Promise((resolve) => {
    let raw = "";
    let bytes = 0;
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk, "utf8");
      if (bytes > MAX_STDIN_BYTES) {
        process.stdin.destroy();
        resolve(null);
        return;
      }
      raw += chunk;
    });
    process.stdin.on("end", () => {
      try {
        const parsed = raw.trim() ? JSON.parse(raw) : null;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          resolve(null);
          return;
        }
        // Block prototype pollution keys
        delete parsed.__proto__;
        delete parsed.constructor;
        delete parsed.prototype;
        resolve(parsed);
      } catch {
        resolve(null);
      }
    });
    process.stdin.on("error", () => resolve(null));
  });
}

export function safeString(val, fallback) {
  return typeof val === "string" && val.length > 0 && val.length < 256 ? val : fallback;
}

// null is "not known yet" in Claude Code's JSON (e.g. the context size early in a
// session), so it falls back like a missing field instead of becoming 0
export function safeNumber(val, fallback, min = 0, max = Infinity) {
  if (val === null) return fallback;
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function parseRateLimit(obj) {
  if (!obj || typeof obj !== "object") return null;
  const pct = safeNumber(obj.used_percentage, null, 0, 100);
  if (pct === null) return null;
  // Missing reset time stays null (rendered as "?"), not the 1970 epoch
  const ts = safeNumber(obj.resets_at, 0, 0);
  return { percentage: pct, resetsAt: ts > 0 ? new Date(ts * 1000) : null };
}
