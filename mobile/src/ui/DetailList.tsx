import { StyleSheet, Text as RNText, View } from "react-native";

import { colors, radius, type } from "./tokens";

/**
 * A card of label / value lines ("METHOD  UPI") for a detail screen, a hairline between them. A row with
 * no value is left out, so a screen lists every field it might have and the card shows the ones that are set.
 */
export function DetailList({ rows }: { rows: readonly { label: string; value: string | null | undefined }[] }) {
  const shown = rows.flatMap((row) => (row.value ? [{ label: row.label, value: row.value }] : []));
  return (
    <View style={styles.card}>
      {shown.map((row, i) => (
        <View key={row.label} accessible accessibilityLabel={`${row.label}: ${row.value}`} style={[styles.row, i > 0 && styles.divider]}>
          <RNText style={styles.label}>{row.label}</RNText>
          <RNText style={styles.value}>{row.value}</RNText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, paddingHorizontal: 16, backgroundColor: colors.card },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 13 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  label: { ...type.label, width: 84, marginTop: 4, color: colors.muted },
  value: { ...type.body, flex: 1, minWidth: 0, color: colors.text },
});
