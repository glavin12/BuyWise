import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text as RNText } from "react-native";

import { PressableScale } from "./PressableScale";
import { colors, radius, type } from "./tokens";

/** One row of a settings list (categories, payees): a tile, the name in uppercase and a chevron. Tapping it opens the editor. */
export function SettingsRow({ tile, title, onPress }: { tile: ReactNode; title: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${title}. Tap to edit`} style={styles.row}>
      {tile}
      <RNText style={styles.title} numberOfLines={1}>
        {title}
      </RNText>
      <ChevronRight size={18} color={colors.muted} strokeWidth={2.4} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.row, backgroundColor: colors.card },
  title: { ...type.rowTitle, flex: 1, minWidth: 0, color: colors.text },
});
