import { Search, X } from "lucide-react-native";
import { StyleSheet, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { PressableScale } from "./PressableScale";
import { colors, fonts, radius } from "./tokens";

// The v3 search pill (design/reference-html/Transactions.html): card fill, mono placeholder,
// a voice glyph on the right that becomes a clear button once something is typed.

export function SearchField({
  value,
  onChangeText,
  placeholder,
  label,
  onVoice,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Screen-reader name of the field. */
  label: string;
  onVoice: () => void;
}) {
  return (
    <View style={styles.field}>
      <Search size={18} color={colors.muted} strokeWidth={2.1} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        selectionColor={colors.tomato}
        cursorColor={colors.text}
        accessibilityLabel={label}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? (
        <PressableScale onPress={() => onChangeText("")} accessibilityLabel="Clear search" hitSlop={12}>
          <X size={18} color={colors.muted} strokeWidth={2.1} />
        </PressableScale>
      ) : (
        <PressableScale onPress={onVoice} accessibilityLabel="Search by voice" hitSlop={12}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" stroke={colors.muted} strokeWidth={2.1} strokeLinecap="round" />
          </Svg>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  input: { flex: 1, minWidth: 0, padding: 0, fontFamily: fonts.mono, fontSize: 12.5, color: colors.text },
});
