import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Copy, Plus, RotateCw, Sparkles } from "lucide-react-native";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { budgetRow, byAssigned, carriedRow, copySummary, readyLine, unbudgetedCategories } from "@/lib/budget";
import { currentMonth, monthKey, monthShift, type MonthYear } from "@/lib/dates";
import { formatMinor, formatMonth, formatMonthShort } from "@/lib/format";
import { wholeIfRound } from "@/lib/home";
import { useCopyBudgets } from "@/lib/mutations";
import { categoriesQuery, monthBudgetsQuery, monthIncomeQuery, profileQuery, usePlanBudgetCopy } from "@/lib/queries";
import { escapeRich } from "@/lib/richText";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import {
  Banner,
  BudgetRow,
  BudgetTable,
  categoryTone,
  Chip,
  confirm,
  hapticSuccess,
  OptionSheet,
  Panel,
  Pill,
  PillButton,
  PrimaryButton,
  ReadyCard,
  RichText,
  Row,
  Screen,
  SecondaryButton,
  showToast,
  Stack,
  Title,
  type OptionGroup,
} from "@/ui";

// Budget (the owner's list mockup, 2026-09-29): title and month pill, the marigold "ready to assign"
// card with "Copy <last month>" (Auto-assign is a "coming soon" chip), opening / income / spent /
// closing chips (the month's slice of the one running balance), then the categories with a budget,
// most assigned first, then those that only carry money in. Budgets roll over: Available is what
// earlier months left (or overspent) plus this month's budget minus this month's spending, and
// "ready to assign" is the closing balance minus the money in every envelope; both come from the API.
// At the end, how many categories still have no budget, with a way to set one.

const MONTHS_AHEAD = 3;
const MONTHS_BACK = 11;

export default function BudgetTab() {
  const router = useRouter();
  const now = currentMonth();
  const [period, setPeriod] = useState<MonthYear>(now);
  const [sheet, setSheet] = useState<"month" | "more" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copyResult, setCopyResult] = useState<{ tone: "info" | "warning"; message: string } | null>(null);

  const budgets = useQuery(monthBudgetsQuery(period));
  const summary = useQuery(monthIncomeQuery(period));
  const categories = useQuery(categoriesQuery("expense"));
  const profile = useQuery(profileQuery);
  const planCopy = usePlanBudgetCopy();
  const copy = useCopyBudgets();
  useRefetchStaleOnFocus();

  const currency = profile.data?.currency ?? "INR";
  const money = (minor: number) => wholeIfRound(formatMinor(minor, currency));
  const signedMoney = (minor: number) => `${minor < 0 ? "−" : ""}${money(Math.abs(minor))}`;
  const monthLabel = formatMonth(period.month, period.year);
  const rows = budgets.data?.budgets;
  const carried = budgets.data?.carried ?? [];
  const expenseCategories = categories.data?.categories;
  const activeIds = expenseCategories ? new Set(expenseCategories.filter((c) => c.is_active).map((c) => c.id)) : null;
  const colorOf = new Map(expenseCategories?.map((c) => [c.id, c.color]));
  const ready = budgets.data?.unassigned ?? null;
  const sorted = rows ? byAssigned(rows) : [];
  const rest = rows && expenseCategories ? unbudgetedCategories(expenseCategories, rows) : [];
  const previous = monthShift(period.month, period.year, -1);

  const months = Array.from({ length: MONTHS_AHEAD + 1 + MONTHS_BACK }, (_, i) => monthShift(now.month, now.year, MONTHS_AHEAD - i));
  const monthGroups: OptionGroup[] = [{ options: months.map((m) => ({ value: monthKey(m.month, m.year), label: formatMonth(m.month, m.year) })) }];
  const moreGroups: OptionGroup[] = [{ options: rest.map((c) => ({ value: c.id, label: c.name })) }];

  const openSet = (categoryId: string) =>
    router.push({
      pathname: "/budget/set",
      params: { categoryId, month: String(period.month), year: String(period.year) },
    });

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await Promise.all([budgets.refetch(), summary.refetch(), categories.refetch()]);
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

  const line = ready !== null ? readyLine(ready) : budgets.isError ? userMessage(budgets.error, "load this month's budget") : "";
  const left = `${rest.length} ${rest.length === 1 ? "category" : "categories"}`;

  const screen = (
    <Screen surface="screen" tabBar enter onRefresh={refresh} refreshing={refreshing}>
      <Row justify="between">
        <Title>Budget</Title>
        <Pill label={formatMonthShort(period.month, period.year, 0)} onPress={() => setSheet("month")} />
      </Row>

      <ReadyCard
        amount={ready !== null ? { to: ready, format: (n) => signedMoney(Math.round(n)) } : budgets.isError ? "—" : null}
        line={line}
        action={
          budgets.isError && !budgets.data ? (
            <PillButton label="Try again" icon={RotateCw} onPress={() => budgets.refetch()} />
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
        secondary={
          <Chip
            variant="outlined"
            icon={Sparkles}
            label="Auto-assign · soon"
            accessibilityLabel="Auto-assign, coming soon"
            onPress={() => showToast("Auto-assign — coming soon")}
          />
        }
      />

      {budgets.data && summary.data ? (
        <Row gap="xs" wrap>
          <Chip variant="card" label={`opening ${signedMoney(budgets.data.opening_balance)}`} />
          <Chip variant="card" label={`income ${money(summary.data.income)}`} />
          <Chip variant="card" label={`spent ${money(summary.data.expenses)}`} />
          <Chip variant="card" label={`closing ${signedMoney(budgets.data.closing_balance)}`} />
        </Row>
      ) : null}

      {copyResult ? <Banner tone={copyResult.tone} message={copyResult.message} /> : null}
      {rows && budgets.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known budgets." /> : null}

      {!rows ? (
        budgets.isError ? (
          <Panel>
            <Stack>
              <Title size="panelTitle">Can&apos;t load budgets</Title>
              <RichText tone="card">{escapeRich(userMessage(budgets.error, "load your budgets"))}</RichText>
              <PrimaryButton label="Try again" icon={RotateCw} onPress={() => budgets.refetch()} />
            </Stack>
          </Panel>
        ) : (
          <BudgetTable loading />
        )
      ) : sorted.length + carried.length > 0 ? (
        <BudgetTable>
          {sorted.map((b, i) => (
            <BudgetRow
              key={b.id}
              first={i === 0}
              name={b.category ?? "Unknown category"}
              dot={categoryTone(b.category, colorOf.get(b.category_id))}
              assigned={money(b.budgeted_amount)}
              state={budgetRow(b, money)}
              archived={activeIds ? !activeIds.has(b.category_id) : false}
              onPress={() => openSet(b.category_id)}
            />
          ))}
          {carried.map((c, i) => (
            <BudgetRow
              key={`carried-${c.category_id}`}
              first={sorted.length === 0 && i === 0}
              name={c.category ?? "Unknown category"}
              dot={categoryTone(c.category, colorOf.get(c.category_id))}
              assigned={money(0)}
              state={carriedRow(c, money)}
              archived={activeIds ? !activeIds.has(c.category_id) : false}
              onPress={() => openSet(c.category_id)}
            />
          ))}
        </BudgetTable>
      ) : (
        <Panel>
          <Stack>
            <Title size="panelTitle">No budgets yet</Title>
            <RichText tone="card">{`Nothing is budgeted for {dark:${escapeRich(monthLabel)}}. Set one, or copy last month's.`}</RichText>
            <PrimaryButton label="Set a budget" icon={Plus} disabled={rest.length === 0} onPress={() => setSheet("more")} />
          </Stack>
        </Panel>
      )}

      {sorted.length + carried.length > 0 && rest.length > 0 ? (
        <Panel>
          <Stack>
            <RichText tone="card">{`{hi:${left}} still left to assign.`}</RichText>
            <SecondaryButton label="Manage your budget →" surface="dark" onPress={() => setSheet("more")} />
          </Stack>
        </Panel>
      ) : null}
      <SecondaryButton label="Your goals →" surface="dark" onPress={() => router.push("/goals")} />
    </Screen>
  );

  return (
    <>
      {screen}
      {/* The modals sit outside the Screen: inside it each would take an empty slot in its entrance. */}
      <OptionSheet
        visible={sheet === "month"}
        title="Month"
        groups={monthGroups}
        value={monthKey(period.month, period.year)}
        onSelect={(key) => {
          setPeriod(months.find((m) => monthKey(m.month, m.year) === key) ?? now);
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
    </>
  );
}
