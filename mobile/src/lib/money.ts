// Money input, parsed as text so no float ever touches an amount (a float turns
// 1.005 into 1.00499999...). Pure and import-free so `npm test` can run it.

const MAX_INTEGER_DIGITS = 10; // 9,999,999,999.99 stays far inside Number.MAX_SAFE_INTEGER as paise
const MAX_DECIMALS = 2;

/**
 * Text typed into an amount field -> integer minor units (paise/cents), or null
 * if it is not a valid amount. Accepts one separator, "," or ".": some Android
 * locale keyboards emit "," on a decimal pad. Letters, signs, exponents,
 * thousands separators and more than 2 decimals are rejected, never rounded.
 * 0 is valid here; whether an amount must be positive is the caller's rule.
 */
export function parseAmountToMinor(text: string): number | null {
  const raw = text.trim();
  // "," is the decimal point only when it is the sole separator ("1,2,3" stays invalid).
  const normalized = raw.includes(",") && !raw.includes(".") ? raw.replace(",", ".") : raw;

  const match = /^(\d*)(?:\.(\d*))?$/.exec(normalized);
  if (!match) return null;
  const whole = (match[1] ?? "").replace(/^0+/, "");
  const fraction = match[2] ?? "";
  if (whole === "" && (match[1] ?? "") === "" && fraction === "") return null; // "", "."
  if (fraction.length > MAX_DECIMALS || whole.length > MAX_INTEGER_DIGITS) return null;

  return Number(whole || "0") * 100 + Number(fraction.padEnd(MAX_DECIMALS, "0"));
}

/**
 * Keeps whatever was typed or pasted inside the shape `parseAmountToMinor`
 * accepts: digits and one decimal separator, at most 2 decimals. What the field
 * shows is exactly what will be parsed, so nothing changes behind the user's back.
 */
export function sanitizeAmountInput(text: string): string {
  let s = text.replace(/[^0-9.,]/g, "");
  if (s.includes(".") && s.includes(",")) {
    // "1,234.50" or "1.234,50": the last separator is the decimal point.
    const thousands = s.lastIndexOf(".") > s.lastIndexOf(",") ? "," : ".";
    s = s.split(thousands).join("");
  }
  s = s.replace(/,/g, "."); // a lone "," is the decimal point

  const [whole = "", ...rest] = s.split(".");
  const integer = whole.slice(0, MAX_INTEGER_DIGITS);
  if (rest.length === 0) return integer;
  return `${integer}.${rest.join("").slice(0, MAX_DECIMALS)}`;
}

/** Integer minor units -> the text an amount field shows ("250", "250.50", "0.05"), by integer math. */
export function minorToAmountText(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const cents = minor % 100;
  return cents === 0 ? String(whole) : `${whole}.${String(cents).padStart(2, "0")}`;
}

/** Sum of integer amounts; the only way client totals are built (never add display_* floats). */
export function sumMinor(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
