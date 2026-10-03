import { Linking } from "react-native";

// The privacy policy and terms pages. The owner hosts them and sets these in .env.local; a link that is not set (or
// not an http(s) URL) is simply not shown. Expo inlines `process.env.EXPO_PUBLIC_*` only when it is written out in full.
const url = (value: string | undefined) => (value && /^https?:\/\//i.test(value.trim()) ? value.trim() : null);

export const PRIVACY_URL = url(process.env.EXPO_PUBLIC_PRIVACY_URL);
export const TERMS_URL = url(process.env.EXPO_PUBLIC_TERMS_URL);

/** Opens the page in the phone's browser; false when it could not (the caller says so). */
export async function openLegal(link: string): Promise<boolean> {
  try {
    await Linking.openURL(link);
    return true;
  } catch {
    return false;
  }
}
