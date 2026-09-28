import { ChevronRight, X, type LucideIcon } from "lucide-react-native";
import { StyleSheet, Text as RNText, TextInput, View, type TextInputProps } from "react-native";

import { PressableScale } from "./PressableScale";
import { colors, extra, fonts, radius } from "./tokens";

// A field on a cream sheet (design/reference-html/QuickAdd.html payee row): cream-field fill,
// radius 17, 50 tall, a leading icon. `FieldButton` opens a chooser; `FieldInput` is typed into.

/** Shows the chosen value (or a placeholder), a small hint and a chevron; `onClear` swaps the chevron for an ✕. */
export function FieldButton({
  icon: Icon,
  value,
  placeholder,
  hint,
  onPress,
  onClear,
  label,
}: {
  icon: LucideIcon;
  value: string | null;
  placeholder: string;
  hint?: string;
  onPress: () => void;
  onClear?: () => void;
  /** Screen-reader name of the field ("Payee"). */
  label: string;
}) {
  return (
    <View style={styles.field}>
      <PressableScale onPress={onPress} accessibilityLabel={`${label}: ${value ?? "none"}. Tap to choose`} style={styles.press}>
        <Icon size={18} color={colors.ink} strokeWidth={2.1} />
        <RNText style={[styles.text, !value && styles.placeholder]} numberOfLines={1}>
          {value ?? placeholder}
        </RNText>
        {hint ? <RNText style={styles.hint}>{hint}</RNText> : null}
        {value && onClear ? null : <ChevronRight size={15} color={colors.ink} strokeWidth={2.6} />}
      </PressableScale>
      {value && onClear ? (
        <PressableScale onPress={onClear} accessibilityLabel={`Remove ${label.toLowerCase()}`} hitSlop={12} style={styles.clear}>
          <X size={15} color={colors.ink} strokeWidth={2.6} />
        </PressableScale>
      ) : null}
    </View>
  );
}

export function FieldInput({ icon: Icon, ...input }: TextInputProps & { icon: LucideIcon; accessibilityLabel: string }) {
  return (
    <View style={[styles.field, styles.inputField]}>
      <Icon size={18} color={colors.ink} strokeWidth={2.1} />
      <TextInput {...input} style={styles.input} placeholderTextColor={extra.mutedOnCream} selectionColor={colors.tomato} cursorColor={colors.tomato} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", height: 50, borderRadius: radius.field, backgroundColor: colors.creamField },
  press: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, height: "100%", paddingHorizontal: 14 },
  inputField: { gap: 10, paddingHorizontal: 14 },
  text: { flex: 1, fontFamily: fonts.mono, fontSize: 13, color: colors.ink },
  placeholder: { color: extra.mutedOnCream },
  hint: { fontFamily: fonts.mono, fontSize: 10.5, color: extra.mutedOnCream },
  clear: { paddingRight: 14 },
  input: { flex: 1, height: "100%", fontFamily: fonts.mono, fontSize: 13, color: colors.ink, padding: 0 },
});
