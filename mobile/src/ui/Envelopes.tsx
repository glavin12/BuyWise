import { Check, Pencil } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";

import type { EnvelopeStatus } from "@/lib/budget";

import { PressableScale } from "./PressableScale";
import { Skeleton } from "./Skeleton";
import { useTabBarSpace } from "./TabBar";
import { colors, extra, fonts, radius, type } from "./tokens";

// The Budget envelope stack (DESIGN.md §3 `EnvelopeStack`, values from design/reference-html/Budget.html):
// tabs overlap by 22 with a top radius of 24, and the front card (radius 26, marigold) runs to the
// bottom of the screen under the tab bar's marigold fade. A tab's colour says its state, and its
// words say it too.

const TAB = {
  done: { bg: colors.tomato, fg: colors.ink, status: colors.ink },
  over: { bg: extra.envelopeDark, fg: colors.text, status: colors.tomato },
  progress: { bg: colors.sky, fg: colors.ink, status: colors.ink },
  unset: { bg: colors.mint, fg: colors.ink, status: colors.forest },
  more: { bg: colors.lavender, fg: colors.ink, status: colors.ink },
} as const;

/** The cream "READY TO ASSIGN" card: the amount (a placeholder while it loads), a line under it, an action on the right. */
export function ReadyCard({ amount, line, action }: { amount: string | null; line: string; action: ReactNode }) {
  return (
    <View style={styles.ready}>
      <View style={styles.readyText} accessible accessibilityLabel={`Ready to assign: ${amount ?? "loading"}. ${line}`}>
        <RNText style={styles.readyLabel}>Ready to assign</RNText>
        {amount === null ? (
          <Skeleton width="60%" height={30} />
        ) : (
          <RNText style={styles.readyAmount} numberOfLines={1} adjustsFontSizeToFit>
            {amount}
          </RNText>
        )}
        <RNText style={styles.readyLine}>{line}</RNText>
      </View>
      {action}
    </View>
  );
}

/** Wraps the tabs and the front card: 6 wider on each side than the screen padding, like the design. */
export function EnvelopeStack({ children }: { children: ReactNode }) {
  return <View style={styles.stack}>{children}</View>;
}

/**
 * One envelope behind the front card: its name and status. Tapping it brings it to the front;
 * `onSet` (unbudgeted tabs) adds the ink "Set" chip, offered to screen readers as an action.
 */
export function EnvelopeTab({
  name,
  status,
  onPress,
  onSet,
}: {
  name: string;
  status: EnvelopeStatus;
  onPress: () => void;
  onSet?: () => void;
}) {
  const look = TAB[status.kind];
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={1}
      accessibilityLabel={`${name}, ${status.text}`}
      accessibilityHint="Shows this envelope"
      accessibilityActions={onSet ? [{ name: "set", label: "Set a budget" }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "set") onSet?.();
      }}
      style={[styles.tab, { backgroundColor: look.bg }]}
    >
      <RNText style={[type.cardTitle, styles.tabName, { color: look.fg }]} numberOfLines={1}>
        {name}
      </RNText>
      <View style={styles.status}>
        <RNText style={[styles.statusText, { color: look.status }, status.kind === "over" && styles.bold]} numberOfLines={1}>
          {status.text}
        </RNText>
        {status.kind === "done" ? (
          <View style={styles.check}>
            <Check size={13} color={colors.cream} strokeWidth={3} />
          </View>
        ) : null}
        {onSet ? (
          <PressableScale onPress={onSet} hitSlop={8} importantForAccessibility="no" accessibilityElementsHidden style={styles.set}>
            <RNText style={styles.setText}>Set</RNText>
          </PressableScale>
        ) : null}
      </View>
    </PressableScale>
  );
}

/** The front envelope: marigold, down to the bottom of the screen, its content clear of the tab bar. */
export function EnvelopeFront({ children }: { children: ReactNode }) {
  const barSpace = useTabBarSpace();
  return <View style={[styles.front, { paddingBottom: barSpace }]}>{children}</View>;
}

/** "budgeted ₹8,000 ✎" with the amount dotted-underlined, or "not budgeted · set a budget ✎". Opens the Set screen. */
export function BudgetedLine({ amount, onPress }: { amount: string | null; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={amount ? `Budgeted ${amount}. Edit budget` : "Not budgeted. Set a budget"}
      hitSlop={8}
      style={styles.budgeted}
    >
      <RNText style={styles.budgetedText}>{amount ? "budgeted " : "not budgeted · "}</RNText>
      <RNText style={[styles.budgetedText, styles.bold, styles.dotted]}>{amount ?? "set a budget"}</RNText>
      <Pencil size={14} color={colors.ink} strokeWidth={2.3} />
    </PressableScale>
  );
}

const shadow = {
  shadowColor: extra.envelopeShadow,
  shadowOffset: { width: 0, height: -6 },
  shadowRadius: 14,
  shadowOpacity: 1,
  elevation: 6,
} as const;

const styles = StyleSheet.create({
  ready: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: 22,
    backgroundColor: colors.cream,
  },
  readyText: { flex: 1, minWidth: 0 },
  readyLabel: { ...type.label, color: extra.mutedOnCream },
  readyAmount: { fontFamily: fonts.numberBold, fontSize: 32, lineHeight: 34, color: colors.ink },
  readyLine: { fontFamily: fonts.mono, fontSize: 10.5, color: extra.proseOnCream },
  stack: { flexGrow: 1, marginHorizontal: -6, marginTop: 38, paddingTop: 22 },
  tab: {
    ...shadow,
    marginTop: -22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 34,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  tabName: { flexShrink: 1 },
  status: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusText: { fontFamily: fonts.mono, fontSize: 11 },
  bold: { fontFamily: fonts.monoBold },
  check: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  set: { paddingVertical: 4, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: colors.ink },
  setText: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.cream },
  front: {
    ...shadow,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 18,
    marginTop: -22,
    flexGrow: 1,
    gap: 12,
    paddingTop: 18,
    paddingHorizontal: 18,
    borderTopLeftRadius: radius.cardLg,
    borderTopRightRadius: radius.cardLg,
    backgroundColor: colors.marigold,
  },
  budgeted: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6 },
  budgetedText: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink },
  dotted: { textDecorationLine: "underline", textDecorationStyle: "dotted" },
});
