import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import {
  budgetProgress,
  budgetStatusText,
  copySummary,
  isArchivedBudget,
  readyToAssign,
  unbudgetedCategories,
} from "@/lib/budget";
import { currentMonth, monthShift, type MonthYear } from "@/lib/dates";
import { formatMinor, formatMonth, minorToDisplay } from "@/lib/format";
import { useCopyBudgets } from "@/lib/mutations";
import { categoriesQuery, monthBudgetsQuery, monthIncomeQuery, profileQuery, usePlanBudgetCopy } from "@/lib/queries";
import type { Budget } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import {
  Amount,
  Banner,
  Button,
  Card,
  confirm,
  ErrorState,
  hapticSuccess,
  Icon,
  MonthSwitcher,
  ProgressBar,
  Row,
  Screen,
  Skeleton,
  Stack,
  Text,
} from "@/ui";

function BudgetRow({
  budget,
  archived,
  currency,
  onPress,
}: {
  budget: Budget;
  archived: boolean;
  currency: string;
  onPress: () => void;
}) {
  const money = (minor: number) => formatMinor(minor, currency);
  const progress = budgetProgress(budget);
  // Meaning is in the words ("Over by ₹500 · 125% used"); the red bar only reinforces it.
  const status = budgetStatusText(progress, money);
  const spent = `${money(budget.spent ?? 0)} of ${money(budget.budgeted_amount)} spent`;
  const name = budget.category ?? "Unknown category";

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${name}${archived ? ", archived category" : ""}. ${spent}. ${status}. Tap to edit.`}
    >
      <Row justify="between">
        <Stack grow gap="xs">
          <Text variant="heading">{name}</Text>
          {archived ? (
            <Text variant="caption" tone="muted">
              Archived category
            </Text>
          ) : null}
        </Stack>
        <Icon name="create-outline" />
      </Row>
      <ProgressBar percent={progress.barPercent} tone={progress.over ? "negative" : "accent"} label={`${name} budget used`} />
      <Text variant="caption" tone="muted">
        {spent}
      </Text>
      <Text variant="caption" tone={progress.over ? "negative" : "muted"}>
        {status}
      </Text>
    </Card>
  );
}

function BudgetSkeleton() {
  return (
    <>
      <Card>
        <Skeleton width="40%" height={12} />
        <Skeleton width="60%" height={40} />
        <Skeleton width="80%" height={12} />
      </Card>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <Skeleton width="50%" height={18} />
          <Skeleton height={8} />
          <Skeleton width="70%" height={12} />
        </Card>
      ))}
    </>
  );
}

export default function BudgetTab() {
  const router = useRouter();
  const [period, setPeriod] = useState<MonthYear>(currentMonth);
  const [refreshing, setRefreshing] = useState(false);
  const [copyResult, setCopyResult] = useState<{ tone: "info" | "warning"; message: string } | null>(null);

  const budgets = useQuery(monthBudgetsQuery(period));
  const income = useQuery(monthIncomeQuery(period));
  const categories = useQuery(categoriesQuery("expense"));
  const profile = useQuery(profileQuery);
  const planCopy = usePlanBudgetCopy();
  const copy = useCopyBudgets();
  useRefetchStaleOnFocus();

  const currency = profile.data?.currency ?? "INR";
  const monthLabel = formatMonth(period.month, period.year);
  const rows = budgets.data?.budgets;
  const expenseCategories = categories.data?.categories;
  const activeIds = expenseCategories ? new Set(expenseCategories.filter((c) => c.is_active).map((c) => c.id)) : null;
  const ready = rows && income.data ? readyToAssign(income.data.income, rows) : null;
  const unbudgeted = rows && expenseCategories ? unbudgetedCategories(expenseCategories, rows) : null;

  const changeMonth = (delta: number) => {
    setPeriod((p) => monthShift(p.month, p.year, delta));
    setCopyResult(null);
  };

  const openSet = (categoryId: string) =>
    router.push({
      pathname: "/budget/set",
      params: { categoryId, month: String(period.month), year: String(period.year) },
    });

  const refresh = async () => {
    if (refreshing) return; // ignore a second pull while one is running
    setRefreshing(true);
    try {
      await Promise.all([budgets.refetch(), income.refetch(), categories.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Copy last month's budgets: never over one already set, archived categories are
  // skipped up front, one failure does not stop the rest, and the result is a summary.
  const copyFromLastMonth = async () => {
    if (!activeIds) return;
    setCopyResult(null);
    let found;
    try {
      found = await planCopy(period, activeIds);
    } catch (err) {
      setCopyResult({ tone: "warning", message: userMessage(err, "load last month's budgets") });
      return;
    }
    const { from, lastMonth, plan } = found;
    const fromLabel = formatMonth(from.month, from.year);

    if (plan.copy.length === 0) {
      setCopyResult({
        tone: "info",
        message:
          lastMonth.length === 0
            ? `Nothing to copy: you have no budgets in ${fromLabel}.`
            : `Nothing to copy: everything from ${fromLabel} is already set here or belongs to an archived category.`,
      });
      return;
    }

    const count = plan.copy.length;
    const yes = await confirm(
      `Copy ${count} budget${count === 1 ? "" : "s"} from ${fromLabel} into ${monthLabel}?`,
      plan.skipped > 0
        ? `${plan.skipped} will be skipped (already set, or an archived category). Budgets you've set won't change.`
        : "Budgets you've already set won't change.",
      "Copy"
    );
    if (!yes) return;

    const run = await copy.mutateAsync({ plan, to: period });
    if (run.copied > 0) hapticSuccess();
    // The month is named because the user may have switched months while this ran.
    setCopyResult({
      tone: run.failed > 0 || run.stopped ? "warning" : "info",
      message: `${monthLabel}: ${copySummary(run, plan.skipped)}`,
    });
  };

  return (
    <Screen title="Budget" insetBottom={false} onRefresh={refresh} refreshing={refreshing}>
      <MonthSwitcher label={monthLabel} onPrevious={() => changeMonth(-1)} onNext={() => changeMonth(1)} />

      {copyResult ? <Banner tone={copyResult.tone} message={copyResult.message} /> : null}
      {rows && budgets.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known budgets." /> : null}

      {!rows ? (
        budgets.isError ? (
          <ErrorState message={userMessage(budgets.error, "load your budgets")} onRetry={() => budgets.refetch()} />
        ) : (
          <BudgetSkeleton />
        )
      ) : (
        <>
          <Card>
            <Text variant="caption" tone="muted">
              Ready to assign
            </Text>
            {ready ? (
              <>
                <Amount variant="display" value={minorToDisplay(ready.ready)} currency={currency} />
                <Text variant="caption" tone="muted">
                  {`Income ${formatMinor(ready.income, currency)} − Assigned ${formatMinor(ready.assigned, currency)} = ${
                    ready.ready < 0 ? `${formatMinor(-ready.ready, currency)} over-assigned` : `${formatMinor(ready.ready, currency)} ready`
                  }`}
                </Text>
              </>
            ) : income.isError ? (
              <Stack gap="xs">
                <Text tone="muted">{userMessage(income.error, "load this month's income")}</Text>
                <Button title="Try again" variant="link" onPress={() => income.refetch()} />
              </Stack>
            ) : (
              <Skeleton height={40} />
            )}
          </Card>

          <Text variant="heading">Budgeted</Text>
          {rows.length === 0 ? (
            <Text tone="muted">{`No budgets for ${monthLabel} yet. Set one below, or copy last month's.`}</Text>
          ) : (
            rows.map((budget) => (
              <BudgetRow
                key={budget.id}
                budget={budget}
                archived={activeIds ? isArchivedBudget(budget, activeIds) : false}
                currency={currency}
                onPress={() => openSet(budget.category_id)}
              />
            ))
          )}

          <Text variant="heading">Not budgeted yet</Text>
          {categories.isError && !expenseCategories ? (
            <Stack gap="xs">
              <Text tone="muted">{userMessage(categories.error, "load your categories")}</Text>
              <Button title="Try again" variant="link" onPress={() => categories.refetch()} />
            </Stack>
          ) : !unbudgeted ? (
            <Skeleton height={44} />
          ) : unbudgeted.length === 0 ? (
            <Text tone="muted">Every expense category has a budget.</Text>
          ) : (
            unbudgeted.map((category) => (
              <Card key={category.id} onPress={() => openSet(category.id)} accessibilityLabel={`Set a budget for ${category.name}`}>
                <Row justify="between">
                  <Stack grow>
                    <Text>{category.name}</Text>
                  </Stack>
                  <Text tone="accent">Set</Text>
                </Row>
              </Card>
            ))
          )}

          <Button
            title="Copy from last month"
            variant="secondary"
            requiresNetwork
            disabled={!activeIds || copy.isPending}
            onPress={copyFromLastMonth}
          />
        </>
      )}

      <Button title="Goals →" variant="link" onPress={() => router.push("/goals")} />
    </Screen>
  );
}
