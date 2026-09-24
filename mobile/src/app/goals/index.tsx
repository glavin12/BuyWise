import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { todayLocal } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { countdown, featuredGoal, percentOf } from "@/lib/goals";
import { priorityLabel } from "@/lib/labels";
import { goalsQuery, profileQuery, type GoalList } from "@/lib/queries";
import type { Goal } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import { Banner, Button, Card, EmptyState, ErrorState, ProgressBar, Screen, Segmented, Skeleton, Text } from "@/ui";

const VIEWS = [
  { label: "Active", value: "active" },
  { label: "Achieved", value: "completed" },
] as const;

/** One goal. The featured one (highest priority) also shows its priority and the monthly amount needed. */
function GoalCard({
  goal,
  currency,
  today,
  featured = false,
  onPress,
}: {
  goal: Goal;
  currency: string;
  today: string;
  featured?: boolean;
  onPress: () => void;
}) {
  const achieved = goal.status === "completed";
  const percent = percentOf(goal.current_amount, goal.target_amount);
  const due = achieved ? null : countdown(goal.target_date, today);
  const amounts = `${formatCurrency(goal.display_current_amount, currency)} of ${formatCurrency(goal.display_target_amount, currency)}`;
  const priority = featured ? priorityLabel(goal.priority) : undefined;
  const monthly =
    featured && !achieved && goal.display_monthly_needed_to_hit_target !== null
      ? `Save ${formatCurrency(goal.display_monthly_needed_to_hit_target, currency)} a month to get there`
      : null;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${goal.title}. ${amounts}, ${percent}% ${achieved ? "achieved" : "reached"}.${due ? ` ${due.label}.` : ""} Tap to open.`}
    >
      <Text variant={featured ? "title" : "heading"}>{goal.title}</Text>
      {priority ? (
        <Text variant="caption" tone="muted">
          {`${priority} priority`}
        </Text>
      ) : null}
      <ProgressBar percent={percent} tone={achieved ? "positive" : "accent"} label={`${goal.title} progress`} />
      <Text variant="caption" tone="muted">{`${amounts} · ${percent}%`}</Text>
      {achieved ? (
        <Text variant="caption" tone="positive">
          Achieved
        </Text>
      ) : null}
      {due ? (
        <Text variant="caption" tone={due.overdue ? "negative" : "muted"}>
          {due.label}
        </Text>
      ) : null}
      {monthly ? (
        <Text variant="caption" tone="muted">
          {monthly}
        </Text>
      ) : null}
    </Card>
  );
}

export default function GoalsScreen() {
  const router = useRouter();
  // The Active / Achieved choice lives in the URL so that a screen that opens over this
  // one (a goal created already reached) can send the user to the right list.
  const { status } = useLocalSearchParams<{ status?: string }>();
  const view: GoalList = status === "completed" ? "completed" : "active";
  const [refreshing, setRefreshing] = useState(false);
  const goals = useQuery(goalsQuery(view));
  const profile = useQuery(profileQuery);
  useRefetchStaleOnFocus();

  const currency = profile.data?.currency ?? "INR";
  const list = goals.data?.goals;
  const featured = view === "active" && list ? featuredGoal(list) : undefined;
  const others = list && featured ? list.filter((goal) => goal.id !== featured.id) : list;
  const today = todayLocal();

  const openGoal = (id: string) => router.push(`/goals/${id}`);

  const refresh = async () => {
    if (refreshing) return; // ignore a second pull while one is running
    setRefreshing(true);
    try {
      await goals.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen title="Goals" back onRefresh={refresh} refreshing={refreshing}>
      <Segmented options={VIEWS} value={view} onChange={(next) => router.setParams({ status: next })} />
      <Button title="New goal" onPress={() => router.push("/goals/new")} />

      {list && goals.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known goals." /> : null}

      {!list ? (
        goals.isError ? (
          <ErrorState message={userMessage(goals.error, "load your goals")} onRetry={() => goals.refetch()} />
        ) : (
          <>
            <Skeleton height={140} />
            <Skeleton height={96} />
            <Skeleton height={96} />
          </>
        )
      ) : list.length === 0 ? (
        view === "active" ? (
          <EmptyState icon="flag-outline" title="No active goals" message="Set a target and track your progress towards it." />
        ) : (
          <EmptyState icon="trophy-outline" title="No achieved goals yet" message="Goals you reach show up here." />
        )
      ) : (
        <>
          {featured ? <GoalCard goal={featured} currency={currency} today={today} featured onPress={() => openGoal(featured.id)} /> : null}
          {others?.map((goal) => (
            <GoalCard key={goal.id} goal={goal} currency={currency} today={today} onPress={() => openGoal(goal.id)} />
          ))}
        </>
      )}
    </Screen>
  );
}
