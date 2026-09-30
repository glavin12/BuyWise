// Category hues (Day-0 §8), ported from the web's frontend/lib/categories.ts so both clients
// colour a category the same way. A category's saved `color` is one of the HUES' `bar` hex values
// (what the web's swatches write); without one the hue comes from the seeded name, and unknown
// names get a stable hue from a hash. The v3 tile colour is mapped from the hue in ui/CategoryTile.
// Import-free so `npm test` runs it.

export type Hue = "coral" | "amber" | "mint" | "sky" | "plum" | "pink" | "teal" | "neutral";

/** `bar`: the solid hex a hue is saved as. */
export const HUES: Record<Hue, { bar: string }> = {
  coral: { bar: "#FF6F5C" },
  amber: { bar: "#F2C14E" },
  mint: { bar: "#6FCF97" },
  sky: { bar: "#6FA8DC" },
  plum: { bar: "#A46FCF" },
  pink: { bar: "#E48BB0" },
  teal: { bar: "#5EC5C1" },
  neutral: { bar: "#C7BFA8" },
};

export const HUE_NAMES = Object.keys(HUES) as Hue[];

/** The seeded categories (ai_service DEFAULT_CATEGORIES). */
const SEEDED: Record<string, Hue> = {
  Food: "coral",
  Transport: "sky",
  Shopping: "pink",
  Bills: "teal",
  Entertainment: "plum",
  Healthcare: "mint",
  Education: "amber",
  Travel: "sky",
  "Personal Care": "pink",
  "Gifts & Donations": "coral",
  Family: "mint",
  "Fees & Charges": "neutral",
  "Other Expense": "neutral",
  Groceries: "mint",
  Restaurants: "coral",
  Coffee: "amber",
  Rent: "plum",
  Electricity: "amber",
  Internet: "sky",
  "Mobile/Phone": "teal",
  Fuel: "coral",
  "Public Transit": "sky",
  Clothing: "pink",
  Electronics: "plum",
  Insurance: "teal",
  Subscriptions: "plum",
  Fitness: "mint",
  Household: "neutral",
  Pets: "amber",
  Salary: "mint",
  Freelance: "teal",
  Business: "sky",
  Investments: "plum",
  Interest: "amber",
  Refunds: "mint",
  "Other Income": "neutral",
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
  return SEEDED[name] ?? FALLBACK[hash(name) % FALLBACK.length];
}
