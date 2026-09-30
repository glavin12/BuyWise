import { LogOut } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text as RNText } from "react-native";

import { useGuardedPress } from "./Buttons";
import { PressableScale } from "./PressableScale";
import { colors, fonts, radius } from "./tokens";

/**
 * The Profile tab's "Sign out" (design/reference-html/Settings.html): an outlined charcoal pill with a
 * tomato log-out glyph and label. Busy until `onPress` settles, so a second tap cannot run it twice.
 */
export function SignOutButton({ onPress }: { onPress: () => void | Promise<unknown> }) {
  const { handlePress, inactive, busy } = useGuardedPress(onPress, {});
  return (
    <PressableScale
      onPress={handlePress}
      disabled={inactive}
      accessibilityLabel="Sign out"
      accessibilityState={{ disabled: inactive, busy }}
      style={styles.button}
    >
      {busy ? (
        <ActivityIndicator color={colors.tomato} />
      ) : (
        <>
          <LogOut size={18} color={colors.tomato} strokeWidth={2.2} />
          <RNText style={styles.label}>Sign out</RNText>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    borderWidth: 1.6,
    borderColor: colors.line,
  },
  label: { fontFamily: fonts.monoBold, fontSize: 12.5, color: colors.tomato },
});
