import { AccessibilityInfo } from "react-native";

/**
 * Speaks `text` through VoiceOver / TalkBack. `accessibilityLiveRegion` is Android-only and `role="alert"` alone
 * does not make iOS speak a view that appears later, so toasts, banners and error notes announce explicitly.
 */
export const announce = (text: string) => AccessibilityInfo.announceForAccessibility(text);
