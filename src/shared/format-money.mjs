// Amounts arrive in the currency's minor unit (cents for EUR/USD, whole yen for JPY)
export function formatMoney(minorUnits, currency) {
  if (!Number.isFinite(minorUnits)) return "?";

  if (typeof currency === "string" && currency.length > 0) {
    try {
      const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
      const digits = formatter.resolvedOptions().maximumFractionDigits;
      const amount = minorUnits / 10 ** digits;
      // Drop ".00" on whole amounts: "€85", not "€85.00"
      if (Number.isInteger(amount)) {
        return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
      }
      return formatter.format(amount);
    } catch {
      // Not a valid ISO 4217 code — fall through to a plain amount with the code as prefix
      const amount = minorUnits / 100;
      return `${currency} ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
    }
  }

  const amount = minorUnits / 100;
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(2);
}
