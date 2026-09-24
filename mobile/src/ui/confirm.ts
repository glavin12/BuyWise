import { Alert, Platform } from "react-native";

/**
 * Yes/no confirmation dialog. Resolves true only if the user confirms.
 * Alert.alert is a no-op on web, so the browser's own confirm() is used there.
 */
export function confirm(
  title: string,
  message: string,
  confirmLabel: string,
  destructive = false
): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
