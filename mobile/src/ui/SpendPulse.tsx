import { useState } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Pattern, Rect, Stop } from "react-native-svg";

import { colors, extra, fonts } from "./tokens";

// The Spend Pulse card's two drawings (DESIGN.md §3 `PulseBubbles`, `AreaChart`), hand-drawn with
// react-native-svg; values and sizes from design/reference-html/Dashboard.html. Both lay the week
// out in 7 equal columns so each bubble sits over its point on the chart.

const FUTURE = "rgba(255,255,255,0.55)";
const HEX = "rgba(255,255,255,0.28)";

export type PulseDay = {
  label: string;
  /** null = a day that hasn't happened yet (dashed, empty). */
  percent: number | null;
  today: boolean;
};

const OVER = 100; // past this a bubble says "100+" in tomato; the exact % stays in the screen-reader label

/** 7 × 34px day bubbles: past peri2, today cream, future dashed; over budget tomato (today: a tomato ring). */
export function PulseBubbles({ days, of }: { days: PulseDay[]; of: "budget" | "peak" }) {
  const unit = of === "budget" ? "of the daily budget" : "of the week's biggest day";
  return (
    <View style={styles.row}>
      {days.map((d) => {
        const over = d.percent !== null && d.percent > OVER;
        return (
          <View
            key={d.label}
            style={styles.col}
            accessible
            accessibilityLabel={d.percent === null ? `${d.label}: still to come` : `${d.label}${d.today ? ", today" : ""}: ${d.percent}% ${unit}`}
          >
            <RNText style={[styles.day, d.today && styles.dayToday]}>{d.label}</RNText>
            <View
              style={[
                styles.bubble,
                d.today ? styles.bubbleToday : d.percent === null ? styles.bubbleFuture : styles.bubblePast,
                over && (d.today ? styles.ringOver : styles.bubbleOver),
              ]}
            >
              {d.percent !== null && <RNText style={[styles.pct, (d.today || over) && styles.pctToday]}>{over ? `${OVER}+` : `${d.percent}%`}</RNText>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const HEIGHT = 96;
const TOP = 30; // the peak sits below the tooltip
const BASE = HEIGHT - 8; // the line's floor: a no-spend day's dot (r 5.5 + stroke) stays inside the SVG
const TIP_W = 124;

/**
 * Daily spend as a tomato area with an ink line up to `upto` (today, or Sunday for a past week),
 * the days after it a hex-patterned "not yet" zone, and a dotted marker + ink tooltip on `focus`.
 */
export function AreaChart({ values, upto, focus, tooltip, label }: { values: number[]; upto: number; focus: number; tooltip: string; label: string }) {
  const [width, setWidth] = useState(0);
  const col = width / values.length;
  const max = Math.max(1, ...values.slice(0, upto + 1));
  const x = (i: number) => col * (i + 0.5);
  const y = (i: number) => BASE - (values[i] / max) * (BASE - TOP);

  const known = values.slice(0, upto + 1).map((_, i) => `L${x(i)} ${y(i)}`);
  const end = upto === values.length - 1 ? width : x(upto);
  const line = `M0 ${y(0)} ${known.join(" ")}${end === width ? ` L${width} ${y(upto)}` : ""}`;
  const tipLeft = Math.min(Math.max(x(focus) - TIP_W / 2, 0), Math.max(width - TIP_W, 0));
  // The tooltip, the marker and the "not yet" zone start above the line's highest point, so a
  // week with no spend (everything on BASE) gets them next to the line, not floating over nothing.
  const peak = Math.min(...values.slice(0, upto + 1).map((_, i) => y(i)));
  const tipTop = peak - TOP;
  const zoneTop = peak - 8;

  return (
    <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={label}>
      {width > 0 && (
        <>
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <Pattern id="hex" width={14} height={24} patternUnits="userSpaceOnUse">
                <Path d="M7 0l7 4v8l-7 4-7-4V4z M7 16v8" fill="none" stroke={HEX} strokeWidth={1} />
              </Pattern>
              <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.peri} stopOpacity={1} />
                <Stop offset="1" stopColor={colors.peri} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {end < width && (
              <>
                <Rect x={end} y={zoneTop} width={width - end} height={HEIGHT - zoneTop} fill="url(#hex)" />
                <Rect x={end} y={zoneTop} width={width - end} height={HEIGHT - zoneTop} fill="url(#fade)" />
              </>
            )}
            <Path d={`${line} L${end} ${HEIGHT} L0 ${HEIGHT} Z`} fill={colors.tomato} />
            <Path d={line} fill="none" stroke={colors.ink} strokeWidth={2.6} strokeLinejoin="round" />
            <Line x1={x(focus)} y1={zoneTop} x2={x(focus)} y2={HEIGHT} stroke={colors.ink} strokeWidth={1.6} strokeDasharray="2 3" />
            {values.slice(0, upto + 1).map((_, i) => (
              <Circle key={i} cx={x(i)} cy={y(i)} r={i === focus ? 5.5 : 4} fill={colors.cream} stroke={colors.ink} strokeWidth={2.2} />
            ))}
          </Svg>
          <View style={[styles.tipWrap, { left: tipLeft, top: tipTop }]} pointerEvents="none">
            <RNText style={styles.tip} numberOfLines={1}>
              {tooltip}
            </RNText>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  col: { flex: 1, alignItems: "center", gap: 6 },
  day: { fontFamily: fonts.mono, fontSize: 10, color: extra.labelOnPeri },
  dayToday: { fontFamily: fonts.monoBold, color: extra.whiteOnPeri },
  bubble: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  bubblePast: { backgroundColor: colors.peri2 },
  bubbleToday: { backgroundColor: colors.cream },
  bubbleFuture: { borderWidth: 1.5, borderStyle: "dashed", borderColor: FUTURE },
  bubbleOver: { backgroundColor: colors.tomato },
  ringOver: { borderWidth: 2.5, borderColor: colors.tomato },
  pct: { fontFamily: fonts.mono, fontSize: 10, color: extra.whiteOnPeri },
  pctToday: { fontFamily: fonts.monoBold, color: colors.ink },
  chart: { height: HEIGHT, marginTop: 8 },
  tipWrap: { position: "absolute", top: 0, width: TIP_W, alignItems: "center" },
  tip: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.cream,
    backgroundColor: colors.ink,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
});
