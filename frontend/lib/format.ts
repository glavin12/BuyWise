/**
 * Shared formatting utilities.
 *
 * DESIGN.md §4 principle 1: "The frontend must always render display_* for
 * currency and never re-derive display strings by dividing minor units in JS."
 *
 * These helpers format the `display_*` float values returned by the API.
 */

const LOCALE_MAP: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

/**
 * Format a `display_*` amount (already a float like 10.50) into a locale-aware
 * currency string. Never accepts minor units — callers must pass `display_*`.
 */
export function formatCurrency(
  displayAmount: number,
  currency = "INR"
): string {
  const locale = LOCALE_MAP[currency] || "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(displayAmount);
  } catch {
    return `${currency} ${displayAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

/**
 * Format an integer minor-unit amount to display value.
 * Only used when the API hasn't provided a `display_*` field (rare).
 */
export function minorToDisplay(minor: number): number {
  return minor / 100;
}

/**
 * Convert a user-entered display amount to integer minor units for API writes.
 * Uses banker's rounding to match the backend's `amount_to_minor()`.
 */
export function displayToMinor(display: number): number {
  return Math.round(display * 100);
}

/**
 * Format a date string to a short locale display.
 */
export function formatDate(
  dateStr: string,
  style: "short" | "medium" | "long" = "short"
): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "numeric", month: "short" }
      : style === "medium"
        ? { day: "numeric", month: "short", year: "numeric" }
        : { day: "numeric", month: "long", year: "numeric" };

  return d.toLocaleDateString("en-IN", options);
}

/**
 * Format month/year into a label like "August 2026".
 */
export function formatMonth(month: number, year: number): string {
  const d = new Date(year, month - 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Get the YYYY-MM string for a month/year pair.
 */
export function toMonthKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Relative time label (e.g. "2 hours ago").
 */
export function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr, "short");
}
