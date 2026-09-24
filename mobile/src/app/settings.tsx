import { useQuery } from "@tanstack/react-query";

import { profileQuery } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { Button, Card, confirm, Screen, Stack, Text } from "@/ui";

// Phase 1: identity plus Sign out. Profile editing, categories, payees and
// alerts arrive in Phase 5.
export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const profile = useQuery(profileQuery);

  const onSignOut = async () => {
    const yes = await confirm("Sign out?", "You'll need to log in again to see your data.", "Sign out", true);
    if (yes) await signOut(); // the route guard then returns to the login screen
  };

  return (
    <Screen title="Settings" back>
      <Card>
        <Stack gap="xs">
          <Text variant="caption" tone="muted">
            Email
          </Text>
          <Text>{session?.user.email ?? "—"}</Text>
        </Stack>
        <Stack gap="xs">
          <Text variant="caption" tone="muted">
            Name
          </Text>
          <Text>{profile.data?.full_name || "Not set"}</Text>
        </Stack>
      </Card>

      <Button title="Sign out" variant="danger" onPress={onSignOut} />
    </Screen>
  );
}
