import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text as RNText, View, type StyleProp, type ViewStyle } from "react-native";

import type { Hue } from "./Chips";
import { PressableScale } from "./PressableScale";
import { colors, radius, type } from "./tokens";

// Title, Panel and IconTile (DESIGN.md §3).

/** Condensed uppercase heading. Put "\n" in the text for the two-line titles ("MONEY\nBUDDY"). */
export function Title({
  children,
  size = "title",
  tone = "text",
}: {
  children: string;
  size?: "title" | "titleXL" | "cardTitle";
  /** `ink` on light and colour surfaces. */
  tone?: "text" | "ink";
}) {
  return (
    <RNText accessibilityRole="header" style={[type[size], { color: colors[tone] }]}>
      {children}
    </RNText>
  );
}

/** The design's card: a rounded colour block. Tappable when given `onPress`. */
export function Panel({
  children,
  color = "card",
  large,
  onPress,
  label,
  style,
}: {
  children: ReactNode;
  color?: Hue;
  /** Radius 26 (the Spend Pulse / envelope front cards) instead of 24. */
  large?: boolean;
  onPress?: () => void;
  /** Screen-reader label when tappable. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const look = [styles.panel, { backgroundColor: colors[color], borderRadius: large ? radius.cardLg : radius.card }, style];
  if (!onPress) return <View style={look}>{children}</View>;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={look}>
      {children}
    </PressableScale>
  );
}

// size → [corner radius, glyph size], from design/reference-html.
const TILE = { 30: [10, 16], 44: [radius.tile, 20], 46: [radius.tile, 22], 58: [radius.tileLg, 26] } as const;

/** Rounded colour square with an ink line glyph: categories, recent tiles. */
export function IconTile({ icon: Icon, color, size = 44 }: { icon: LucideIcon; color: Hue; size?: keyof typeof TILE }) {
  const [corner, glyph] = TILE[size];
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: corner, backgroundColor: colors[color] }]}>
      <Icon size={glyph} color={colors.ink} strokeWidth={2.1} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 14 },
  tile: { alignItems: "center", justifyContent: "center" },
});
