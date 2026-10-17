import { StyleSheet, TextInput, View } from "react-native";

import { Search, X } from "./icons";
import { PressableScale } from "./PressableScale";
import { colors, fonts, radius, type } from "./tokens";

// The v3 search pill (design/reference-html/Transactions.html): card fill, mono placeholder,
// and a clear button on the right once something is typed. The design's voice glyph is left out
// until voice input exists.

export function SearchField({
  value,
  onChangeText,
  placeholder,
  label,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Screen-reader name of the field. */
  label: string;
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
      ) : null}
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
  input: { flex: 1, minWidth: 0, padding: 0, fontFamily: fonts.mono, fontSize: type.body.fontSize, color: colors.text },
});
