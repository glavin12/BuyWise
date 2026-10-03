import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Globe, LayoutGrid, Pencil, User } from "lucide-react-native";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { useDeleteAccount, useUpdateProfile } from "@/lib/mutations";
import { useOnline } from "@/lib/network";
import { categoriesQuery, payeesQuery, profileQuery } from "@/lib/queries";
import { displayName, regionLabel, sinceLabel } from "@/lib/settings";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import { useAuth } from "@/providers/AuthProvider";
import {
  Banner,
  CircleButton,
  confirm,
  ErrorState,
  Illustration,
  LegalLinks,
  Note,
  Panel,
  Row,
  Screen,
  SectionLabel,
  SecondaryButton,
  showToast,
  SignOutButton,
  Skeleton,
  Stack,
  Ticket,
  TicketStack,
  Title,
} from "@/ui";

// Profile (design/screens/09-profile.png, values from design/reference-html/Settings.html): the profile card,
// four tilted tickets (Categories, Payees, Budget alerts, Region) and Sign out. Each ticket opens its list
// or form; the alerts ticket is the switch itself. The web's "coming soon" rows are gone: the backend has
// nothing behind them.

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const profile = useQuery(profileQuery);
  // The two chips that count things: every active category and every payee, expense and income together.
  const expenseCategories = useQuery(categoriesQuery("expense"));
  const incomeCategories = useQuery(categoriesQuery("income"));
  const expensePayees = useQuery(payeesQuery("expense"));
  const incomePayees = useQuery(payeesQuery("income"));
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();
  const online = useOnline();
  const [refreshing, setRefreshing] = useState(false);
  useRefetchStaleOnFocus();

  const data = profile.data;
  const categoryCount =
    expenseCategories.data && incomeCategories.data
      ? [...expenseCategories.data.categories, ...incomeCategories.data.categories].filter((c) => c.is_active).length
      : null;
  const payeeCount = expensePayees.data && incomePayees.data ? expensePayees.data.payees.length + incomePayees.data.payees.length : null;
  const active = categoryCount === null ? null : `${categoryCount} active`;
  const saved = payeeCount === null ? null : `${payeeCount} saved`;

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await Promise.all([profile.refetch(), expenseCategories.refetch(), incomeCategories.refetch(), expensePayees.refetch(), incomePayees.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const onSignOut = async () => {
    const yes = await confirm("Sign out?", "You'll need to log in again to see your data.", "Sign out", true);
    if (yes) await signOut(); // the route guard then returns to the login screen
  };

  /**
   * Two confirms, then the server deletes the data and the login; signing out afterwards returns to the login
   * screen (SIGNED_OUT clears the cache). Needs the network, and a failure leaves the user signed in to retry.
   */
  const onDeleteAccount = async () => {
    const sure = await confirm(
      "Delete your account?",
      "This permanently deletes your transactions, budgets, goals and chats. It can't be undone.",
      "Delete",
      true,
    );
    if (!sure) return;
    const certain = await confirm("Are you sure?", "Your account and everything in it will be gone for good.", "Delete my account", true);
    if (!certain) return;
    try {
      await deleteAccount.mutateAsync();
    } catch (err) {
      showToast(userMessage(err, "delete your account"));
      return;
    }
    await signOut();
  };

  /** R3: the switch flips at once (useUpdateProfile is optimistic) and settles on the server's answer either way. */
  const toggleBudgetAlerts = async () => {
    try {
      await updateProfile.mutateAsync({ budget_alerts: !data?.budget_alerts });
    } catch (err) {
      showToast(userMessage(err, "save that setting"));
    }
  };

  return (
    <Screen surface="screen" tabBar onRefresh={refresh} refreshing={refreshing}>
      <Title>Profile</Title>

      {/* C8: a background refresh failed but the profile is cached, so keep showing it. */}
      {data && profile.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known profile." /> : null}

      {data ? (
        <>
          <Panel>
            <Row>
              <Illustration name="avatar_user" width={56} />
              <Stack grow gap="xs">
                <Title size="panelTitle">{displayName(data.full_name, session?.user.email) || "You"}</Title>
                <Note>{[session?.user.email, sinceLabel(data.created_at)].filter(Boolean).join(" · ")}</Note>
              </Stack>
              <CircleButton icon={Pencil} size={38} label="Edit profile" onPress={() => router.push("/settings/profile")} />
            </Row>
          </Panel>

          <TicketStack>
            <Ticket
              title="Categories"
              color="tomato"
              tilt={-5}
              order={0}
              chip={active ?? "…"}
              stub={{ icon: LayoutGrid, label: "edit" }}
              onPress={() => router.push("/settings/categories")}
              label={["Categories", active, "edit"].filter(Boolean).join(", ")}
            />
            <Ticket
              title="Payees"
              color="marigold"
              tilt={3}
              order={1}
              chip={saved ?? "…"}
              check={saved !== null}
              stub={{ icon: User, label: "search" }}
              onPress={() => router.push("/settings/payees")}
              label={["Payees", saved, "search"].filter(Boolean).join(", ")}
            />
            {/* Only the on / off preference is stored and nothing sends alerts yet, so the chip does not promise a rule. C1: writes are off offline. */}
            <Ticket
              title="Budget alerts"
              color="sky"
              tilt={-3}
              order={2}
              chip="alerts arrive soon"
              soft
              stub={{ on: data.budget_alerts }}
              onPress={toggleBudgetAlerts}
              disabled={updateProfile.isPending || !online}
              label="Budget alerts, alerts arrive soon"
            />
            <Ticket
              title="Region"
              color="mint"
              tilt={4}
              order={3}
              chip={regionLabel(data.currency, data.timezone)}
              stub={{ icon: Globe, label: "change" }}
              onPress={() => router.push("/settings/profile")}
              label={`Region, ${regionLabel(data.currency, data.timezone)}, change`}
            />
          </TicketStack>
        </>
      ) : profile.isError ? (
        <ErrorState message={userMessage(profile.error, "load your profile")} onRetry={() => profile.refetch()} />
      ) : (
        <>
          <Skeleton tone="dark" height={84} round="card" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} tone="dark" height={104} round="card" />
          ))}
        </>
      )}

      <SignOutButton onPress={onSignOut} />
      <SecondaryButton label="Delete account" surface="dark" danger requiresNetwork onPress={onDeleteAccount} />
      <LegalLinks />

      {__DEV__ ? <SectionLabel label="Dev only" link="Design kit" onLink={() => router.push("/kit")} /> : null}
    </Screen>
  );
}
