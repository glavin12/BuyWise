import type { Ref } from "react";
import { StyleSheet, Text as RNText, TextInput, View } from "react-native";

import { sanitizeAmountInput } from "@/lib/money";

import { colors, extra, fonts, type } from "./tokens";

/**
 * The QuickAdd amount (design v3): a muted currency symbol, then the typed figure at 86 with a
 * tomato caret, centred. Every change (typed or pasted) is sanitised to digits and one decimal
 * separator, so what it shows is exactly what parseAmountToMinor reads. Callers keep the text and
 * turn it into minor units only on submit.
 */
export function EntryAmount({
  value,
  onChange,
  symbol,
  label = "Amount",
  autoFocus,
  ref,
}: {
  value: string;
  onChange: (text: string) => void;
  symbol: string;
  /** What screen readers call the field, when a screen has more than one amount or it is not a plain "Amount". */
  label?: string;
  autoFocus?: boolean;
  ref?: Ref<TextInput>;
}) {
  return (
    <View style={styles.entry}>
      <RNText style={styles.symbol}>{symbol}</RNText>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(sanitizeAmountInput(text))}
        keyboardType="decimal-pad"
        autoCorrect={false}
        autoFocus={autoFocus}
        placeholder="0"
        placeholderTextColor={extra.dashedOnCream}
        accessibilityLabel={label}
        selectionColor={colors.tomato}
        cursorColor={colors.tomato}
        style={styles.figure}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  entry: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  symbol: { fontFamily: fonts.number, fontSize: 40, color: extra.symbolOnCream, marginTop: 22 },
  figure: {
    fontFamily: type.entryAmount.fontFamily,
    fontSize: type.entryAmount.fontSize,
    letterSpacing: -1,
    color: colors.ink,
    minWidth: 50,
    padding: 0,
    includeFontPadding: false,
  },
});
