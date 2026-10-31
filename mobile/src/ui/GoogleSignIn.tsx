import { StyleSheet, Text, View } from "react-native";

import { signInWithGoogle } from "@/lib/googleAuth";
import { SecondaryButton } from "./Buttons";
import { colors, fonts } from "./tokens";

export function GoogleSignIn({ onError }: { onError: (error: string | null) => void }) {
  return (
    <View style={styles.group}>
      <SecondaryButton label="Continue with Google" surface="dark" requiresNetwork onPress={async () => {
        onError(null);
        const result = await signInWithGoogle();
        onError(result.error);
      }} />
      <Text style={styles.divider}>or use your email</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 14, marginBottom: 4 },
  divider: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted, textAlign: "center" },
});
