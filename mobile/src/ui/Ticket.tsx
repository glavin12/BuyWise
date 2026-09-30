import { Check, type LucideIcon } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from "react-native-reanimated";

import type { Hue } from "./Chips";
import { PressableScale } from "./PressableScale";
import { colors, extra, fonts, motion, radius, type } from "./tokens";

// The Profile tickets (DESIGN.md §3 `Ticket`, values from design/reference-html/Settings.html): a tilted
// colour ticket, its title and a chip on the left, a dark stub on the right (an icon over a word, or a
// switch), and a notch in the screen colour at each end of the seam. On mount each one settles from
// rotate(0) to its tilt with a spring (§6.6); with reduce motion on they simply start tilted.

const STUB = 104;
const NOTCH = 18;

/** The column the tickets sit in: 22 above, 12 between and 30 below (the screen's own 12 gap adds to the ends). */
export function TicketStack({ children }: { children: ReactNode }) {
  return <View style={styles.stack}>{children}</View>;
}

export function Ticket({
  title,
  color,
  tilt,
  order = 0,
  chip,
  check,
  soft,
  stub,
  onPress,
  disabled,
  label,
}: {
  title: string;
  color: Hue;
  /** Degrees, as drawn: −5, 3, −3, 4. */
  tilt: number;
  /** Place in the stack: each one starts its settle `motion.stagger` after the one above. */
  order?: number;
  chip: string;
  /** A mint ✓ before the chip's words. */
  check?: boolean;
  /** A translucent chip in place of the ink one (the sky ticket). */
  soft?: boolean;
  /** The dark block: an icon over a word, or a switch (`on`) over "on" / "off". */
  stub: { icon: LucideIcon; label: string } | { on: boolean };
  onPress: () => void;
  disabled?: boolean;
  /** Screen-reader name: what the ticket says, as one line. */
  label: string;
}) {
  const reduceMotion = useReducedMotion();
  const angle = useSharedValue(reduceMotion ? tilt : 0);
  useEffect(() => {
    if (!reduceMotion) angle.set(withDelay(order * motion.stagger, withSpring(tilt, motion.spring)));
  }, [angle, order, reduceMotion, tilt]);
  const rotate = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));

  const isSwitch = "on" in stub;
  const Icon = "icon" in stub ? stub.icon : null;

  return (
    <Animated.View style={rotate}>
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={isSwitch ? "switch" : "button"}
        accessibilityLabel={label}
        accessibilityState={isSwitch ? { checked: stub.on, disabled } : { disabled }}
        style={[styles.ticket, { backgroundColor: colors[color] }, disabled && styles.inactive]}
      >
        <View style={styles.main}>
          <RNText style={styles.title} numberOfLines={1}>
            {title}
          </RNText>
          <View style={[styles.chip, { backgroundColor: soft ? extra.ticketChip : colors.ink }]}>
            {check ? <Check size={13} color={colors.mint} strokeWidth={2.4} /> : null}
            <RNText style={[styles.chipText, { color: soft ? colors.ink : colors.cream }]} numberOfLines={1}>
              {chip}
            </RNText>
          </View>
        </View>

        <View style={styles.stub}>
          <View style={styles.block}>
            {isSwitch ? (
              <View style={[styles.track, { backgroundColor: stub.on ? colors.mint : colors.line }]}>
                <View style={[styles.knob, { left: stub.on ? 25 : 3, backgroundColor: stub.on ? colors.ink : colors.muted }]} />
              </View>
            ) : Icon ? (
              <Icon size={28} color={colors.cream} strokeWidth={2} />
            ) : null}
            <RNText style={styles.word}>{isSwitch ? (stub.on ? "on" : "off") : stub.label}</RNText>
          </View>
        </View>

        <View style={[styles.notch, { top: -NOTCH / 2 }]} />
        <View style={[styles.notch, { bottom: -NOTCH / 2 }]} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: { marginTop: 22, marginBottom: 18, paddingHorizontal: 4, gap: 12 },
  ticket: { flexDirection: "row", height: 104, borderRadius: radius.card, boxShadow: `0 10px 14px ${extra.ticketShadow}` },
  inactive: { opacity: 0.5 },
  main: { flex: 1, minWidth: 0, justifyContent: "space-between", paddingTop: 16, paddingRight: 14, paddingBottom: 14, paddingLeft: 18 },
  title: { ...type.cardTitle, fontSize: 26, lineHeight: 25, color: colors.ink },
  chip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill },
  chipText: { ...type.chip, flexShrink: 1 },
  stub: { width: STUB, paddingVertical: 8, paddingRight: 8 },
  block: { flex: 1, borderRadius: 18, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", gap: 6 },
  word: { fontFamily: fonts.mono, fontSize: 10, color: colors.cream },
  track: { width: 50, height: 28, borderRadius: radius.pill },
  knob: { position: "absolute", top: 3, width: 22, height: 22, borderRadius: radius.pill },
  // Half outside the ticket, centred on the seam, in the screen colour: it reads as a bite out of the edge.
  notch: { position: "absolute", right: STUB - NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: radius.pill, backgroundColor: colors.screen, pointerEvents: "none" },
});
