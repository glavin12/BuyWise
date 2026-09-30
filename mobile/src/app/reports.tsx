import { useQueries, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { currentMonth, monthKey, monthShift, todayLocal, type MonthYear } from "@/lib/dates";
import { formatMinor } from "@/lib/format";
import { currencySymbol, wholeIfRound } from "@/lib/home";
import { METHOD_CHIP } from "@/lib/labels";
import { categorySpendingQuery, comparisonQuery, monthIncomeQuery, paymentMethodQuery, profileQuery } from "@/lib/queries";
import {
  arrowPercent,
  barPercents,
  categoryShares,
  dailyAverage,
  dailyChange,
  daysCounted,
  keptLine,
  lastMonths,
  methodShares,
  monthLabel,
  monthYear,
  periodLabel,
  savedBadge,
  signedCompact,
  signedPercent,
  trend,
  txnLabel,
  type Share,
} from "@/lib/reports";
import { escapeRich } from "@/lib/richText";
import type { MonthlySummary, PaymentMethod } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import {
  Banner,
  BarChart,
  CategoryRow,
  categoryTone,
  ChartBlock,
  ChartNote,
  CircleButton,
  goBack,
  MethodBar,
  Note,
  OptionSheet,
  Panel,
  Pill,
  ReportCard,
  RichText,
  Row,
  SavingsCard,
  Screen,
  SegmentBar,
  Skeleton,
  Stack,
  StatCard,
  StatTile,
  Title,
  TomatoPanel,
  type Hue,
  type OptionGroup,
} from "@/ui";

// Reports (design/screens/08-reports.png, values from design/reference-html/Reports.html): back and title,
// the month and currency pills, the tomato panel (total spent, average per day, six months of income vs
// spend with the chosen one last), the mint savings card, spending by category, the month against the one
// before, and how it was paid. Each section loads and fails on its own.

const HISTORY_MONTHS = 6;
const MONTHS_BACK = 11; // the month sheet reaches this many months before this one

const METHOD_TONE: Record<PaymentMethod, Hue> = { upi: "peri2", card: "tomato", cash: "marigold", bank_transfer: "mint", other: "sky" };
const methodLabel = (method: string | null) => (method ? (METHOD_CHIP[method as PaymentMethod] ?? method) : "Not set");
const methodTone = (method: string | null): Hue => (method ? (METHOD_TONE[method as PaymentMethod] ?? "muted") : "muted");

/** Every query's data, once all of them have some (cached or fresh); null while any is still on its first load. */
function settled<T>(data: readonly (T | undefined)[]): T[] | null {
  return data.every((d): d is T => d !== undefined) ? [...data] : null;
}

/** A section that could not load and has nothing cached: why, and a way to try again. `tone` is the surface it sits on. */
function Failed({ err, action, onRetry, tone }: { err: unknown; action: string; onRetry: () => void; tone: "ink" | "card" }) {
  return (
    <RichText tone={tone} links={{ retry: onRetry }}>
      {`${escapeRich(userMessage(err, action))} {dark@retry:Try again}`}
    </RichText>
  );
}

export default function ReportsScreen() {
  const router = useRouter();
  const now = currentMonth();
  const today = todayLocal();
  const [period, setPeriod] = useState<MonthYear>(now);
  const [sheet, setSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const months = lastMonths(period, HISTORY_MONTHS);
  const previous = monthShift(period.month, period.year, -1);

  const history = useQueries({ queries: months.map((m) => monthIncomeQuery(m)) });
  const chosen = history[history.length - 1]; // the chosen month, whatever the other five are doing
  const comparison = useQuery(comparisonQuery(previous, period));
  const categories = useQuery(categorySpendingQuery(period));
  const methods = useQuery(paymentMethodQuery(period));
  const profile = useQuery(profileQuery);
  useRefetchStaleOnFocus();

  const currency = profile.data?.currency ?? "INR";
  const money = (minor: number) => wholeIfRound(formatMinor(minor, currency));

  const summary = chosen.data;
  const cmp = comparison.data;
  const days = daysCounted(period, today);
  const spentChange = cmp?.change.expenses.percent ?? null;
  const dailyPercent = cmp ? dailyChange(cmp.second.expenses, days, cmp.first.expenses, daysCounted(previous, today)) : null;

  const summaries = settled<MonthlySummary>(history.map((h) => h.data));
  const bars = summaries ? barPercents(summaries) : null;
  const chartMonths =
    summaries && bars
      ? summaries.map((s, i) => ({
          key: monthKey(s.month, s.year),
          label: monthLabel(s),
          incomePercent: bars[i].incomePercent,
          spendPercent: bars[i].spendPercent,
          hint: `${monthYear(s)}: income ${money(s.income)}, spent ${money(s.expenses)}`,
        }))
      : null;
  const trendFailed = !summaries && history.some((h) => h.isError);

  const shares = categories.data ? categoryShares(categories.data) : null;
  const toneOf = (s: Share): Hue => (s.other ? "muted" : categoryTone(s.name, s.color));
  const paid = methods.data ? methodShares(methods.data) : null;
  const change = cmp?.change;

  // C8: a refresh failed but cached numbers are on screen, so keep showing them and say so once.
  const stale = [...history, comparison, categories, methods].some((q) => q.isError && q.data !== undefined);

  const choices = Array.from({ length: MONTHS_BACK + 1 }, (_, i) => monthShift(now.month, now.year, -i));
  const groups: OptionGroup[] = [{ options: choices.map((m) => ({ value: monthKey(m.month, m.year), label: periodLabel(m, now) })) }];

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await Promise.all([...history.map((h) => h.refetch()), comparison.refetch(), categories.refetch(), methods.refetch(), profile.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const screen = (
    <Screen surface="screen" enter onRefresh={refresh} refreshing={refreshing}>
      <Row>
        <CircleButton icon={ArrowLeft} label="Go back" onPress={goBack} />
        <Title>Reports</Title>
      </Row>

      <Row gap="sm">
        <Pill label={periodLabel(period, now)} accessibilityLabel={`Month: ${periodLabel(period, now)}`} onPress={() => setSheet(true)} />
        {/* The API does not convert currencies: the one in the profile is what every amount is in. */}
        <Pill
          label={`${currency}, ${currencySymbol(currency)}`}
          accessibilityLabel={`Currency ${currency}. Change it in your profile`}
          onPress={() => router.push("/settings/profile")}
        />
      </Row>

      {stale ? <Banner tone="warning" message="Couldn't refresh. Showing your last known numbers." /> : null}

      <TomatoPanel>
        <StatCard
          title="Total spent"
          value={summary ? formatMinor(summary.expenses, currency) : chosen.isError ? "—" : null}
          badge={spentChange === null ? null : signedPercent(spentChange)}
        />
        <StatCard
          title="Avg. daily spend"
          value={summary ? money(dailyAverage(summary.expenses, days)) : chosen.isError ? "—" : null}
          badge={dailyPercent === null ? null : signedPercent(dailyPercent)}
          aside={"vs.\nlast month"}
        />
        <ChartBlock>
          {trendFailed ? (
            <ChartNote>
              <Failed
                tone="ink"
                err={history.find((h) => h.isError)?.error}
                action="load your spending trend"
                onRetry={() => history.filter((h) => h.isError).forEach((h) => void h.refetch())}
              />
            </ChartNote>
          ) : (
            <BarChart
              months={chartMonths}
              tag={summary ? savedBadge(summary.income, summary.expenses, money) : null}
              onSelect={(i) => setPeriod(months[i])}
            />
          )}
        </ChartBlock>
      </TomatoPanel>

      <SavingsCard title={summary ? keptLine(summary.income, summary.expenses) : chosen.isError ? "Couldn't load\nyour savings" : null} />

      <ReportCard title="By category" aside={monthYear(period)}>
        {shares ? (
          shares.length > 0 ? (
            <>
              <SegmentBar parts={shares.map((s) => ({ key: s.key, tone: toneOf(s), weight: s.percent }))} />
              {shares.map((s, i) => (
                <CategoryRow
                  key={s.key}
                  first={i === 0}
                  name={s.name}
                  tone={toneOf(s)}
                  count={txnLabel(s.count)}
                  amount={money(s.amount)}
                  percent={`${Math.round(s.percent)}%`}
                />
              ))}
            </>
          ) : (
            // D1: nothing spent that month.
            <Note>{`Nothing spent in ${monthYear(period)}.`}</Note>
          )
        ) : categories.isError ? (
          <Failed tone="card" err={categories.error} action="load your spending by category" onRetry={() => categories.refetch()} />
        ) : (
          <Stack>
            <Skeleton tone="dark" height={18} round="pill" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} tone="dark" height={22} />
            ))}
          </Stack>
        )}
      </ReportCard>

      {change ? (
        <Row gap="sm" align="stretch">
          <StatTile label="income" value={arrowPercent(change.income.percent)} tone={trend(change.income.percent, true)} />
          <StatTile label="expenses" value={arrowPercent(change.expenses.percent)} tone={trend(change.expenses.percent, false)} />
          <StatTile label="net saved" value={signedCompact(change.net.amount, currency)} tone={trend(change.net.amount, true)} />
        </Row>
      ) : comparison.isError ? (
        <Panel>
          <Failed tone="card" err={comparison.error} action="compare this month with the one before" onRetry={() => comparison.refetch()} />
        </Panel>
      ) : (
        <Row gap="sm">
          {[0, 1, 2].map((i) => (
            <Stack key={i} grow>
              <Skeleton tone="dark" height={68} round="row" />
            </Stack>
          ))}
        </Row>
      )}

      <ReportCard title="How you paid" aside="by amount">
        {paid ? (
          paid.length > 0 ? (
            <Stack>
              {paid.map((m) => (
                <MethodBar key={m.key} label={methodLabel(m.method)} tone={methodTone(m.method)} percent={m.percent} />
              ))}
            </Stack>
          ) : (
            // D1: nothing spent that month.
            <Note>{`Nothing spent in ${monthYear(period)}.`}</Note>
          )
        ) : methods.isError ? (
          <Failed tone="card" err={methods.error} action="load your payment methods" onRetry={() => methods.refetch()} />
        ) : (
          <Stack>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} tone="dark" height={10} round="pill" />
            ))}
          </Stack>
        )}
      </ReportCard>
    </Screen>
  );

  return (
    <>
      {screen}
      {/* The modal sits outside the Screen: inside it it would take an empty slot in its entrance. */}
      <OptionSheet
        visible={sheet}
        title="Month"
        groups={groups}
        value={monthKey(period.month, period.year)}
        onSelect={(key) => {
          setPeriod(choices.find((m) => monthKey(m.month, m.year) === key) ?? now);
          setSheet(false);
        }}
        onClose={() => setSheet(false)}
      />
    </>
  );
}
