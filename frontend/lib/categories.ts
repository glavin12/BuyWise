/**
 * Category + payment-method visual system — the ONE source of colour/emoji.
 *
 * "Colorful cream" design: every category renders as a pastel chip (bg + dark
 * fg), a solid bar colour (progress bars, icon tiles), and an emoji. Consumed by
 * category-tag, progress-bar, transaction-row, and every screen. No page may
 * hard-code a category hex — import from here.
 *
 * Keyed by the real seeded category names (see
 * ai_service/repositories/category_repository.py). Unknown / user-created
 * categories fall back to a deterministic hue by name hash so they stay stable.
 */

export type Hue =
  | "coral"
  | "amber"
  | "mint"
  | "sky"
  | "plum"
  | "pink"
  | "teal"
  | "neutral";

export interface CategoryStyle {
  /** solid colour — progress fill, icon tile bg */
  bar: string;
  /** pastel chip background */
  bg: string;
  /** dark foreground text on the pastel bg */
  fg: string;
  /** chip / card border */
  border: string;
}

export const HUES: Record<Hue, CategoryStyle> = {
  coral: { bar: "#FF6F5C", bg: "#FCE9E5", fg: "#8A4438", border: "#F4C7BF" },
  amber: { bar: "#F2C14E", bg: "#FBF1D8", fg: "#8A6B24", border: "#EAD9A6" },
  mint: { bar: "#6FCF97", bg: "#E9F5EE", fg: "#3E7A5A", border: "#C7E4D2" },
  sky: { bar: "#6FA8DC", bg: "#E7EFF9", fg: "#3F6A9A", border: "#C5D8ED" },
  plum: { bar: "#A46FCF", bg: "#F1E5F7", fg: "#6A4A8A", border: "#DDBFE8" },
  pink: { bar: "#E48BB0", bg: "#FDE8EF", fg: "#8A3E68", border: "#F1C6D6" },
  teal: { bar: "#5EC5C1", bg: "#DFF3F2", fg: "#3A6A68", border: "#CDE9E7" },
  neutral: { bar: "#C7BFA8", bg: "#E4E0D2", fg: "#4A4033", border: "#D8CFBB" },
};

/** name → { emoji, hue } for the seeded categories. */
const CATEGORY_MAP: Record<string, { emoji: string; hue: Hue }> = {
  // expenses
  Food: { emoji: "🍽", hue: "coral" },
  Transport: { emoji: "🚌", hue: "sky" },
  Shopping: { emoji: "🛍", hue: "pink" },
  Bills: { emoji: "📱", hue: "teal" },
  Entertainment: { emoji: "🎬", hue: "plum" },
  Healthcare: { emoji: "🩺", hue: "mint" },
  Education: { emoji: "🎓", hue: "amber" },
  Travel: { emoji: "✈️", hue: "sky" },
  "Personal Care": { emoji: "🧴", hue: "pink" },
  "Gifts & Donations": { emoji: "🎁", hue: "coral" },
  Family: { emoji: "👨‍👩‍👧", hue: "mint" },
  "Fees & Charges": { emoji: "🧾", hue: "neutral" },
  "Other Expense": { emoji: "🔖", hue: "neutral" },
  // income
  Salary: { emoji: "💼", hue: "mint" },
  Freelance: { emoji: "🧑‍💻", hue: "teal" },
  Business: { emoji: "🏢", hue: "sky" },
  Investments: { emoji: "📈", hue: "plum" },
  Interest: { emoji: "🏦", hue: "amber" },
  Refunds: { emoji: "↩️", hue: "mint" },
  "Other Income": { emoji: "➕", hue: "neutral" },
};

/** hues used for the deterministic fallback (skip neutral so unknowns stay colourful). */
const FALLBACK_HUES: Hue[] = ["coral", "amber", "mint", "sky", "plum", "pink", "teal"];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function categoryHue(name: string | null | undefined): Hue {
  if (!name) return "neutral";
  const known = CATEGORY_MAP[name];
  if (known) return known.hue;
  return FALLBACK_HUES[hashString(name) % FALLBACK_HUES.length];
}

/** Emoji for a category. Prefer the seeded map; fall back to a generic tag. */
export function categoryEmoji(name: string | null | undefined): string {
  if (!name) return "🏷";
  return CATEGORY_MAP[name]?.emoji ?? "🏷";
}

/** Full style block (bar/bg/fg/border) for a category name. */
export function categoryStyle(name: string | null | undefined): CategoryStyle {
  return HUES[categoryHue(name)];
}

// ── Payment methods ────────────────────────────────────────────────
// Backend enum: cash | upi | bank_transfer | card | other  (nullable)

export const PAYMENT_METHOD_ORDER = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "other",
] as const;

const PAYMENT_METHOD_MAP: Record<
  string,
  { emoji: string; label: string; hue: Hue }
> = {
  cash: { emoji: "💵", label: "Cash", hue: "mint" },
  upi: { emoji: "📱", label: "UPI", hue: "sky" },
  card: { emoji: "💳", label: "Card", hue: "amber" },
  bank_transfer: { emoji: "🏦", label: "Bank transfer", hue: "plum" },
  other: { emoji: "🔖", label: "Other", hue: "neutral" },
};

const UNSPECIFIED = { emoji: "•", label: "Unspecified", hue: "neutral" as Hue };

export function paymentMethodInfo(pm: string | null | undefined) {
  const info = pm ? PAYMENT_METHOD_MAP[pm] : undefined;
  const base = info ?? UNSPECIFIED;
  return { ...base, ...HUES[base.hue] };
}

export function paymentMethodLabel(pm: string | null | undefined): string {
  return paymentMethodInfo(pm).label;
}

/** Options for a <select>, in display order. */
export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHOD_ORDER.map((value) => ({
  value,
  label: PAYMENT_METHOD_MAP[value].label,
  emoji: PAYMENT_METHOD_MAP[value].emoji,
}));
