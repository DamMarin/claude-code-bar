const MAX_STDIN_BYTES = 1024 * 1024; // 1 MB

export async function parseStdin() {
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
