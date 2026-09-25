import { StyleSheet, View } from "react-native";

import { HUES } from "@/lib/categoryStyle";
import { formatMinor } from "@/lib/format";

import { Text } from "./Text";
import { theme } from "./theme";

export type BarChartMonth = {
  key: string;
  label: string;
  /** 0-100, each already scaled against the tallest bar in the whole chart (lib/reports.ts barPercents). */
  incomePercent: number;
  spendPercent: number;
  incomeMinor: number;
  spendMinor: number;
  selected?: boolean;
};

const BAR_HEIGHT = 96;

/**
 * Income vs. spend, one pair of bars per month. Plain Views sized by percent
 * height, no chart library. The exact amounts are only drawn for the selected
 * month (six pairs of amount labels do not fit a phone width); every month's
 * numbers are still in its accessibility label.
 */
export function BarChart({ months, currency }: { months: readonly BarChartMonth[]; currency: string }) {
  return (
    <View style={styles.row}>
      {months.map((m) => (
        <View key={m.key} style={styles.col}>
          <View style={styles.amounts}>
            {m.selected ? (
              <>
                <Text variant="caption" tone="positive" numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>
                  {formatMinor(m.incomeMinor, currency)}
                </Text>
                <Text variant="caption" tone="negative" numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>
                  {formatMinor(m.spendMinor, currency)}
                </Text>
              </>
            ) : null}
          </View>
          <View
            accessible
            accessibilityLabel={`${m.label}: income ${formatMinor(m.incomeMinor, currency)}, spent ${formatMinor(m.spendMinor, currency)}`}
            style={styles.bars}
          >
            <View style={[styles.bar, styles.income, { height: `${m.incomePercent}%` }]} />
            <View style={[styles.bar, styles.spend, { height: `${m.spendPercent}%` }]} />
          </View>
          <Text variant="caption" tone={m.selected ? "default" : "muted"} numberOfLines={1}>
            {m.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: theme.space.xs },
  col: { flex: 1, alignItems: "center", gap: theme.space.xs },
  amounts: { minHeight: 32, alignItems: "center", justifyContent: "flex-end" },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: BAR_HEIGHT },
  bar: { width: 8, minHeight: 2, borderRadius: theme.radius.sm },
  income: { backgroundColor: theme.color.positive },
  spend: { backgroundColor: HUES.coral.bar },
});
