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

  // P6: fixed size (scaled fonts break financial layouts) and one line that
  // shrinks to fit, so a very large amount (F6) never wraps or overflows.
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false} tone={resolved} {...rest}>
      {text}
    </Text>
  );
}
