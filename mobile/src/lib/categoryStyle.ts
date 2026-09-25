// Category colours and emoji (Day-0 §8), ported from the web's
// frontend/lib/categories.ts so both clients paint a category the same way.
// A category's saved `color` is one of the HUES' `bar` hex values (what the web's
// swatches write); without one the hue comes from the seeded name, and unknown
// names get a stable hue from a hash. Import-free so `npm test` runs it.

export type Hue = "coral" | "amber" | "mint" | "sky" | "plum" | "pink" | "teal" | "neutral";

/** `bar`: solid fill (progress, icon tile). `bg`: pastel background. `fg`: text on `bg`. */
export type CategoryStyle = { bar: string; bg: string; fg: string };

export const HUES: Record<Hue, CategoryStyle> = {
  coral: { bar: "#FF6F5C", bg: "#FCE9E5", fg: "#8A4438" },
  amber: { bar: "#F2C14E", bg: "#FBF1D8", fg: "#8A6B24" },
  mint: { bar: "#6FCF97", bg: "#E9F5EE", fg: "#3E7A5A" },
  sky: { bar: "#6FA8DC", bg: "#E7EFF9", fg: "#3F6A9A" },
  plum: { bar: "#A46FCF", bg: "#F1E5F7", fg: "#6A4A8A" },
  pink: { bar: "#E48BB0", bg: "#FDE8EF", fg: "#8A3E68" },
  teal: { bar: "#5EC5C1", bg: "#DFF3F2", fg: "#3A6A68" },
  neutral: { bar: "#C7BFA8", bg: "#E4E0D2", fg: "#4A4033" },
};

export const HUE_NAMES = Object.keys(HUES) as Hue[];

/** The seeded categories (ai_service DEFAULT_CATEGORIES). */
const SEEDED: Record<string, { emoji: string; hue: Hue }> = {
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
  Groceries: { emoji: "🛒", hue: "mint" },
  Restaurants: { emoji: "🍜", hue: "coral" },
  Coffee: { emoji: "☕", hue: "amber" },
  Rent: { emoji: "🏠", hue: "plum" },
  Electricity: { emoji: "⚡", hue: "amber" },
  Internet: { emoji: "🌐", hue: "sky" },
  "Mobile/Phone": { emoji: "📞", hue: "teal" },
  Fuel: { emoji: "⛽", hue: "coral" },
  "Public Transit": { emoji: "🚆", hue: "sky" },
  Clothing: { emoji: "👕", hue: "pink" },
  Electronics: { emoji: "💻", hue: "plum" },
  Insurance: { emoji: "🛡️", hue: "teal" },
  Subscriptions: { emoji: "🔁", hue: "plum" },
  Fitness: { emoji: "🏋️", hue: "mint" },
  Household: { emoji: "🧹", hue: "neutral" },
  Pets: { emoji: "🐾", hue: "amber" },
  Salary: { emoji: "💼", hue: "mint" },
  Freelance: { emoji: "🧑‍💻", hue: "teal" },
  Business: { emoji: "🏢", hue: "sky" },
  Investments: { emoji: "📈", hue: "plum" },
  Interest: { emoji: "🏦", hue: "amber" },
  Refunds: { emoji: "↩️", hue: "mint" },
  "Other Income": { emoji: "➕", hue: "neutral" },
};

// Unknown names skip neutral so they stay colourful.
const FALLBACK: Hue[] = ["coral", "amber", "mint", "sky", "plum", "pink", "teal"];

/** The same 32-bit string hash as the web, so a custom category gets the same hue on both. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** The hue a saved `color` names (matched on `bar`, case-insensitive), or null. */
export function hueForColor(color: string | null | undefined): Hue | null {
  if (!color) return null;
  const hex = color.toUpperCase();
  return HUE_NAMES.find((hue) => HUES[hue].bar === hex) ?? null;
}

export function categoryHue(name: string | null | undefined, color?: string | null): Hue {
  const saved = hueForColor(color);
  if (saved) return saved;
  if (!name) return "neutral";
  return SEEDED[name]?.hue ?? FALLBACK[hash(name) % FALLBACK.length];
}

export function categoryStyle(name: string | null | undefined, color?: string | null): CategoryStyle {
  return HUES[categoryHue(name, color)];
}

/**
 * A saved emoji icon, else the seeded emoji, else a tag. The backend seeds icons
 * as words ("food"), which are not drawable, so anything with a letter or digit
 * is ignored.
 */
export function categoryEmoji(name: string | null | undefined, icon?: string | null): string {
  const saved = icon?.trim();
  if (saved && !/[A-Za-z0-9]/.test(saved)) return saved;
  return (name && SEEDED[name]?.emoji) || "🏷";
}
