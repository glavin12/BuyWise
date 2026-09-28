import { StyleSheet, Text as RNText, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

import { colors, extra, fonts, type } from "./tokens";

// The Goals dial (DESIGN.md §3 `Dial`; geometry from design/reference-html/Goals.html, a 310 box):
// cream face, 120 ticks (every 10th longer and darker), a 30-wide tomato arc over its track,
// an ink inner ring and an ink knob with a marigold centre at the arc's end.

const C = 155;
const ARC_R = 105;
const CIRCUMFERENCE = 2 * Math.PI * ARC_R;
const point = (r: number, turn: number) => ({ x: C + r * Math.sin(turn * 2 * Math.PI), y: C - r * Math.cos(turn * 2 * Math.PI) });

const TICKS = Array.from({ length: 120 }, (_, i) => {
  const major = i % 10 === 0;
  const a = point(145, i / 120);
  const b = point(major ? 129 : 137, i / 120);
  return { a, b, major };
});

/** In the middle: the goal's name, the saved amount and a line under it ("of ₹80,000 · 67%"). */
export function Dial({ percent, title, amount, sub, label }: { percent: number; title: string; amount: string; sub: string; label: string }) {
  const size = 310;
  const p = Math.max(0, Math.min(100, percent)) / 100;
  const knob = point(ARC_R, p);
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} viewBox="0 0 310 310">
        <Circle cx={C} cy={C} r={152} fill={colors.cream} stroke={colors.ink} strokeWidth={3} />
        {TICKS.map(({ a, b, major }, i) => (
          <Line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={colors.ink}
            strokeWidth={major ? 2.2 : 1.1}
            strokeLinecap="round"
            opacity={major ? 1 : 0.55}
          />
        ))}
        <Circle cx={C} cy={C} r={ARC_R} fill="none" stroke={extra.track} strokeWidth={30} />
        <Circle
          cx={C}
          cy={C}
          r={ARC_R}
          fill="none"
          stroke={colors.tomato}
          strokeWidth={30}
          strokeDasharray={`${CIRCUMFERENCE * p} ${CIRCUMFERENCE}`}
          transform={`rotate(-90 ${C} ${C})`}
        />
        <Circle cx={C} cy={C} r={90} fill="none" stroke={colors.ink} strokeWidth={2.4} />
        <Circle cx={C} cy={C} r={120} fill="none" stroke={colors.ink} strokeWidth={1.4} opacity={0.35} />
        <Circle cx={knob.x} cy={knob.y} r={11} fill={colors.ink} />
        <Circle cx={knob.x} cy={knob.y} r={4} fill={colors.marigold} />
      </Svg>
      <View style={styles.centre}>
        <RNText style={styles.title} numberOfLines={1}>
          {title}
        </RNText>
        <RNText style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {amount}
        </RNText>
        <RNText style={styles.sub} numberOfLines={1} adjustsFontSizeToFit>
          {sub}
        </RNText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 72 },
  title: { ...type.label, color: colors.ink },
  amount: { fontFamily: fonts.numberBold, fontSize: 40, lineHeight: 41, color: colors.ink },
  sub: { ...type.meta, color: extra.mutedOnSage },
});
