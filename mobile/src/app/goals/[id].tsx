import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { isNotFound, userMessage } from "@/lib/api";
import { todayLocal } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/format";
import { countdown, percentOf } from "@/lib/goals";
import { isUuid } from "@/lib/ids";
import { goalTypeLabel, priorityLabel } from "@/lib/labels";
import { useUpdateGoal } from "@/lib/mutations";
import { profileQuery, useGoal } from "@/lib/queries";
import type { Goal } from "@/lib/types";
import {
  Amount,
  Banner,
  Button,
  Card,
  confirm,
  ErrorState,
  goBack,
  hapticSuccess,
  NotFoundScreen,
  ProgressBar,
  Screen,
  showToast,
  Skeleton,
  Text,
} from "@/ui";

export default function GoalDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // The id comes from a URL: anything that is not a UUID is not found.
  if (!isUuid(id)) return <NotFoundScreen title="Goal" what="Goal" />;
  return <GoalDetail id={id} />;
}

function GoalDetail({ id }: { id: string }) {
  const router = useRouter();
  const lookup = useGoal(id);
  const profile = useQuery(profileQuery);
  const update = useUpdateGoal();
  // The goal just archived, kept on screen while the screen slides away (the refetch
  // that follows drops it from the lists, which would otherwise flash "not found").
  const [leaving, setLeaving] = useState<Goal | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const goal = lookup.goal ?? leaving;

  if (!goal) {
    if (lookup.missing) return <NotFoundScreen title="Goal" what="Goal" />;
    return (
      <Screen title="Goal" back>
        {lookup.error ? (
          <ErrorState message={userMessage(lookup.error, "load this goal")} onRetry={lookup.refetch} />
        ) : (
          <>
            <Skeleton height={96} />
            <Skeleton height={180} />
          </>
        )}
      </Screen>
    );
  }

  const currency = profile.data?.currency ?? "INR";
  const money = (display: number) => formatCurrency(display, currency);
  const achieved = goal.status === "completed";
  const percent = percentOf(goal.current_amount, goal.target_amount);
  const due = achieved ? null : countdown(goal.target_date, todayLocal());
  const priority = priorityLabel(goal.priority);
  const details = [goalTypeLabel(goal.goal_type), priority ? `${priority} priority` : undefined].filter(Boolean).join(" · ");

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await lookup.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  // There is no DELETE for goals: archiving is the only way to remove one.
  const archive = async () => {
    const yes = await confirm(`Archive "${goal.title}"?`, "It will be removed from your goals. You can't undo this here.", "Archive", true);
    if (!yes) return;
    setFailure(null);
    try {
      await update.mutateAsync({ id, patch: { status: "archived" } });
    } catch (err) {
      if (!isNotFound(err)) {
        setFailure(userMessage(err, "archive this goal"));
        return;
      }
      // Already gone elsewhere: the goal is met, so carry on as a success.
    }
    setLeaving(goal);
    hapticSuccess();
    showToast("Goal archived");
    goBack();
  };

  return (
    <Screen title="Goal" back onRefresh={refresh} refreshing={refreshing}>
      {lookup.stale ? <Banner tone="warning" message="Couldn't refresh. Showing the last details we have." /> : null}
      {failure ? <Banner tone="error" message={failure} /> : null}

      <Card>
        <Text variant="title">{goal.title}</Text>
        {achieved ? <Text tone="positive">Achieved</Text> : null}
        {details ? (
          <Text variant="caption" tone="muted">
            {details}
          </Text>
        ) : null}
        {goal.description ? <Text>{goal.description}</Text> : null}
      </Card>

      <Card>
        <Amount variant="display" value={goal.display_current_amount} currency={currency} />
        <Text tone="muted">{`of ${money(goal.display_target_amount)} · ${percent}%`}</Text>
        <ProgressBar percent={percent} tone={achieved ? "positive" : "accent"} label={`${goal.title} progress`} />
        {achieved ? null : <Text>{`${money(goal.display_remaining_amount)} to go`}</Text>}
        {goal.target_date ? <Text tone="muted">{`Target date ${formatDate(goal.target_date, "medium")}`}</Text> : null}
        {due ? <Text tone={due.overdue ? "negative" : "muted"}>{due.label}</Text> : null}
        {!achieved && goal.display_monthly_needed_to_hit_target !== null ? (
          <Text tone="muted">{`Save ${money(goal.display_monthly_needed_to_hit_target)} a month to get there`}</Text>
        ) : null}
      </Card>

      {achieved ? null : <Button title="Contribute" onPress={() => router.push(`/goals/${id}/contribute`)} />}
      <Button title="Edit" variant="secondary" onPress={() => router.push(`/goals/${id}/edit`)} />
      <Button title="Archive goal" variant="danger" requiresNetwork onPress={archive} />
    </Screen>
  );
}
