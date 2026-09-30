import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { motion } from "./tokens";

// The motion the kit shares (DESIGN.md §6.4): a figure that counts up, and bars that draw on mount. The card
// entrance (§6.1) is Screen's `enter`. Under reduce motion (§6.8) none of it moves: the final state shows from
// the first frame. Only what is drawn moves, never the data: the last frame is always exactly the real value.

/**
 * When (a `Date.now()` time) the block this sits in starts to appear. `Screen enter` sets it, so a figure or a bar
 * that mounts with its block waits for the block to come in; anywhere else it is 0, which is "already here".
 */
export const AppearsAt = createContext(0);

/** A number to count up to, and the helper that writes it (`formatMinor`, `formatCurrency`, ...). */
export type Counted = { to: number; format: (n: number) => string };

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * `to`, counting up to it over 240 ms: from 0 the first time, from what is showing when it changes (fresh data).
 * Format the result with the usual helper; the last frame is exactly `to`.
 * ponytail: a JS frame loop that re-renders its component about 15 times, fine for one or two figures. Several
 * at once would want the text animated on the UI thread (a TextInput with `animatedProps`).
 */
export function useCountUp(to: number): number {
  const reduce = useReducedMotion();
  const appears = useContext(AppearsAt);
  const [shown, setShown] = useState(0);
  const last = useRef(0); // what was drawn last: where the next count starts

  useEffect(() => {
    if (reduce || last.current === to) return;
    const from = last.current;
    const start = Math.max(Date.now(), appears);
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / motion.dur.base));
      last.current = t === 1 ? to : from + (to - from) * easeOut(t);
      setShown(last.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, reduce, appears]);

  return reduce ? to : shown;
}

const DRAW = { duration: motion.dur.enter, easing: Easing.out(Easing.cubic) };

/** 0 → `to` on mount, once its block has started to appear, and from where it is to any later `to`. Just `to` under reduce motion. */
export function useDraw(to: number) {
  const reduce = useReducedMotion();
  const appears = useContext(AppearsAt);
  const drawn = useSharedValue(reduce ? to : 0);
  useEffect(() => {
    drawn.set(reduce ? to : withDelay(Math.max(0, appears - Date.now()), withTiming(to, DRAW)));
  }, [drawn, to, reduce, appears]);
  return drawn;
}

/**
 * A bar's fill: `percent` of its track's width, drawn from 0. Children ride on the fill (they can hang off its end at `left: "100%"`).
 * ponytail: it animates `width`, a layout prop, so each frame lays the bar out again: fine for the few bars on a
 * screen. A long list of bars would want a transform (`scaleX`) instead.
 */
export function DrawnFill({ percent, style, children }: { percent: number; style: StyleProp<ViewStyle>; children?: ReactNode }) {
  const drawn = useDraw(Math.max(0, Math.min(100, percent)));
  const width = useAnimatedStyle(() => ({ width: `${drawn.get()}%` }));
  return <Animated.View style={[style, width]}>{children}</Animated.View>;
}
