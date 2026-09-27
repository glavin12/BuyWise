import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { userMessage } from "@/lib/api";
import { useUpdateProfile } from "@/lib/mutations";
import { useOnline } from "@/lib/network";
import { profileQuery } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { Button, Card, confirm, Screen, SettingsRow, showToast, Stack, Text } from "@/ui";

// Phase 5; the Profile tab since design v3 (was the Settings stack screen). Profile, Categories, Payees and the Budget alerts switch are wired
// to the backend; everything else here has no backend field yet and shows a
// "Coming soon" toast, matching the web (frontend/lib/coming-soon.ts).
export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const profile = useQuery(profileQuery);
  const updateProfile = useUpdateProfile();
  const online = useOnline();

  const onSignOut = async () => {
    const yes = await confirm("Sign out?", "You'll need to log in again to see your data.", "Sign out", true);
    if (yes) await signOut(); // the route guard then returns to the login screen
  };

  /** R3: the Switch flips at once (useUpdateProfile is optimistic) and settles on the server's answer either way. */
  const toggleBudgetAlerts = async (next: boolean) => {
    try {
      await updateProfile.mutateAsync({ budget_alerts: next });
    } catch (err) {
      showToast(userMessage(err, "save that setting"));
    }
  };

  const soon = (feature: string) => () => showToast(`${feature} — coming soon`);
  // C1: writes are off offline, like every `requiresNetwork` button.
  const alertsDisabled = !profile.data || updateProfile.isPending || !online;

  return (
    <Screen title="Profile" tabBar>
      <Stack gap="xs">
        <Text variant="caption" tone="muted">
          Email
        </Text>
        <Text>{session?.user.email ?? "—"}</Text>
      </Stack>

      <Card>
        <SettingsRow label="Profile" value={profile.data?.full_name || undefined} onPress={() => router.push("/settings/profile")} />
        <SettingsRow label="Categories" onPress={() => router.push("/settings/categories")} />
        <SettingsRow label="Payees" onPress={() => router.push("/settings/payees")} />
      </Card>

      <Stack gap="sm">
        <Text variant="caption" tone="muted">
          Notifications
        </Text>
        <Card>
          <SettingsRow
            label="Budget alerts"
            switchValue={profile.data?.budget_alerts ?? false}
            onSwitchChange={toggleBudgetAlerts}
            disabled={alertsDisabled}
          />
          <SettingsRow label="Weekly recap" switchValue={false} onSwitchChange={soon("Weekly recap")} />
          <SettingsRow label="Unusual transaction alerts" switchValue={false} onSwitchChange={soon("Unusual transaction alerts")} />
          <SettingsRow label="Goal milestone alerts" switchValue={false} onSwitchChange={soon("Goal milestone alerts")} />
        </Card>
      </Stack>

      <Stack gap="sm">
        <Text variant="caption" tone="muted">
          AI assistant
        </Text>
        <Card>
          <SettingsRow label="Auto-categorize" switchValue={false} onSwitchChange={soon("Auto-categorize")} />
          <SettingsRow label="Envelope suggestions" switchValue={false} onSwitchChange={soon("Envelope suggestions")} />
          <SettingsRow label="Chat-added transactions" switchValue={false} onSwitchChange={soon("Chat-added transactions")} />
          <SettingsRow label="Chat envelope transfers" switchValue={false} onSwitchChange={soon("Chat envelope transfers")} />
        </Card>
      </Stack>

      <Stack gap="sm">
        <Text variant="caption" tone="muted">
          Data & security
        </Text>
        <Card>
          <SettingsRow label="Two-factor authentication" onPress={soon("Two-factor authentication")} />
          <SettingsRow label="Active sessions" onPress={soon("Active sessions")} />
          <SettingsRow label="Export ledger CSV" onPress={soon("Export ledger CSV")} />
          <SettingsRow label="Delete account" onPress={soon("Delete account")} />
        </Card>
      </Stack>

      <Stack gap="sm">
        <Text variant="caption" tone="muted">
          Billing
        </Text>
        <Card>
          <SettingsRow label="Manage billing" onPress={soon("Billing")} />
        </Card>
      </Stack>

      {__DEV__ && (
        <Card>
          <SettingsRow label="Design kit (dev only)" onPress={() => router.push("/kit")} />
        </Card>
      )}

      <Button title="Sign out" variant="danger" onPress={onSignOut} />
    </Screen>
  );
}
