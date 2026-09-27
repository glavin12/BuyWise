import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { currentMonth, monthShift, type MonthYear } from "@/lib/dates";
import { formatMonth } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/labels";
import { categorySpendingQuery, comparisonQuery, monthIncomeQuery, paymentMethodQuery, profileQuery } from "@/lib/queries";
import { averageRate, barPercents, lastMonths, monthLabel, rateInsight, savingsRate, topCategory } from "@/lib/reports";
import type { MonthComparisonDelta, MonthlySummary, PaymentMethod } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import {
  Amount,
  Banner,
  BarChart,
  Button,
  Card,
  CategoryIcon,
  MonthSwitcher,
  ProgressBar,
  Row,
  Screen,
  Skeleton,
  Stack,
  Text,
} from "@/ui";

const HISTORY_MONTHS = 6;

/** Every query's data, once all of them have some (cached or fresh); null while any is still on its first load. */
function settled<T>(data: readonly (T | undefined)[]): T[] | null {
  return data.every((d): d is T => d !== undefined) ? [...data] : null;
}

function SectionError({ err, action, onRetry }: { err: unknown; action: string; onRetry: () => void }) {
  return (
    <Stack gap="xs">
      <Text tone="muted">{userMessage(err, action)}</Text>
      <Button title="Try again" variant="link" onPress={onRetry} />
    </Stack>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <Skeleton width="40%" height={16} />
      <Skeleton height={12} width="90%" />
      <Skeleton height={12} width="60%" />
    </Card>
  );
}

function compareTone(delta: MonthComparisonDelta, badWhenUp: boolean): "default" | "positive" | "negative" {
  if (delta.amount === 0) return "default";
  return (badWhenUp ? delta.amount < 0 : delta.amount > 0) ? "positive" : "negative";
}

function CompareRow({
  label,
  delta,
  badWhenUp,
  currency,
}: {
  label: string;
  delta: MonthComparisonDelta;
  badWhenUp: boolean;
  currency: string;
}) {
  const arrow = delta.amount > 0 ? "↑" : delta.amount < 0 ? "↓" : "→";
  const pct = delta.percent === null ? "—" : `${Math.abs(delta.percent).toFixed(0)}%`;
  const tone = compareTone(delta, badWhenUp); // more spending is red even though the number is positive
  return (
    <Row justify="between">
      <Text>{label}</Text>
      <Row gap="xs">
        <Amount value={delta.display_amount} currency={currency} signed tone={tone} />
        <Text tone={tone}>{`${arrow} ${pct}`}</Text>
      </Row>
    </Row>
  );
}

export default function ReportsScreen() {
  const [period, setPeriod] = useState<MonthYear>(currentMonth);
  const [refreshing, setRefreshing] = useState(false);

  const months = lastMonths(period, HISTORY_MONTHS);
  const previousMonth = monthShift(period.month, period.year, -1);

  const history = useQueries({ queries: months.map((m) => monthIncomeQuery(m)) });
  const categories = useQuery(categorySpendingQuery(period));
  const comparison = useQuery(comparisonQuery(previousMonth, period));
  const paymentMethods = useQuery(paymentMethodQuery(period));
  const profile = useQuery(profileQuery);
  useRefetchStaleOnFocus();

  const currency = profile.data?.currency ?? "INR";
  const monthLabelText = formatMonth(period.month, period.year);
  const now = currentMonth();
  const atCurrent = period.month === now.month && period.year === now.year;

  const historyData = settled<MonthlySummary>(history.map((h) => h.data));
  const historyStale = !!historyData && history.some((h) => h.isError);
  const historyFailed = !historyData && history.some((h) => h.isError);
  const bars = historyData ? barPercents(historyData) : null;
  const current = historyData ? savingsRate(historyData[historyData.length - 1]) : null;
  const avg = historyData ? averageRate(historyData) : null;

  const changeMonth = (delta: number) => {
    if (delta > 0 && atCurrent) return; // never step past the current month
    setPeriod((p) => monthShift(p.month, p.year, delta));
  };

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await Promise.all([
        ...history.map((h) => h.refetch()),
        categories.refetch(),
        comparison.refetch(),
        paymentMethods.refetch(),
        profile.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen title="Reports" back onRefresh={refresh} refreshing={refreshing}>
      <MonthSwitcher label={monthLabelText} onPrevious={() => changeMonth(-1)} onNext={() => changeMonth(1)} />

      {/* Trend: income vs. spend, six months ending at the selected one. */}
      {historyFailed ? (
        <Card>
          <SectionError
            err={history.find((h) => h.isError)?.error}
            action="load your spending trend"
            onRetry={() => history.forEach((h) => h.refetch())}
          />
        </Card>
      ) : !historyData || !bars ? (
        <CardSkeleton />
      ) : (
        <Card>
          <Text variant="heading">{`Income vs. spend · last ${HISTORY_MONTHS} months`}</Text>
          {historyStale ? <Banner tone="warning" message="Couldn't refresh every month. Showing what's cached." /> : null}
          <BarChart
            currency={currency}
            months={historyData.map((h, i) => ({
              key: `${h.year}-${h.month}`,
              label: monthLabel(h),
              incomeMinor: h.income,
              spendMinor: h.expenses,
              incomePercent: bars[i].incomePercent,
              spendPercent: bars[i].spendPercent,
              selected: i === historyData.length - 1,
            }))}
          />
        </Card>
      )}

      {/* Savings rate: same 6-month window, so it shares the trend's loading/error above. */}
      {!historyFailed && !historyData ? (
        <CardSkeleton />
      ) : historyData ? (
        <Card>
          <Text variant="caption" tone="muted">Savings rate</Text>
          <Text variant="display" tone={current === null ? "muted" : current >= 0 ? "positive" : "negative"}>
            {current === null ? "—" : `${Math.round(current)}%`}
          </Text>
          <Text tone="muted">{rateInsight(current, avg)}</Text>
        </Card>
      ) : null}

      {/* Category breakdown */}
      <Text variant="heading">{`Where the money went · ${monthLabel(period)}`}</Text>
      {categories.isError && !categories.data ? (
        <SectionError err={categories.error} action="load your category breakdown" onRetry={() => categories.refetch()} />
      ) : !categories.data ? (
        <CardSkeleton />
      ) : categories.data.length === 0 ? (
        <Text tone="muted">No spending yet.</Text>
      ) : (
        <Stack gap="sm">
          {categories.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known spending." /> : null}
          {categories.data.map((row) => (
            <Card key={row.category_id}>
              <Row justify="between" align="start">
                <Row gap="sm" grow>
                  <CategoryIcon name={row.category} icon={row.icon} color={row.color} size={32} />
                  <Stack gap="xs" grow>
                    <Text numberOfLines={1}>{row.category}</Text>
                    <Text variant="caption" tone="muted">{`${row.transaction_count} txn${row.transaction_count === 1 ? "" : "s"}`}</Text>
                  </Stack>
                </Row>
                <Stack gap="xs">
                  <Amount value={row.display_amount} currency={currency} />
                  <Text variant="caption" tone="muted">{`${Math.round(row.percent_of_total)}%`}</Text>
                </Stack>
              </Row>
              <ProgressBar percent={row.percent_of_total} category={{ name: row.category, color: row.color }} label={`${row.category} spending`} />
            </Card>
          ))}
        </Stack>
      )}

      {/* Month comparison */}
      <Text variant="heading">{`${monthLabel(period)} vs. ${monthLabel(previousMonth)}`}</Text>
      {comparison.isError && !comparison.data ? (
        <SectionError err={comparison.error} action="load this comparison" onRetry={() => comparison.refetch()} />
      ) : !comparison.data ? (
        <CardSkeleton />
      ) : (
        <Card>
          {comparison.isError ? <Banner tone="warning" message="Couldn't refresh. Showing the last known comparison." /> : null}
          <CompareRow label="Income" delta={comparison.data.change.income} badWhenUp={false} currency={currency} />
          <CompareRow label="Expenses" delta={comparison.data.change.expenses} badWhenUp currency={currency} />
          <CompareRow label="Net" delta={comparison.data.change.net} badWhenUp={false} currency={currency} />
        </Card>
      )}

      {/* Payment methods */}
      <Text variant="heading">By payment method</Text>
      {paymentMethods.isError && !paymentMethods.data ? (
        <SectionError err={paymentMethods.error} action="load your payment methods" onRetry={() => paymentMethods.refetch()} />
      ) : !paymentMethods.data ? (
        <CardSkeleton />
      ) : paymentMethods.data.length === 0 ? (
        <Text tone="muted">No spending yet.</Text>
      ) : (
        <Card>
          {paymentMethods.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known totals." /> : null}
          <Stack>
            {paymentMethods.data.map((row) => {
              const label = row.payment_method ? (METHOD_LABEL[row.payment_method as PaymentMethod] ?? row.payment_method) : "Not set";
              return (
                <Stack key={row.payment_method ?? "none"} gap="xs">
                  <Row justify="between">
                    <Text>{label}</Text>
                    <Amount value={row.display_amount} currency={currency} />
                  </Row>
                  <ProgressBar percent={row.percent_of_total} label={`${label} spending`} />
                </Stack>
              );
            })}
          </Stack>
        </Card>
      )}

      {/* Insights */}
      <Row align="stretch">
        <Card grow>
          <Text variant="heading">Savings rate</Text>
          <Text tone="muted">{historyData ? rateInsight(current, avg) : historyFailed ? "Couldn't load." : "…"}</Text>
        </Card>
        <Card grow>
          <Text variant="heading">Top category</Text>
          <Text tone="muted">
            {categories.data ? (topCategory(categories.data) ?? "No spending yet.") : categories.isError ? "Couldn't load." : "…"}
          </Text>
        </Card>
      </Row>
    </Screen>
  );
}
