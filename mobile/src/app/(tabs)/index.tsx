import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { budgetProgress, budgetStatusText, closestToLimit } from "@/lib/budget";
import { currentMonth, monthShift } from "@/lib/dates";
import { formatCurrency, formatMinor } from "@/lib/format";
import { percentOf } from "@/lib/goals";
import { dashboardQuery, goalsQuery, monthBudgetsQuery, profileQuery, recentTransactionsQuery, type DashboardPeriod } from "@/lib/queries";
import type { DashboardData } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import { useAuth } from "@/providers/AuthProvider";
import {
  Amount,
  Avatar,
  Banner,
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  ErrorState,
  ProgressBar,
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
  // "Closest to limit" tracks whichever month the balance card is showing.
  const now = currentMonth();
  const budgetMonth = period === "this_month" ? now : monthShift(now.month, now.year, -1);
  const budgets = useQuery(monthBudgetsQuery(budgetMonth));
  const goals = useQuery(goalsQuery("active"));
  useRefetchStaleOnFocus();

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await Promise.all([dashboard.refetch(), recent.refetch(), profile.refetch(), budgets.refetch(), goals.refetch()]);
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
  const currency = data?.currency ?? "INR";
  const closest = budgets.data ? closestToLimit(budgets.data.budgets, 3) : [];

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
            <Row gap="xs">
              <Amount variant="caption" value={data.display_net} currency={data.currency} signed />
              {period === "this_month" ? (
                <Text variant="caption" tone="muted">
                  {`· ${data.days_remaining_in_month} day${data.days_remaining_in_month === 1 ? "" : "s"} left in month`}
                </Text>
              ) : null}
            </Row>
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

      {/* D11 already prompts to set a budget when there is none, so this section only
          appears once there is something to rank; it loads independently of the balance. */}
      {/* C8: cached rows stay on screen when a refresh fails; the error shows only with nothing to show. */}
      {budgets.isPending || budgets.isError || closest.length > 0 ? (
        <>
          <Row justify="between">
            <Text variant="heading">Closest to limit</Text>
            <Button title="See all →" variant="link" onPress={() => router.push("/budget")} />
          </Row>
          {budgets.isPending ? (
            <Stack>
              <Skeleton height={64} />
              <Skeleton height={64} />
            </Stack>
          ) : closest.length === 0 ? (
            <Stack gap="xs">
              <Text tone="muted">{"Couldn't load your budgets."}</Text>
              <Button title="Try again" variant="link" onPress={() => budgets.refetch()} />
            </Stack>
          ) : (
            closest.map((b) => {
              const progress = budgetProgress(b);
              const categoryName = b.category ?? "Unknown category";
              return (
                <Card key={b.id} onPress={() => router.push("/budget")}>
                  <Row gap="sm">
                    <CategoryIcon name={b.category} size={32} />
                    <Stack grow gap="xs">
                      <Text>{categoryName}</Text>
                      <ProgressBar
                        percent={progress.barPercent}
                        tone={progress.over ? "negative" : undefined}
                        category={{ name: b.category }}
                        label={`${categoryName} budget used`}
                      />
                      <Text variant="caption" tone={progress.over ? "negative" : "muted"}>
                        {budgetStatusText(progress, (m) => formatMinor(m, currency))}
                      </Text>
                    </Stack>
                  </Row>
                </Card>
              );
            })
          )}
        </>
      ) : null}

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

      {/* Mini cards for up to 4 active goals; empty stays a single link (D1-style),
          so a brand-new user does not get a heading over nothing. */}
      {goals.data && goals.data.goals.length > 0 ? (
        <>
          <Row justify="between">
            <Text variant="heading">Goals</Text>
            <Button title="See all →" variant="link" onPress={() => router.push("/goals")} />
          </Row>
          {goals.data.goals.slice(0, 4).map((g) => {
            const percent = percentOf(g.current_amount, g.target_amount);
            return (
              <Card key={g.id} onPress={() => router.push(`/goals/${g.id}`)}>
                <Text numberOfLines={1}>{g.title}</Text>
                <ProgressBar percent={percent} label={`${g.title} progress`} />
                <Text variant="caption" tone="muted">{`${percent}%`}</Text>
              </Card>
            );
          })}
        </>
      ) : goals.isPending ? (
        <Stack>
          <Skeleton height={64} />
        </Stack>
      ) : goals.isError ? (
        <Stack gap="xs">
          <Text tone="muted">{"Couldn't load your goals."}</Text>
          <Button title="Try again" variant="link" onPress={() => goals.refetch()} />
        </Stack>
      ) : (
        <Button title="No goals yet — add one →" variant="link" onPress={() => router.push("/goals/new")} />
      )}

      <Button title="View reports →" variant="link" onPress={() => router.push("/reports")} />
    </Screen>
  );
}
