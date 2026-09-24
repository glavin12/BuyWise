import { formatCurrency } from "@/lib/format";

import { Text, type TextProps } from "./Text";

export type AmountProps = Omit<TextProps, "children"> & {
  /** A `display_*` value from the API (e.g. 10.5), never minor units. */
  value: number;
  currency?: string;
  /** Prefix positives with "+" and colour them green. Negatives are always red. */
  signed?: boolean;
};

export function Amount({ value, currency = "INR", signed, tone, ...rest }: AmountProps) {
  const v = value === 0 ? 0 : value; // normalise -0
  const text = (signed && v > 0 ? "+" : "") + formatCurrency(v, currency);
  const resolved = tone ?? (v < 0 ? "negative" : signed && v > 0 ? "positive" : "default");

  // P6/M26: text scaling stays on for accessibility but is capped so a scaled
  // amount cannot break a financial layout, and it is one line that shrinks to
  // fit, so a very large amount (F6) never wraps or overflows.
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3} tone={resolved} {...rest}>
      {text}
    </Text>
  );
}
