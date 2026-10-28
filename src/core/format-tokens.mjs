// Token counts in a few characters: "850", "9.5k", "46k", "1.2M"
export function formatTokens(n) {
  if (!Number.isFinite(n) || n < 0) return "?";
  if (n < 1000) return `${Math.round(n)}`;
  if (n < 10_000) return `${trim((n / 1000).toFixed(1))}k`;
  if (n < 999_500) return `${Math.round(n / 1000)}k`;
  return `${trim((n / 1_000_000).toFixed(1))}M`;
}

const trim = (s) => s.replace(/\.0$/, "");
