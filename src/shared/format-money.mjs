const SYMBOLS = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  JPY: "¥",
};

export function formatMoney(cents, currency) {
  if (!Number.isFinite(cents)) return "?";
  const symbol = SYMBOLS[currency] ?? (currency ? `${currency} ` : "");
  const amount = cents / 100;
  if (Number.isInteger(amount)) return `${symbol}${amount}`;
  return `${symbol}${amount.toFixed(2)}`;
}
