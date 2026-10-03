import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Small yes/no "has seen it" flags kept on the device. SecureStore is the only on-device store installed (web:
// localStorage). Any failure reads as "not set", which only means a hint (or the AI consent sheet) shows again.

/** Every flag key, so a fresh install can clear them all (`freshInstall.ts`). */
export const FLAGS = {
  /** The first-run coach mark above the centre tab. */
  coach: "coach.centre-tab",
  /** The user agreed to BuyWise AI sending their messages and figures to the AI provider (per device, not per account). */
  aiConsent: "consent.ai.v1",
} as const;

export function readFlag(key: string): boolean {
  try {
    return (Platform.OS === "web" ? globalThis.localStorage?.getItem(key) : SecureStore.getItem(key)) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(key: string) {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, "1");
    else SecureStore.setItem(key, "1");
  } catch {
    // Not saved: the hint shows again next launch, which is harmless.
  }
}

/** Native only: used when a reinstall finds flags the Keychain kept from the previous install. */
export async function clearAllFlags() {
  await Promise.all(Object.values(FLAGS).map((key) => SecureStore.deleteItemAsync(key).catch(() => {})));
}
