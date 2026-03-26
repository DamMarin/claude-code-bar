export function formatReset(date) {
  if (!(date instanceof Date) || isNaN(date)) return "?";

  const diffMs = date - new Date();
  if (diffMs <= 0) return "now";

  const diffHours = diffMs / (1000 * 60 * 60);

  // < 24h → show time: "14:30"
  if (diffHours < 24) {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", hour12: false
    });
  }

  // < 7 days → show day name: "Thu"
  if (diffHours < 168) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }

  // Otherwise → "2d 3h"
  const days = Math.floor(diffHours / 24);
  const hours = Math.floor(diffHours % 24);
  return `${days}d${hours}h`;
}
