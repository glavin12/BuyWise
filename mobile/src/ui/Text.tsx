import { Text as RNText, useWindowDimensions, type TextProps as RNTextProps } from "react-native";

import { theme } from "./theme";

export type TextVariant = keyof typeof theme.type;
export type TextTone = "default" | "muted" | "positive" | "negative" | "accent" | "onAccent";

export type TextProps = Omit<RNTextProps, "style"> & {
  variant?: TextVariant;
  tone?: TextTone;
  align?: "left" | "center" | "right";
};

const TONE: Record<TextTone, string> = {
  default: theme.color.text,
  muted: theme.color.textMuted,
  positive: theme.color.positive,
  negative: theme.color.negative,
  accent: theme.color.accent,
  onAccent: theme.color.onAccent,
};

export function Text({ variant = "body", tone = "default", align, ...rest }: TextProps) {
  const { width } = useWindowDimensions();
  // P1: hero-size text shrinks on very narrow phones (320-360pt) to avoid overflow.
  const type =
    variant === "display" && width < 360
      ? { ...theme.type.display, fontSize: 32, lineHeight: 38 }
      : theme.type[variant];

  return <RNText style={[type, { color: TONE[tone], textAlign: align }]} {...rest} />;
}
