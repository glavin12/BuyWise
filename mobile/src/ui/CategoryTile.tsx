import {
  BadgePercent,
  Check,
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

import { StyleSheet, Text as RNText, View } from "react-native";

import { categoryHue, type Hue as CategoryHue } from "@/lib/categoryStyle";

import { IconTile } from "./Blocks";
import type { Hue } from "./Chips";
import { PressableScale } from "./PressableScale";
import { colors, extra, fonts, radius } from "./tokens";

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

/** The seeded categories (ai_service DEFAULT_CATEGORIES): icon keyword, name, glyph. The keywords are what `icon` saves. */
const SEEDED: [key: string, name: string, glyph: LucideIcon][] = [
  ["food", "Food", Utensils],
  ["transport", "Transport", Bus],
  ["shopping", "Shopping", ShoppingBag],
  ["bills", "Bills", Receipt],
  ["entertainment", "Entertainment", Clapperboard],
  ["healthcare", "Healthcare", Stethoscope],
  ["education", "Education", GraduationCap],
  ["travel", "Travel", Plane],
  ["personal-care", "Personal Care", Sparkles],
  ["gifts", "Gifts & Donations", Gift],
  ["family", "Family", Users],
  ["fees", "Fees & Charges", BadgePercent],
  ["other", "Other Expense", Tag],
  ["groceries", "Groceries", ShoppingCart],
  ["restaurants", "Restaurants", Soup],
  ["coffee", "Coffee", Coffee],
  ["rent", "Rent", House],
  ["electricity", "Electricity", Zap],
  ["internet", "Internet", Wifi],
  ["mobile-phone", "Mobile/Phone", Smartphone],
  ["fuel", "Fuel", Fuel],
  ["public-transit", "Public Transit", TramFront],
  ["clothing", "Clothing", Shirt],
  ["electronics", "Electronics", Laptop],
  ["insurance", "Insurance", Shield],
  ["subscriptions", "Subscriptions", Repeat],
  ["fitness", "Fitness", Dumbbell],
  ["household", "Household", Sofa],
  ["pets", "Pets", PawPrint],
  ["salary", "Salary", Briefcase],
  ["freelance", "Freelance", PenTool],
  ["business", "Business", Store],
  ["investments", "Investments", TrendingUp],
  ["interest", "Interest", Landmark],
  ["refunds", "Refunds", Undo2],
  ["other-income", "Other Income", Banknote],
];
const BY_KEY = new Map(SEEDED.map(([key, , glyph]) => [key, glyph]));
const BY_NAME = new Map(SEEDED.map(([, name, glyph]) => [name, glyph]));

/** What the category editor's icon picker offers: each keyword (saved as the category's `icon`) and its glyph. */
export const CATEGORY_GLYPHS = SEEDED.map(([key, , glyph]) => ({ key, glyph }));

/** A category's glyph: its saved icon keyword, else its seeded name (emoji and older icons), else a tag. No category (a starting balance) is a wallet. */
export function categoryGlyph(name: string | null | undefined, icon?: string | null): LucideIcon {
  if (!name) return Wallet;
  return (icon && BY_KEY.get(icon)) || BY_NAME.get(name) || Tag;
}

/** A category's v3 colour, for tiles and legend dots. */
export function categoryTone(name: string | null | undefined, color?: string | null): Hue {
  return V3[categoryHue(name, color)];
}

/** A category's glyph on its colour tile. */
export function CategoryTile({ name, color, icon, size = 44 }: { name: string | null; color?: string | null; icon?: string | null; size?: 30 | 44 | 46 | 58 }) {
  return <IconTile icon={categoryGlyph(name, icon)} color={name ? categoryTone(name, color) : "sage"} size={size} />;
}

/** A 58 category tile with its name under it (QuickAdd). Chosen: an ink ring and a ✓ badge, the name bold. */
export function CategoryChoice({
  name,
  color,
  icon,
  selected,
  onPress,
}: {
  name: string;
  color?: string | null;
  icon?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={name} accessibilityState={{ selected }} style={styles.choice}>
      <View>
        <CategoryTile name={name} color={color} icon={icon} size={58} />
        {selected ? (
          <>
            <View style={styles.ring} />
            <View style={styles.badge}>
              <Check size={13} color={colors.cream} strokeWidth={3} />
            </View>
          </>
        ) : null}
      </View>
      <RNText style={[styles.choiceLabel, selected && styles.choiceLabelOn]} numberOfLines={1}>
        {name}
      </RNText>
    </PressableScale>
  );
}

/** The dashed tile at the end of the row ("More": the full list, where a new category is made too). */
export function DashedChoice({ label, icon: Icon, onPress, a11y }: { label: string; icon: LucideIcon; onPress: () => void; a11y: string }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={a11y} style={styles.choice}>
      <View style={styles.dashed}>
        <Icon size={24} color={extra.mutedOnCream} strokeWidth={2.4} />
      </View>
      <RNText style={[styles.choiceLabel, { color: extra.mutedOnCream }]}>{label}</RNText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  choice: { width: 64, alignItems: "center", gap: 6 },
  ring: { ...StyleSheet.absoluteFill, borderRadius: radius.tileLg, borderWidth: 2.5, borderColor: colors.ink },
  badge: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.ink },
  choiceLabelOn: { fontFamily: fonts.monoBold },
  dashed: {
    width: 58,
    height: 58,
    borderRadius: radius.tileLg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: extra.dashedOnCream,
    alignItems: "center",
    justifyContent: "center",
  },
});
