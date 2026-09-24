import type { Ref } from "react";
import type { TextInput } from "react-native";

import { sanitizeAmountInput } from "@/lib/money";

import { Input } from "./Input";

/**
 * Money text field. Every change is sanitised (typed or pasted) to digits and one
 * decimal separator, so what it shows is exactly what parseAmountToMinor reads.
 * Callers keep the text and turn it into minor units only on submit.
 */
export function AmountInput({
  value,
  onChange,
  currency,
  error,
  autoFocus,
  ref,
}: {
  value: string;
  onChange: (text: string) => void;
  currency: string;
  error?: string | null;
  autoFocus?: boolean;
  ref?: Ref<TextInput>;
}) {
  return (
    <Input
      ref={ref}
      label={`Amount (${currency})`}
      value={value}
      onChangeText={(text) => onChange(sanitizeAmountInput(text))}
      keyboardType="decimal-pad"
      autoCorrect={false}
      autoFocus={autoFocus}
      placeholder="0.00"
      error={error}
    />
  );
}
