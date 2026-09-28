import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowUpRight, Copy, Plus, RotateCw } from "lucide-react-native";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { budgetProgress, copySummary, envelopesFor, envelopeStack, envelopeStatus, readyToAssign } from "@/lib/budget";
import { currentMonth, monthKey, monthShift, type MonthYear } from "@/lib/dates";
import { formatMinor, formatMonth, formatMonthShort } from "@/lib/format";
import { wholeIfRound } from "@/lib/home";
import { useCopyBudgets } from "@/lib/mutations";
import { categoriesQuery, categorySpendingQuery, monthBudgetsQuery, monthIncomeQuery, profileQuery, usePlanBudgetCopy } from "@/lib/queries";
import { escapeRich } from "@/lib/richText";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import {
  Banner,
  BudgetedLine,
  Chip,
  CircleButton,
  confirm,
  EnvelopeFront,
  EnvelopeStack,
  EnvelopeTab,
  hapticSuccess,
  Illustration,
  Meter,
  OptionSheet,
  Pill,
  PillButton,
  PrimaryButton,
  ReadyCard,
  RichText,
  Row,
  Screen,
  SecondaryButton,
  Skeleton,
  Stack,
  Title,
  type OptionGroup,
} from "@/ui";

// Budget (design/screens/05-budget.png, values from design/reference-html/Budget.html): title and
// month pill, the "ready to assign" card with "Copy <last month>", then the envelope stack. Behind
// the front card: every budget, then unbudgeted categories spent in this month, then "+N more".
// The front card is the most spent at first; tapping a tab swaps it in like a wallet card (it keeps
// its colour, and the tab bar takes it) and sends the old front to the end, above "+N more".

const MONTHS_AHEAD = 3;
const MONTHS_BACK = 11;

export default function BudgetTab() {
  const router = useRouter();
  const now = currentMonth();
  const [period, setPeriod] = useState<MonthYear>(now);
  const [tapped, setTapped] = useState<string[]>([]);
  const [sheet, setSheet] = useState<"month" | "more" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copyResult, setCopyResult] = useState<{ tone: "info" | "warning"; message: string } | null>(null);

  const budgets = useQuery(monthBudgetsQuery(period));
  const income = useQuery(monthIncomeQuery(period));
  const categories = useQuery(categoriesQuery("expense"));
  const spending = useQuery(categorySpendingQuery(period));
  const profile = useQuery(profileQuery);
  const planCopy = usePlanBudgetCopy();
  const copy = useCopyBudgets();
  useRefetchStaleOnFocus();

  const currency = profile.data?.currency ?? "INR";
  const money = (minor: number) => wholeIfRound(formatMinor(minor, currency));
  const monthLabel = formatMonth(period.month, period.year);
  const rows = budgets.data?.budgets;
  const expenseCategories = categories.data?.categories;
  const activeIds = expenseCategories ? new Set(expenseCategories.filter((c) => c.is_active).map((c) => c.id)) : null;
  const ready = rows && income.data ? readyToAssign(income.data.income, rows) : null;
  const { envelopes, rest } = rows ? envelopesFor(rows, spending.data ?? [], expenseCategories) : { envelopes: [], rest: [] };
  const { front, behind } = envelopeStack(envelopes, tapped);
  const frontKind = front ? envelopeStatus(front, money).kind : undefined;
  const dark = frontKind === "over"; // the charcoal card: light text on it
  const previous = monthShift(period.month, period.year, -1);

  const months = Array.from({ length: MONTHS_AHEAD + 1 + MONTHS_BACK }, (_, i) => monthShift(now.month, now.year, MONTHS_AHEAD - i));
  const monthGroups: OptionGroup[] = [{ options: months.map((m) => ({ value: monthKey(m.month, m.year), label: formatMonth(m.month, m.year) })) }];
  const moreGroups: OptionGroup[] = [{ options: rest.map((c) => ({ value: c.id, label: c.name })) }];

  const openSet = (categoryId: string) =>
    router.push({
      pathname: "/budget/set",
      params: { categoryId, month: String(period.month), year: String(period.year) },
    });

  // ↗: this envelope's expenses for the month, in Activity.
  const openActivity = (categoryId: string) =>
    router.navigate({ pathname: "/transactions", params: { type: "expense", category: categoryId, month: monthKey(period.month, period.year) } });

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await Promise.all([budgets.refetch(), income.refetch(), categories.refetch(), spending.refetch()]);
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
      "Copy",
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

  const readyLine = ready
    ? `${money(ready.income)} in − ${money(ready.assigned)} assigned${ready.ready < 0 ? " · over-assigned" : ""}`
    : income.isError
      ? userMessage(income.error, "load this month's income")
      : "";

  const progress = front?.budget ? budgetProgress(front.budget) : null;
  const goals = <SecondaryButton label="Your goals →" surface={dark ? "dark" : "light"} onPress={() => router.push("/goals")} />;

  return (
    <Screen surface="peri" tabBar bleed onRefresh={refresh} refreshing={refreshing}>
      <Row justify="between">
        <Title>Budget</Title>
        <Pill label={formatMonthShort(period.month, period.year, 0)} onPress={() => setSheet("month")} />
      </Row>

      <ReadyCard
        amount={ready ? `${ready.ready < 0 ? "−" : ""}${money(Math.abs(ready.ready))}` : income.isError ? "—" : null}
        line={readyLine}
        action={
          income.isError && !income.data ? (
            <PillButton label="Try again" icon={RotateCw} onPress={() => income.refetch()} />
          ) : (
            <PillButton
              label={`Copy ${formatMonthShort(previous.month, previous.year, previous.year)}`}
              icon={Copy}
              requiresNetwork
              disabled={!activeIds || copy.isPending}
              onPress={copyFromLastMonth}
            />
          )
        }
      />

      {copyResult ? <Banner tone={copyResult.tone} message={copyResult.message} /> : null}
      {rows && budgets.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known budgets." /> : null}

      <EnvelopeStack>
        {behind.map((e) => (
          <EnvelopeTab
            key={e.categoryId}
            name={e.name}
            status={envelopeStatus(e, money)}
            onPress={() => setTapped((ids) => [...ids.filter((id) => id !== e.categoryId), e.categoryId])}
            onSet={e.budget ? undefined : () => openSet(e.categoryId)}
          />
        ))}
        {rest.length > 0 ? (
          <EnvelopeTab
            key="more"
            name={`+${rest.length} more`}
            status={{ kind: "more", text: "not budgeted" }}
            onPress={() => setSheet("more")}
            onSet={() => setSheet("more")}
          />
        ) : null}

        <EnvelopeFront key={front?.categoryId ?? "none"} kind={frontKind}>
          {!rows ? (
            budgets.isError ? (
              <>
                <Title size="titleXL" tone="ink">{"Can't load\nbudgets"}</Title>
                <RichText tone="ink">{escapeRich(userMessage(budgets.error, "load your budgets"))}</RichText>
                <PrimaryButton label="Try again" onPress={() => budgets.refetch()} />
              </>
            ) : (
              <>
                <Skeleton tone="light" width="60%" height={64} />
                <Skeleton tone="light" width="80%" height={28} round="pill" />
                <Skeleton tone="light" height={12} round="pill" />
              </>
            )
          ) : front ? (
            <>
              <Row justify="between" align="start">
                <Stack grow>
                  <Title size="titleXL" tone={dark ? "text" : "ink"}>
                    {front.name}
                  </Title>
                </Stack>
                <CircleButton
                  icon={ArrowUpRight}
                  variant={dark ? "cream" : "ink"}
                  label={`${front.name} in Activity`}
                  onPress={() => openActivity(front.categoryId)}
                />
              </Row>
              <Row gap="xs" wrap>
                <Chip dot="tomato" label={`${money(front.spent)} spent`} />
                {progress ? <Chip dot="peri" label={progress.over ? `${money(progress.overBy)} over` : `${money(progress.left)} left`} /> : null}
                <Chip dot="forest" label={`${front.count} ${front.count === 1 ? "transaction" : "transactions"}`} />
                {front.archived ? <Chip variant="creamLine" label="Archived category" /> : null}
              </Row>
              {progress ? (
                <Meter
                  height={12}
                  percent={progress.barPercent}
                  tooltip={progress.usedPercent === null ? undefined : `${progress.usedPercent}%`}
                  label={`${front.name}: ${progress.usedPercent ?? 100}% of the budget used`}
                  tone={dark ? "text" : "ink"}
                />
              ) : null}
              <BudgetedLine
                amount={front.budget ? money(front.budget.budgeted_amount) : null}
                onPress={() => openSet(front.categoryId)}
                tone={dark ? "text" : "ink"}
              />
              <Row justify="center">
                <Illustration name="budget_plate" width={300} />
              </Row>
              {goals}
            </>
          ) : (
            <>
              <Title size="titleXL" tone="ink">{"No budgets\nyet"}</Title>
              <RichText tone="ink">{`Nothing is budgeted for {dark:${escapeRich(monthLabel)}}. Set one, or copy last month's.`}</RichText>
              <PrimaryButton label="Set a budget" icon={Plus} onPress={() => setSheet("more")} />
              <Row justify="center">
                <Illustration name="budget_plate" width={300} />
              </Row>
              {goals}
            </>
          )}
        </EnvelopeFront>
      </EnvelopeStack>

      <OptionSheet
        visible={sheet === "month"}
        title="Month"
        groups={monthGroups}
        value={monthKey(period.month, period.year)}
        onSelect={(key) => {
          setPeriod(months.find((m) => monthKey(m.month, m.year) === key) ?? now);
          setTapped([]);
          setCopyResult(null);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === "more"}
        title="Set a budget"
        groups={moreGroups}
        value=""
        onSelect={(id) => {
          setSheet(null);
          openSet(id);
        }}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}
