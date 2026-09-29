import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowUpRight, Bell, Calendar, Plus, Search } from "lucide-react-native";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { currentMonth, monthShift, todayLocal } from "@/lib/dates";
import { formatCurrency, formatMinor, formatMonth } from "@/lib/format";
import {
  balanceSentence,
  compactMoney,
  currencySymbol,
  dailyBudget,
  dailySpend,
  pulsePercents,
  splitFraction,
  topCategories,
  weekOf,
  wholeIfRound,
} from "@/lib/home";
import { sumMinor } from "@/lib/money";
import {
  dashboardQuery,
  expensesInRangeQuery,
  monthBudgetsQuery,
  profileQuery,
  recentTransactionsQuery,
  type DashboardPeriod,
} from "@/lib/queries";
import { escapeRich } from "@/lib/richText";
import type { Transaction } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import { useAuth } from "@/providers/AuthProvider";
import {
  AreaChart,
  Banner,
  CategoryTile,
  categoryTone,
  Chip,
  CircleButton,
  HeroAmount,
  IconTile,
  Illustration,
  MiniTile,
  Panel,
  Pill,
  PressableScale,
  PrimaryButton,
  PulseBubbles,
  RichText,
  Row,
  Screen,
  SectionLabel,
  showToast,
  Skeleton,
  Stack,
  Title,
} from "@/ui";

// Home (design/screens/02-home.png, values from design/reference-html/Dashboard.html):
// greeting, month pill, balance card, Spend Pulse, three recent tiles.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("this_month");
  const [weeksBack, setWeeksBack] = useState<0 | 1>(0);
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const today = todayLocal();
  const now = currentMonth();
  const week = weekOf(today, weeksBack);

  const dashboard = useQuery(dashboardQuery(period));
  const recent = useQuery(recentTransactionsQuery);
  const profile = useQuery(profileQuery);
  const expenses = useQuery(expensesInRangeQuery({ date_from: week[0], date_to: week[6] }));
  // The daily budget comes from this month's budgets, whichever week is shown.
  const budgets = useQuery(monthBudgetsQuery(now));
  useRefetchStaleOnFocus();

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await Promise.all([dashboard.refetch(), recent.refetch(), profile.refetch(), expenses.refetch(), budgets.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const data = dashboard.data;
  const currency = data?.currency ?? profile.data?.currency ?? "INR";
  const money = (display: number) => wholeIfRound(formatCurrency(display, currency));
  const name = profile.data?.full_name?.trim().split(/\s+/)[0] || session?.user.email?.split("@")[0] || "there";
  const shownMonth = period === "this_month" ? now : monthShift(now.month, now.year, -1);

  return (
    <Screen surface="screen" tabBar onRefresh={refresh} refreshing={refreshing}>
      <Row justify="between">
        <PressableScale onPress={() => router.navigate("/profile")} accessibilityLabel={`Hi, ${name}! Open your profile`}>
          <Row gap="md">
            <Illustration name="avatar_user" width={42} />
            <RichText>{`Hi, ${escapeRich(name)}!`}</RichText>
          </Row>
        </PressableScale>
        <Row gap="sm">
          <CircleButton icon={Search} variant="outline" label="Search transactions" onPress={() => router.navigate("/transactions")} />
          <CircleButton icon={Bell} variant="outline" label="Alerts" onPress={() => showToast("Notifications — coming soon")} />
        </Row>
      </Row>

      {/* The API only has this month and last month, so the dropdown flips between the two. */}
      <Pill
        knob
        icon={Calendar}
        label={formatMonth(shownMonth.month, shownMonth.year)}
        onPress={() => setPeriod(period === "this_month" ? "last_month" : "this_month")}
      />

      {/* C8: a background refresh failed but cached numbers exist, so keep showing them. */}
      {data && dashboard.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known numbers." /> : null}

      {data ? (
        <Panel>
          <Stack gap="sm">
            <Row justify="between">
              <Row gap="md">
                <IconTile icon={currencySymbol(currency)} color="marigold" />
                <Title size="cardTitle">{"Total\nbalance"}</Title>
              </Row>
              <CircleButton icon={ArrowUpRight} size={38} label="Open reports" onPress={() => router.push("/reports")} />
            </Row>
            <HeroAmount {...toParts(formatCurrency(data.display_current_balance, currency))} />
            <RichText
              tone="card"
              links={{
                budget: () => router.navigate("/budget"),
                goals: () => router.push(data.active_goals_count > 0 ? "/goals" : "/goals/new"),
              }}
            >
              {balanceSentence(data, period === "this_month" ? "this month" : "last month", money)}
            </RichText>
          </Stack>
        </Panel>
      ) : dashboard.isError ? (
        // C8: the API is down and there is nothing cached to show.
        <Panel>
          <Stack gap="md">
            <Title size="cardTitle">{"Can't reach\nBuyWise"}</Title>
            <RichText tone="card">{escapeRich(userMessage(dashboard.error, "load your balance"))}</RichText>
            <PrimaryButton label="Try again" onPress={() => dashboard.refetch()} />
          </Stack>
        </Panel>
      ) : (
        <Panel>
          <Stack gap="sm">
            <Row gap="md">
              <Skeleton tone="dark" width={44} height={44} round="tile" />
              <Skeleton tone="dark" width={90} height={36} />
            </Row>
            <Skeleton tone="dark" width="65%" height={40} />
            <Skeleton tone="dark" height={14} />
            <Skeleton tone="dark" width="70%" height={14} />
          </Stack>
        </Panel>
      )}

      <Panel color="peri" large>
        <Stack gap="md">
          <Row justify="between" align="start">
            <Title size="panelTitle">{"Spend\npulse"}</Title>
            <Pill variant="peri" label={weeksBack ? "last week" : "this week"} onPress={() => setWeeksBack(weeksBack ? 0 : 1)} />
          </Row>
          {expenses.data && !budgets.isPending ? (
            <SpendPulse
              rows={expenses.data}
              week={week}
              isThisWeek={weeksBack === 0}
              today={today}
              monthBudget={budgets.data?.budgets ?? []}
              month={now}
              currency={currency}
              picked={pickedCategory}
              onPick={setPickedCategory}
            />
          ) : expenses.isError ? (
            <RichText links={{ retry: () => expenses.refetch() }}>{"Couldn't load this week. {dark@retry:Try again}"}</RichText>
          ) : (
            <Stack gap="md">
              <Skeleton tone="light" height={56} round="card" />
              <Skeleton tone="light" height={96} round="card" />
            </Stack>
          )}
        </Stack>
      </Panel>

      <SectionLabel label="Recent" link="see all →" onLink={() => router.navigate("/transactions")} />
      {recent.data ? (
        recent.data.transactions.length > 0 ? (
          <Row gap="sm">
            {recent.data.transactions.map((tx) => (
              <RecentTile key={tx.id} tx={tx} currency={currency} onPress={() => router.push(`/transaction/${tx.id}`)} />
            ))}
          </Row>
        ) : (
          // D1: a brand-new user with no transactions.
          <Panel>
            <Stack gap="md">
              <RichText tone="card">{"Nothing logged yet. Add your first expense, or hold the {hi:+} button below any time."}</RichText>
              <PrimaryButton label="Add transaction" icon={Plus} onPress={() => router.push("/add-transaction")} />
            </Stack>
          </Panel>
        )
      ) : recent.isError ? (
        <RichText links={{ retry: () => recent.refetch() }}>{"Couldn't load recent transactions. {dark@retry:Try again}"}</RichText>
      ) : (
        <Row gap="sm">
          {[0, 1, 2].map((i) => (
            <Stack key={i} grow>
              <Skeleton tone="dark" height={52} round="row" />
            </Stack>
          ))}
        </Row>
      )}
    </Screen>
  );
}

function toParts(formatted: string) {
  const [whole, fraction] = splitFraction(formatted);
  return { whole, fraction };
}

/** The Spend Pulse body: day bubbles, the area chart and the category legend (which filters both). */
function SpendPulse({
  rows,
  week,
  isThisWeek,
  today,
  monthBudget,
  month,
  currency,
  picked,
  onPick,
}: {
  rows: Transaction[];
  week: string[];
  isThisWeek: boolean;
  today: string;
  monthBudget: { category_id: string; budgeted_amount: number }[];
  month: { month: number; year: number };
  currency: string;
  picked: string | null;
  onPick: (id: string | null) => void;
}) {
  const top = topCategories(rows, 3);
  // A category picked on another week may not be in this week's top three.
  const category = top.find((c) => c.id === picked) ?? null;
  const values = dailySpend(rows, week, category?.id);
  const budgeted = sumMinor(monthBudget.filter((b) => !category || b.category_id === category.id).map((b) => b.budgeted_amount));
  // ponytail: the daily budget is this month's, even for a week that started last month.
  const { percents, of } = pulsePercents(values, dailyBudget(budgeted, month.month, month.year));
  const upto = isThisWeek ? week.indexOf(today) : 6;
  const spent = wholeIfRound(formatMinor(values[upto], currency));

  return (
    <>
      <PulseBubbles
        of={of}
        days={week.map((_, i) => ({ label: WEEKDAYS[i], percent: i <= upto ? percents[i] : null, today: isThisWeek && i === upto }))}
      />
      <AreaChart
        values={values}
        upto={upto}
        focus={upto}
        tooltip={`${spent} ${isThisWeek ? "today" : "Sun"}`}
        label={`${category ? category.name : "All"} spending ${isThisWeek ? "this" : "last"} week: ${wholeIfRound(formatMinor(sumMinor(values), currency))}`}
      />
      <Row gap="xs" wrap>
        <Chip label="All spend" dot="tomato" variant={category ? "translucent" : "cream"} selected={!category} onPress={() => onPick(null)} />
        {top.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            dot={categoryTone(c.name)}
            variant={category?.id === c.id ? "cream" : "translucent"}
            selected={category?.id === c.id}
            onPress={() => onPick(category?.id === c.id ? null : c.id)}
          />
        ))}
      </Row>
    </>
  );
}

function RecentTile({ tx, currency, onPress }: { tx: Transaction; currency: string; onPress: () => void }) {
  const name = tx.payee || tx.category || "Starting balance";
  const sign = tx.transaction_type === "expense" ? "−" : tx.transaction_type === "income" ? "+" : "";
  return (
    <MiniTile
      tile={<CategoryTile name={tx.category} icon={tx.category_icon} size={30} />}
      name={name}
      amount={`${sign}${compactMoney(tx.amount, tx.currency || currency)}`}
      tone={tx.transaction_type === "income" ? "mint" : "text"}
      label={`${name}, ${sign}${formatCurrency(tx.display_amount, tx.currency || currency)}`}
      onPress={onPress}
    />
  );
}
