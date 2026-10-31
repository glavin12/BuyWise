import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { currentMonth, loggedTime, monthBounds, monthKey, monthShift, monthUpTo, relativeDayLabel, todayLocal, type MonthYear } from "@/lib/dates";
import { formatCurrency, formatDate, formatMinor, formatMonth, formatMonthShort } from "@/lib/format";
import { wholeIfRound } from "@/lib/home";
import { METHOD_LABEL, TYPE_LABEL } from "@/lib/labels";
import { flattenPages, groupByDay, matchesSearch, type DaySection } from "@/lib/ledger";
import { categoriesQuery, profileQuery, transactionsListQuery } from "@/lib/queries";
import { escapeRich } from "@/lib/richText";
import type { Transaction } from "@/lib/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import {
  Banner,
  CategoryTile,
  Chip,
  DayHeader,
  IconTile,
  Note,
  OptionSheet,
  Panel,
  Pill,
  PrimaryButton,
  RichText,
  Row,
  Screen,
  SearchField,
  SectionedList,
  showToast,
  Skeleton,
  Stack,
  Title,
  TxRow,
  type OptionGroup,
} from "@/ui";
import { LayoutGrid, Plus } from "@/ui/icons";

// Activity (design/screens/03-activity.png, values from design/reference-html/Transactions.html):
// title + "Log" pill (opens Quick Add), search, type chips, then the category and month pills, count,
// day groups with their net. The filters live in the URL (`type`, `category`, `month` as YYYY-MM), so
// another screen can open it already filtered.

type TypeFilter = "all" | "expense" | "income";

const TYPES = [
  { label: "All", value: "all" },
  { label: "Expenses", value: "expense" },
  { label: "Income", value: "income" },
] as const;

const MONTHS_BACK = 12;
// The "every category" choice in the sheet. An empty string can never be a real category id.
const ALL_CATEGORIES = "";

export default function ActivityTab() {
  const router = useRouter();
  const now = currentMonth();
  const params = useLocalSearchParams<{ type?: string; category?: string; month?: string }>();
  const months = Array.from({ length: MONTHS_BACK }, (_, i) => monthShift(now.month, now.year, -i));
  const type: TypeFilter = TYPES.find((t) => t.value === params.type)?.value ?? "all";
  const categoryId = params.category || null;
  // Any month up to this one, also one older than the sheet's year (Reports can open one); anything else shows this month.
  const month: MonthYear = monthUpTo(params.month, now);
  const setCategoryId = (id: string | null) => router.setParams({ category: id ?? undefined });
  const setMonth = (m: MonthYear) => router.setParams({ month: monthKey(m.month, m.year) });
  const [sheet, setSheet] = useState<"category" | "month" | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const query = useDebouncedValue(search.trim(), 300);

  // Dates are explicit and computed on the phone: the server's "this month" follows its UTC clock.
  const list = useInfiniteQuery(
    transactionsListQuery({ type: type === "all" ? undefined : type, category_id: categoryId ?? undefined, ...monthBounds(month.month, month.year) }),
  );
  const profile = useQuery(profileQuery);
  const expenseCategories = useQuery(categoriesQuery("expense"));
  const incomeCategories = useQuery(categoriesQuery("income"));
  useRefetchStaleOnFocus();

  const currency = profile.data?.currency ?? "INR";
  const rows = flattenPages(list.data?.pages ?? []);
  const shown = query ? rows.filter((tx) => matchesSearch(tx, query)) : rows;
  const sections = groupByDay(shown);
  const today = todayLocal();

  const active = (data: typeof expenseCategories.data) => data?.categories.filter((c) => c.is_active) ?? [];
  const expense = active(expenseCategories.data);
  const income = active(incomeCategories.data);
  const picked = [...expense, ...income].find((c) => c.id === categoryId);

  // A picked category of the other type would filter everything out, so it goes.
  const changeType = (next: TypeFilter) =>
    router.setParams({ type: next, ...(picked && next !== "all" && picked.type !== next ? { category: undefined } : {}) });

  const categoryGroups: OptionGroup[] = [
    {
      options: [
        {
          value: ALL_CATEGORIES,
          label: "All categories",
          tile: <IconTile icon={LayoutGrid} color="sage" size={44} />,
        },
      ],
    },
    ...(type !== "income"
      ? [
          {
            title: "Expenses",
            options: expense.map((c) => ({
              value: c.id,
              label: c.name,
              icon: c.icon,
              color: c.color,
            })),
          },
        ]
      : []),
    ...(type !== "expense"
      ? [
          {
            title: "Income",
            options: income.map((c) => ({
              value: c.id,
              label: c.name,
              icon: c.icon,
              color: c.color,
            })),
          },
        ]
      : []),
  ];

  const openCategories = () => {
    const failed = [expenseCategories, incomeCategories].find((q) => q.isError && !q.data);
    if (failed) {
      showToast(userMessage(failed.error, "load your categories"));
      void failed.refetch();
      return;
    }
    setSheet("category");
  };

  const monthGroups: OptionGroup[] = [{ options: months.map((m) => ({ value: monthKey(m.month, m.year), label: formatMonth(m.month, m.year) })) }];

  const total = list.data?.pages[0]?.total;
  const found =
    total === undefined
      ? null
      : query
        ? list.hasNextPage
          ? `${shown.length} found in the ${rows.length} loaded so far. Scroll for more.`
          : `${shown.length} found`
        : `${total} ${total === 1 ? "transaction" : "transactions"} found`;

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await list.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = () => {
    if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
  };

  const header = (
    <Stack gap="md">
      <Row justify="between">
        <Title>Activity</Title>
        <Chip label="Log" icon={Plus} accessibilityLabel="Log a transaction" onPress={() => router.push("/add-transaction")} />
      </Row>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search by payee or note" label="Search transactions" />
      <Stack gap="sm">
        <Row gap="xs">
          {TYPES.map((t) => (
            <Chip key={t.value} label={t.label} variant={type === t.value ? "cream" : "card"} selected={type === t.value} onPress={() => changeType(t.value)} />
          ))}
        </Row>
        {/* Category and month together, on their own line: at the 12.5 chip size the five never fit one phone line. */}
        <Row gap="xs">
          <Pill
            variant={picked ? "cream" : "outlinedDark"}
            label={picked?.name ?? "Category"}
            accessibilityLabel={`Category: ${picked?.name ?? "all"}`}
            onPress={openCategories}
          />
          <Pill
            variant="outlinedDark"
            label={formatMonthShort(month.month, month.year, now.year)}
            accessibilityLabel={`Month: ${formatMonth(month.month, month.year)}`}
            onPress={() => setSheet("month")}
          />
        </Row>
      </Stack>
      {found ? <Note>{found}</Note> : null}
      {/* C8: a refresh failed but rows are cached, so keep showing them. */}
      {list.isError && list.data && !list.isFetchNextPageError ? <Banner tone="warning" message="Couldn't refresh. Showing what we have." /> : null}
    </Stack>
  );

  const empty = list.isPending ? (
    <Stack gap="sm">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} tone="dark" height={82} round="row" />
      ))}
    </Stack>
  ) : list.isError && !list.data ? (
    <Panel>
      <Stack gap="md">
        <Title size="cardTitle">{"Can't load\nactivity"}</Title>
        <RichText tone="card">{escapeRich(userMessage(list.error, "load your transactions"))}</RichText>
        <PrimaryButton label="Try again" onPress={() => list.refetch()} />
      </Stack>
    </Panel>
  ) : query ? (
    <Panel>
      <RichText tone="card">{list.hasNextPage ? "Nothing loaded so far matches. Scroll down to load more." : "Nothing matches that search."}</RichText>
    </Panel>
  ) : (
    <Panel>
      <Stack gap="md">
        <RichText tone="card">
          {`Nothing logged in ${escapeRich(formatMonth(month.month, month.year))}${type !== "all" || picked ? " for these filters" : ""}. Add one here, or hold the centre button any time.`}
        </RichText>
        <PrimaryButton label="Add transaction" icon={Plus} onPress={() => router.push("/add-transaction")} />
      </Stack>
    </Panel>
  );

  const footer = list.isFetchingNextPage ? (
    <Skeleton tone="dark" height={82} round="row" />
  ) : list.isFetchNextPageError ? (
    <RichText links={{ retry: () => list.fetchNextPage() }}>{"Couldn't load more. {dark@retry:Try again}"}</RichText>
  ) : null;

  return (
    <Screen surface="screen" tabBar scroll={false}>
      <SectionedList
        sections={sections}
        keyExtractor={(tx) => tx.id}
        renderItem={(tx) => <ActivityRow tx={tx} currency={currency} onPress={() => router.push(`/transaction/${tx.id}`)} />}
        renderSectionHeader={(section: DaySection) => (
          <DayHeader
            label={relativeDayLabel(section.date, today) ?? formatDate(section.date, "medium")}
            net={`${section.net < 0 ? "−" : section.net > 0 ? "+" : ""}${wholeIfRound(formatMinor(Math.abs(section.net), currency))}`}
            kind={section.net < 0 ? "coral" : section.net > 0 ? "mint" : "dark"}
          />
        )}
        header={header}
        footer={footer}
        empty={empty}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
      />
      <OptionSheet
        visible={sheet === "category"}
        title="Category"
        groups={categoryGroups}
        value={categoryId ?? ALL_CATEGORIES}
        searchable
        searchPlaceholder="Search categories"
        onSelect={(id) => {
          setCategoryId(id === ALL_CATEGORIES ? null : id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === "month"}
        title="Month"
        groups={monthGroups}
        value={monthKey(month.month, month.year)}
        onSelect={(key) => {
          setMonth(months.find((m) => monthKey(m.month, m.year) === key) ?? now);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

/** Payee, then "note · method · time", the category tag, the signed amount (income in mint). */
function ActivityRow({ tx, currency, onPress }: { tx: Transaction; currency: string; onPress: () => void }) {
  const title = tx.payee || tx.category || TYPE_LABEL[tx.transaction_type];
  // With no payee the category is already the title, so it isn't repeated as the tag.
  const tag = tx.payee ? tx.category : null;
  const meta = [tx.description, tx.payment_method && METHOD_LABEL[tx.payment_method], loggedTime(tx.created_at, tx.transaction_date)]
    .filter(Boolean)
    .join(" · ");
  const money = wholeIfRound(formatCurrency(tx.display_amount, tx.currency || currency));
  const sign = tx.transaction_type === "expense" ? "−" : tx.transaction_type === "income" ? "+" : "";
  const spoken = tx.transaction_type === "expense" ? "spent" : tx.transaction_type === "income" ? "received" : "starting balance";

  return (
    <TxRow
      tile={<CategoryTile name={tx.category} icon={tx.category_icon} size={46} />}
      title={title}
      meta={meta}
      tag={tag}
      amount={`${sign}${money}`}
      tone={tx.transaction_type === "income" ? "mint" : "text"}
      label={[title, `${spoken} ${money}`, tag, meta].filter(Boolean).join(", ")}
      onPress={onPress}
    />
  );
}
