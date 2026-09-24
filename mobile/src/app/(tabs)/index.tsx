import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { dashboardQuery, profileQuery, recentTransactionsQuery, type DashboardPeriod } from "@/lib/queries";
import type { DashboardData } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import { useAuth } from "@/providers/AuthProvider";
import {
  Amount,
  Avatar,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Row,
  Screen,
  Segmented,
  Skeleton,
  Stack,
  Text,
  TransactionRow,
} from "@/ui";

type Period = DashboardPeriod;

const PERIODS = [
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
] as const;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The one-line budget summary (D11: shown even with no budget, as a prompt). */
function budgetLine(d: DashboardData): { text: string; tone: "default" | "negative" | "accent" } {
  if (!d.has_budget) return { text: "No budget yet — set one up →", tone: "accent" };
  if (d.unassigned > 0) {
    return { text: `${formatCurrency(d.display_unassigned, d.currency)} ready to assign`, tone: "default" };
  }
  if (d.remaining_budget < 0) {
    return { text: `${formatCurrency(Math.abs(d.display_remaining_budget), d.currency)} over budget`, tone: "negative" };
  }
  return { text: `${formatCurrency(d.display_remaining_budget, d.currency)} left`, tone: "default" };
}

function DashboardSkeleton() {
  return (
    <>
      <Card>
        <Skeleton width="40%" height={12} />
        <Skeleton width="70%" height={40} />
      </Card>
      <Row align="stretch">
        {[0, 1, 2].map((i) => (
          <Card key={i} grow>
            <Skeleton width="60%" height={12} />
            <Skeleton height={20} />
          </Card>
        ))}
      </Row>
      <Card>
        <Skeleton width="60%" height={16} />
      </Card>
      <Card>
        <Skeleton width="30%" height={16} />
        <Skeleton height={36} />
        <Skeleton height={36} />
        <Skeleton height={36} />
      </Card>
    </>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [period, setPeriod] = useState<Period>("this_month");
  const [refreshing, setRefreshing] = useState(false);

  const dashboard = useQuery(dashboardQuery(period));
  const recent = useQuery(recentTransactionsQuery);
  const profile = useQuery(profileQuery);
  useRefetchStaleOnFocus();

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await Promise.all([dashboard.refetch(), recent.refetch(), profile.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const data = dashboard.data;

  // C8: the API is down and there is nothing cached to show.
  if (!data && dashboard.isError) {
    return (
      <Screen insetBottom={false}>
        <ErrorState
          title="BuyWise is temporarily unavailable"
          message={userMessage(dashboard.error, "load your dashboard")}
          onRetry={() => dashboard.refetch()}
        />
      </Screen>
    );
  }

  const name = profile.data?.full_name || session?.user.email?.split("@")[0] || "";
  const budget = data ? budgetLine(data) : null;
  const goalCount = data?.active_goals_count ?? 0;

  return (
    <Screen insetBottom={false} onRefresh={refresh} refreshing={refreshing}>
      <Row justify="between">
        <Stack gap="xs" grow>
          <Text variant="caption" tone="muted">
            {greeting()}
          </Text>
          <Text variant="title" numberOfLines={1}>
            {name || "Welcome"}
          </Text>
        </Stack>
        <Avatar label={name} onPress={() => router.push("/settings")} />
      </Row>

      <Segmented options={PERIODS} value={period} onChange={setPeriod} />

      {/* C8: a background refresh failed but cached numbers exist, so keep showing them. */}
      {data && dashboard.isError ? (
        <Banner tone="warning" message="Couldn't refresh. Showing your last known numbers." />
      ) : null}

      {!data || !budget ? (
        <DashboardSkeleton />
      ) : (
        <>
          <Card>
            <Text variant="caption" tone="muted">
              Total balance
            </Text>
            <Amount variant="display" value={data.display_current_balance} currency={data.currency} />
          </Card>

          <Row align="stretch">
            <Card grow>
              <Text variant="caption" tone="muted">
                Income
              </Text>
              <Amount variant="heading" value={data.display_total_income} currency={data.currency} />
            </Card>
            <Card grow>
              <Text variant="caption" tone="muted">
                Spent
              </Text>
              <Amount variant="heading" value={data.display_total_spent} currency={data.currency} />
            </Card>
            <Card grow>
              <Text variant="caption" tone="muted">
                Net
              </Text>
              {/* D9: a negative net renders red with a minus sign. */}
              <Amount variant="heading" value={data.display_net} currency={data.currency} signed />
            </Card>
          </Row>

          <Card onPress={() => router.push("/budget")}>
            <Text tone={budget.tone}>{budget.text}</Text>
          </Card>
        </>
      )}

      <Card>
        <Row justify="between">
          <Text variant="heading">Recent</Text>
          <Button title="See all →" variant="link" onPress={() => router.push("/transactions")} />
        </Row>
        {recent.data ? (
          recent.data.transactions.length > 0 ? (
            recent.data.transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                fallbackCurrency={data?.currency ?? "INR"}
                onPress={(id) => router.push(`/transaction/${id}`)}
              />
            ))
          ) : (
            // D1: brand-new user with no transactions.
            <EmptyState
              icon="receipt-outline"
              title="No transactions yet"
              message="Add your first one to see it here."
              actionLabel="Add transaction"
              onAction={() => router.push("/add-transaction")}
            />
          )
        ) : recent.isError ? (
          <Stack gap="xs">
            <Text tone="muted">{"Couldn't load recent transactions."}</Text>
            <Button title="Try again" variant="link" onPress={() => recent.refetch()} />
          </Stack>
        ) : (
          <Stack>
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        )}
      </Card>

      {data ? (
        <Button
          title={goalCount > 0 ? `${goalCount} active goal${goalCount === 1 ? "" : "s"} →` : "No goals yet — add one →"}
          variant="link"
          onPress={() => router.push("/goals")}
        />
      ) : null}
      <Button title="View reports →" variant="link" onPress={() => router.push("/reports")} />
    </Screen>
  );
}
