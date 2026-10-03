import { useState, type Ref } from "react";
import { StyleSheet, Text as RNText, TextInput, View } from "react-native";

import { fitFontSize } from "@/lib/amountFit";
import { sanitizeAmountInput } from "@/lib/money";

import { colors, extra, fonts, type } from "./tokens";

/**
 * The QuickAdd amount (design v3): a muted currency symbol, then the typed figure at 86 with a
 * tomato caret, centred. Every change (typed or pasted) is sanitised to digits and one decimal
 * separator, so what it shows is exactly what parseAmountToMinor reads. Callers keep the text and
 * turn it into minor units only on submit. The figure shrinks (down to 36) so a long amount stays on one line, and
 * ignores the OS font scale: it is already huge, and scaling it up would push it off the screen.
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
  const [width, setWidth] = useState(0);
  const size = fitFontSize(value.length, width - SYMBOL_ROOM, type.entryAmount.fontSize);
  return (
    <View style={styles.entry} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <RNText style={styles.symbol} maxFontSizeMultiplier={1}>
        {symbol}
      </RNText>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(sanitizeAmountInput(text))}
        keyboardType="decimal-pad"
        autoCorrect={false}
        autoFocus={autoFocus}
        placeholder="0"
        placeholderTextColor={extra.placeholderOnCream}
        accessibilityLabel={label}
        selectionColor={colors.tomato}
        cursorColor={colors.tomato}
        maxFontSizeMultiplier={1}
        style={[styles.figure, { fontSize: size }]}
      />
    </View>
  );
}

const SYMBOL_ROOM = 40; // the currency symbol plus the gap beside it

const styles = StyleSheet.create({
  entry: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  symbol: { fontFamily: fonts.number, fontSize: 40, color: extra.symbolOnCream, marginTop: 22 },
  figure: {
    fontFamily: type.entryAmount.fontFamily, // fontSize is set from the width (fitFontSize)
    letterSpacing: -1,
    color: colors.ink,
    minWidth: 50,
    padding: 0,
    includeFontPadding: false,
  },
});
