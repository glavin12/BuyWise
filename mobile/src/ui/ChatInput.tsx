import { ArrowUp, Plus } from "lucide-react-native";
import type { Ref } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useOnline } from "@/lib/network";

import { PressableScale } from "./PressableScale";
import { showToast } from "./toast";
import { colors, fonts, radius } from "./tokens";

// The composer (design/reference-html/Chat.html): a + circle that starts a new chat, and a pill
// holding the input. The pill's right end is the voice glyph (a "coming soon" toast) until
// something is typed, then Send.

const MAX_LENGTH = 4000; // the server's cap per message
const MAX_LINES = 4;
const HEIGHT = 48;
const LINE = 17;
const PAD = 15; // 15 + 17 + 15 fills the design's 48 for one line

/** Multiline composer. Send is disabled while `busy` (a reply is on its way) and offline. */
export function ChatInput({
  value,
  onChangeText,
  onSend,
  onNew,
  busy,
  inputRef,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  /** The + beside the input: start a new chat. */
  onNew: () => void;
  busy: boolean;
  /** Forwarded to the TextInput so a caller (e.g. a prefill chip) can focus it. */
  inputRef?: Ref<TextInput>;
}) {
  const online = useOnline();
  const empty = value.trim() === "";
  const inactive = !online || busy;

  return (
    <View style={styles.row}>
      <PressableScale onPress={onNew} accessibilityLabel="New chat" style={styles.plus}>
        <Plus size={22} color={colors.text} strokeWidth={2.3} />
      </PressableScale>
      <View style={styles.pill}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={MAX_LENGTH}
          placeholder={online ? "Ask something to start" : "You're offline"}
          placeholderTextColor={colors.muted}
          selectionColor={colors.tomato}
          cursorColor={colors.text}
          accessibilityLabel="Message"
        />
        {empty ? (
          <PressableScale onPress={() => showToast("Voice input — coming soon")} accessibilityLabel="Voice input" style={styles.end}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" stroke={colors.text} strokeWidth={2.1} strokeLinecap="round" />
            </Svg>
          </PressableScale>
        ) : (
          <PressableScale
            onPress={onSend}
            disabled={inactive}
            accessibilityLabel="Send"
            accessibilityState={{ disabled: inactive, busy }}
            style={styles.end}
          >
            <View style={[styles.send, inactive && styles.inactive]}>
              <ArrowUp size={18} color={colors.ink} strokeWidth={2.6} />
            </View>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  plus: {
    width: HEIGHT,
    height: HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  // Radius 24: a full pill at one line, a soft rectangle once the input grows.
  pill: { flex: 1, flexDirection: "row", alignItems: "flex-end", borderRadius: radius.card, backgroundColor: colors.card },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: HEIGHT,
    maxHeight: MAX_LINES * LINE + 2 * PAD,
    paddingLeft: 16,
    paddingVertical: PAD,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: LINE,
    color: colors.text,
  },
  end: { width: HEIGHT, height: HEIGHT, alignItems: "center", justifyContent: "center" },
  send: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.tomato,
    alignItems: "center",
    justifyContent: "center",
  },
  inactive: { opacity: 0.4 },
});
