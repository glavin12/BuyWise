import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { Button } from "./Button";
import { Screen, goBack } from "./Screen";
import { Text } from "./Text";
import { theme } from "./theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** Nothing here yet (D1): say so and, where useful, offer the first action. */
export function EmptyState({
  title,
  message,
  icon = "file-tray-outline",
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={40} color={theme.color.textMuted} />
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text tone="muted" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

/** A load failed and there is nothing cached to show: explain and offer a retry (C8). */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry: () => void | Promise<unknown>;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={40} color={theme.color.textMuted} />
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text tone="muted" align="center">
        {message}
      </Text>
      <Button title="Try again" onPress={onRetry} />
    </View>
  );
}

/** A whole screen for a link that points at nothing: a malformed id, or a row deleted elsewhere. */
export function NotFoundScreen({ title, what }: { title: string; what: string }) {
  return (
    <Screen title={title} back>
      <EmptyState
        icon="alert-circle-outline"
        title={`${what} not found`}
        message="It may have been deleted."
        actionLabel="Go back"
        onAction={goBack}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space.md,
    paddingVertical: theme.space.xl,
  },
});
