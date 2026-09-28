import {
  BadgePercent,
  Banknote,
  Briefcase,
  Bus,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  House,
  Landmark,
  Laptop,
  PawPrint,
  PenTool,
  Plane,
  Receipt,
  Repeat,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sofa,
  Soup,
  Sparkles,
  Stethoscope,
  Store,
  Tag,
  TramFront,
  TrendingUp,
  Undo2,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react-native";

import { categoryHue, type Hue as CategoryHue } from "@/lib/categoryStyle";

import { IconTile } from "./Blocks";
import type { Hue } from "./Chips";

// Design v3 category look (DESIGN.md: "category icons are lucide glyphs on IconTiles", no emoji).
// The hue still comes from lib/categoryStyle (saved colour, else seeded name, else a hash),
// mapped onto the v3 palette so a category keeps its colour family across both looks.

const V3: Record<CategoryHue, Hue> = {
  coral: "tomato",
  amber: "marigold",
  mint: "mint",
  sky: "sky",
  plum: "peri2",
  pink: "lavender",
  teal: "mint2",
  neutral: "sage",
};

/** The seeded categories (ai_service DEFAULT_CATEGORIES); anything else gets a tag. */
const GLYPH: Record<string, LucideIcon> = {
  Food: Utensils,
  Transport: Bus,
  Shopping: ShoppingBag,
  Bills: Receipt,
  Entertainment: Clapperboard,
  Healthcare: Stethoscope,
  Education: GraduationCap,
  Travel: Plane,
  "Personal Care": Sparkles,
  "Gifts & Donations": Gift,
  Family: Users,
  "Fees & Charges": BadgePercent,
  "Other Expense": Tag,
  Groceries: ShoppingCart,
  Restaurants: Soup,
  Coffee,
  Rent: House,
  Electricity: Zap,
  Internet: Wifi,
  "Mobile/Phone": Smartphone,
  Fuel,
  "Public Transit": TramFront,
  Clothing: Shirt,
  Electronics: Laptop,
  Insurance: Shield,
  Subscriptions: Repeat,
  Fitness: Dumbbell,
  Household: Sofa,
  Pets: PawPrint,
  Salary: Briefcase,
  Freelance: PenTool,
  Business: Store,
  Investments: TrendingUp,
  Interest: Landmark,
  Refunds: Undo2,
  "Other Income": Banknote,
};

/** A category's v3 colour, for tiles and legend dots. */
export function categoryTone(name: string | null | undefined, color?: string | null): Hue {
  return V3[categoryHue(name, color)];
}

/** A category's glyph on its colour tile. No category (a starting balance) is a wallet. */
export function CategoryTile({ name, color, size = 44 }: { name: string | null; color?: string | null; size?: 30 | 44 | 46 | 58 }) {
  const icon = name ? (GLYPH[name] ?? Tag) : Wallet;
  return <IconTile icon={icon} color={name ? categoryTone(name, color) : "sage"} size={size} />;
}
