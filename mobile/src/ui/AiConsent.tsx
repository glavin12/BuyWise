import { StyleSheet, Text as RNText } from "react-native";

import { PrimaryButton, SecondaryButton } from "./Buttons";
import { LegalLinks } from "./LegalLinks";
import { Sheet } from "./OptionSheet";
import { colors, fonts } from "./tokens";

/**
 * Shown before the first chat message is sent: BuyWise AI sends the message, and what it looks up to answer, to a
 * third-party AI provider, so the user agrees first (stores expect this). The provider is the one `ai_service` uses
 * (Groq, `langchain-groq`) and the data is what its prompt and tools carry (`ai_service/context`, `ai_service/tools`):
 * change this wording when either changes.
 */
export function AiConsent({ visible, onAgree, onDecline }: { visible: boolean; onAgree: () => void; onDecline: () => void }) {
  return (
    <Sheet visible={visible} title="Before you chat" onClose={onDecline}>
      <RNText style={styles.body}>
        BuyWise AI answers by sending your message to a third-party AI provider, Groq, which writes the reply. Along with
        it goes what the AI needs to answer: your name, currency and time zone, any income details you saved, and the
        balances, transactions, budgets and goals it looks up. Nothing is sent until you agree.
      </RNText>
      <LegalLinks surface="cream" />
      <PrimaryButton label="I agree" onPress={onAgree} />
      <SecondaryButton label="Not now" onPress={onDecline} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.mono, fontSize: 12.5, lineHeight: 20, color: colors.ink },
});
