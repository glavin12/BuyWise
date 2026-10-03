import { Fragment } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";

import { openLegal, PRIVACY_URL, TERMS_URL } from "@/lib/legal";

import { PressableScale } from "./PressableScale";
import { showToast } from "./toast";
import { colors, extra, fonts } from "./tokens";

const LINKS = [
  { label: "Privacy policy", url: PRIVACY_URL },
  { label: "Terms", url: TERMS_URL },
].filter((link): link is { label: string; url: string } => link.url !== null);

/** "Privacy policy · Terms" in small mono text. Draws nothing until the owner has set the URLs (`lib/legal`). */
export function LegalLinks({ surface = "dark" }: { surface?: "dark" | "cream" }) {
  if (LINKS.length === 0) return null;
  const color = surface === "cream" ? extra.mutedOnCream : colors.muted;
  return (
    <View style={styles.row}>
      {LINKS.map((link, i) => (
        <Fragment key={link.label}>
          {i > 0 ? <RNText style={[styles.text, { color }]}>·</RNText> : null}
          <PressableScale
            onPress={async () => {
              if (!(await openLegal(link.url))) showToast("Couldn't open that page. Try again later.");
            }}
            accessibilityRole="link"
            accessibilityLabel={link.label}
            hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
          >
            <RNText style={[styles.text, styles.link, { color }]}>{link.label}</RNText>
          </PressableScale>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 },
  text: { fontFamily: fonts.mono, fontSize: 11 },
  link: { textDecorationLine: "underline" },
});
