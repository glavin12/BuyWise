import * as Haptics from "expo-haptics";

/** A short success tap after a save or delete. Never blocks or throws: haptics are a nicety. */
export function hapticSuccess() {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {
    // no haptics on this device or platform
  }
}
