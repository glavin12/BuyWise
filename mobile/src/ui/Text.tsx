import { Text as RNText, useWindowDimensions, type TextProps as RNTextProps } from "react-native";

import { theme } from "./theme";

export type TextVariant = keyof typeof theme.type;
export type TextTone = "default" | "muted" | "positive" | "negative" | "warning" | "accent" | "onAccent";

export type TextProps = Omit<RNTextProps, "style"> & {
  variant?: TextVariant;
  tone?: TextTone;
  align?: "left" | "center" | "right";
  /** Serif money figures. Set by `Amount`; screens use `Amount` instead. */
  numeric?: boolean;
};

const TONE: Record<TextTone, string> = {
  default: theme.color.text,
  muted: theme.color.textMuted,
  positive: theme.color.positive,
  negative: theme.color.negative,
  warning: theme.color.warning,
  accent: theme.color.accent,
  onAccent: theme.color.onAccent,
};

export function Text({ variant = "body", tone = "default", align, numeric, ...rest }: TextProps) {
  const { width } = useWindowDimensions();
  const scale = numeric ? theme.amount : theme.type;
  // P1: the hero size drops from 44 to 36 on very narrow phones (320-360pt) to avoid overflow.
  const type = variant === "display" && width < 360 ? { ...scale.display, fontSize: 36, lineHeight: 42 } : scale[variant];

  return (
    <RNText
      style={[type, { color: TONE[tone], textAlign: align }, numeric && { fontVariant: ["tabular-nums"] }]}
      {...rest}
    />
  );
}
