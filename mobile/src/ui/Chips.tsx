import { ChevronDown, type LucideIcon } from "lucide-react-native";
import { StyleSheet, Text as RNText, View } from "react-native";

import { parseRich, type ChipKind } from "@/lib/richText";

import { PressableScale } from "./PressableScale";
import { colors, extra, fonts, radius, type } from "./tokens";

// Chips, pills and inline chips (DESIGN.md §3). Sizes come from design/reference-html.

export type Hue = keyof typeof colors;

const CHIP = {
  cream: { bg: colors.cream, fg: colors.ink, border: undefined },
  ink: { bg: colors.ink, fg: colors.cream, border: undefined },
  card: { bg: colors.card, fg: colors.text, border: undefined },
  lavender: { bg: colors.lavender, fg: colors.ink, border: undefined }, // category tag
  translucent: { bg: "transparent", fg: colors.text, border: undefined }, // legend on a colour card
  peri: { bg: colors.peri2, fg: "#FFFFFF", border: undefined }, // dropdown on the peri card
  outlined: { bg: "transparent", fg: colors.ink, border: colors.ink }, // on cream / colour
  outlinedDark: { bg: "transparent", fg: colors.text, border: colors.line }, // on charcoal
  mint: { bg: colors.mint, fg: colors.ink, border: undefined }, // QuickAdd suggestion
  creamLine: { bg: colors.cream, fg: colors.ink, border: colors.ink }, // Goals corner chips
} as const;
type ChipVariant = keyof typeof CHIP;

type ChipProps = {
  label: string;
  variant?: ChipVariant;
  /** 8px colour dot before the label. */
  dot?: Hue;
  /** 13px icon before the label. */
  icon?: LucideIcon;
  /** Makes it a button; `selected` is announced to screen readers. */
  onPress?: () => void;
  selected?: boolean;
  /** Screen-reader label when the visible text alone is unclear ("Today" → "Date, Today"). */
  accessibilityLabel?: string;
};

/** Pill-shaped label: filters, payment methods, legends, category tags. */
export function Chip(props: ChipProps) {
  return <ChipFrame {...props} />;
}

/**
 * A dropdown trigger: a chip with a trailing chevron. `knob` is the Home month selector:
 * full width, 44 tall, the chevron inside an ink circle at the right.
 */
export function Pill({ knob, ...props }: Omit<ChipProps, "dot" | "selected"> & { onPress: () => void; knob?: boolean }) {
  if (!knob) return <ChipFrame {...props} chevron />;
  const Icon = props.icon;
  return (
    <PressableScale onPress={props.onPress} accessibilityLabel={props.label} style={styles.knobPill}>
      {Icon && <Icon size={16} color={colors.ink} strokeWidth={2.2} />}
      <RNText style={styles.knobLabel} numberOfLines={1}>
        {props.label}
      </RNText>
      <View style={styles.knob}>
        <ChevronDown size={15} color={colors.cream} strokeWidth={2.6} />
      </View>
    </PressableScale>
  );
}

function ChipFrame({ label, variant = "cream", dot, icon: Icon, onPress, selected, accessibilityLabel, chevron }: ChipProps & { chevron?: boolean }) {
  const look = CHIP[variant];
  const small = variant === "lavender";
  const body = (
    <>
      {dot && <View style={[styles.dot, { backgroundColor: colors[dot] }]} />}
      {Icon && <Icon size={13} color={look.fg} strokeWidth={2.2} />}
      <RNText style={[styles.label, small && styles.labelSmall, { color: look.fg }]} numberOfLines={1}>
        {label}
      </RNText>
      {chevron && <ChevronDown size={13} color={look.fg} strokeWidth={2.6} />}
    </>
  );
  const style = [
    styles.chip,
    small && styles.chipSmall,
    { backgroundColor: look.bg },
    look.border && { borderWidth: variant === "outlinedDark" ? 1.5 : 1.4, borderColor: look.border },
  ];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected }} style={style}>
      {body}
    </PressableScale>
  );
}

// Two-way segmented switch. `ink` (QuickAdd Expense / Income): full width, tomato when on.
// `sage` (Goals Active / Achieved): sized to its labels, ink when on.
const TOGGLE = {
  ink: { track: colors.ink, pad: 4, on: colors.tomato, onFg: colors.ink, offFg: colors.cream, offFont: fonts.monoMedium, size: 12, height: 40 },
  sage: { track: colors.sage2, pad: 3, on: colors.ink, onFg: colors.cream, offFg: colors.ink, offFont: fonts.mono, size: 11, height: 30 },
} as const;

export function Toggle<T extends string>({
  options,
  value,
  onChange,
  look = "ink",
}: {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  look?: keyof typeof TOGGLE;
}) {
  const t = TOGGLE[look];
  const fill = look === "ink";
  return (
    <View accessibilityRole="tablist" style={[styles.toggle, { backgroundColor: t.track, padding: t.pad }, !fill && styles.toggleInline]}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <PressableScale
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: on }}
            style={[styles.toggleItem, { height: t.height, backgroundColor: on ? t.on : "transparent" }, fill ? styles.toggleFill : styles.toggleHug]}
          >
            <RNText style={{ fontFamily: on ? fonts.monoBold : t.offFont, fontSize: t.size, color: on ? t.onFg : t.offFg }}>{option.label}</RNText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const INLINE: Record<ChipKind, { bg: string; fg: string; border: string }> = {
  dark: { bg: extra.inlineDark, fg: colors.text, border: colors.line },
  hi: { bg: colors.marigold, fg: colors.ink, border: colors.marigold },
  mint: { bg: colors.mint, fg: colors.ink, border: colors.mint },
  coral: { bg: colors.tomato, fg: colors.ink, border: colors.tomato },
};

/** A boxed value inside mono prose (`₹4,860`). Only RichText places these. */
export function InlineChip({ kind, text, onPress }: { kind: ChipKind; text: string; onPress?: () => void }) {
  const look = INLINE[kind];
  const chip = (
    <View style={[styles.inline, { backgroundColor: look.bg, borderColor: look.border }]}>
      <RNText style={[styles.inlineText, { color: look.fg }, onPress && styles.link]}>{text}</RNText>
    </View>
  );
  if (!onPress) return chip;
  return (
    <PressableScale onPress={onPress} accessibilityRole="link" accessibilityLabel={text} hitSlop={8}>
      {chip}
    </PressableScale>
  );
}

const PROSE = { text: colors.text, card: extra.proseOnCard, muted: colors.muted, ink: colors.ink } as const;

/**
 * Mono prose with inline chips, from a template like `"Up {mint:+₹17,860} this month."`
 * (syntax in lib/richText.ts; wrap interpolated user text in `escapeRich`). `links` maps a
 * chip's `@name` to what tapping it does.
 */
export function RichText({
  children,
  tone = "text",
  links,
}: {
  children: string;
  /** Prose colour: `card` is the softer text inside a card, `ink` is for light surfaces. */
  tone?: keyof typeof PROSE;
  links?: Record<string, () => void>;
}) {
  const color = PROSE[tone];
  return (
    // Read as one sentence, unless it has links: those must stay focusable on their own.
    <View style={styles.rich} accessible={!links} accessibilityLabel={links ? undefined : children.replace(/\{\w+(?:@\w+)?:([^{}]+)\}/g, "$1")}>
      {parseRich(children).map((piece, i) =>
        piece.kind === "word" ? (
          <RNText key={i} style={[type.body, { color }]}>
            {piece.space ? `${piece.text} ` : piece.text}
          </RNText>
        ) : (
          <View key={i} style={styles.richChip}>
            <InlineChip kind={piece.kind} text={piece.text} onPress={piece.link ? links?.[piece.link] : undefined} />
            {piece.space && <RNText style={type.body}> </RNText>}
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  chipSmall: { paddingVertical: 2, paddingHorizontal: 8 },
  label: { ...type.chip },
  labelSmall: { fontSize: 10 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  knobPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 44,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
  },
  knobLabel: { flex: 1, fontFamily: fonts.monoBold, fontSize: 12.5, color: colors.ink },
  knob: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  toggle: { flexDirection: "row", borderRadius: radius.pill },
  toggleInline: { alignSelf: "flex-start" },
  toggleItem: { borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  toggleFill: { flex: 1 },
  toggleHug: { paddingHorizontal: 12 },
  inline: { borderRadius: radius.inlineChip, borderWidth: 1, paddingHorizontal: 6 },
  inlineText: { fontFamily: fonts.monoMedium, fontSize: 12, lineHeight: 17 },
  link: { textDecorationLine: "underline" },
  rich: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  richChip: { flexDirection: "row", alignItems: "center", height: type.body.lineHeight },
});
