import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { currentMonth, isValidRange, monthShift, rangeFor, relativeDayLabel, todayLocal, type DateRange, type RangeKind } from "@/lib/dates";
import { formatDate, formatMinor } from "@/lib/format";
import { flattenPages, groupByDay, matchesSearch, type DaySection } from "@/lib/ledger";
import { categoriesQuery, monthIncomeQuery, profileQuery, transactionsListQuery, type TransactionFilters } from "@/lib/queries";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import {
  Amount,
  Banner,
  Button,
  Chips,
  DateField,
  EmptyState,
  ErrorState,
  Input,
  Row,
  Screen,
  SectionedList,
  SectionHeader,
  Segmented,
  Skeleton,
  Stack,
  Text,
  TransactionRow,
} from "@/ui";

type TypeFilter = "all" | "expense" | "income";

const TYPES = [
  { label: "All", value: "all" },
  { label: "Expenses", value: "expense" },
  { label: "Income", value: "income" },
] as const;

const RANGES = [
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "3 months", value: "last_3_months" },
  { label: "Custom", value: "custom" },
] as const;

// The chip that means "every category". Empty string can never be a real category id.
const ALL_CATEGORIES = "";
const VISIBLE_CATEGORIES = 4;

export default function TransactionsTab() {
  const router = useRouter();
  const [type, setType] = useState<TypeFilter>("all");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [range, setRange] = useState<RangeKind>("this_month");
  const [custom, setCustom] = useState<DateRange>(() => rangeFor("this_month"));
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const query = useDebouncedValue(search.trim(), 300);

  // Categories are per type, so switching type drops whatever category was picked.
  const changeType = (next: TypeFilter) => {
    setType(next);
    setCategoryId(null);
    setCategoriesExpanded(false);
  };

  // Dates are always explicit and computed on the phone: the server's own
  // "this month" follows its UTC clock, not the user's calendar.
  const dates = range === "custom" ? custom : rangeFor(range);
  const validRange = isValidRange(dates);
  const filters: TransactionFilters = { type: type === "all" ? undefined : type, category_id: categoryId ?? undefined, ...dates };

  const list = useInfiniteQuery({ ...transactionsListQuery(filters), enabled: validRange });
  const profile = useQuery(profileQuery);
  const categoriesForType = useQuery({ ...categoriesQuery(type === "income" ? "income" : "expense"), enabled: type !== "all" });
  useRefetchStaleOnFocus();

  const currency = profile.data?.currency ?? "INR";
  const rows = flattenPages(list.data?.pages ?? []);
  const shown = query ? rows.filter((tx) => matchesSearch(tx, query)) : rows;
  const sections = groupByDay(shown);
  const today = todayLocal();

  const activeCategories = categoriesForType.data?.categories.filter((c) => c.is_active) ?? [];
  const visibleCategories = categoriesExpanded ? activeCategories : activeCategories.slice(0, VISIBLE_CATEGORIES);
  const categoryChipOptions = [{ label: "All", value: ALL_CATEGORIES }, ...visibleCategories.map((c) => ({ label: c.name, value: c.id }))];

  // ponytail: there is no range-analytics endpoint, only whole-month, so the money
  // breakdown only shows for this/last month and only with no category narrowing it.
  const summaryMonth = range === "this_month" ? currentMonth() : range === "last_month" ? monthShift(currentMonth().month, currentMonth().year, -1) : null;
  const showMonthlyBreakdown = summaryMonth !== null && !categoryId;
  const monthly = useQuery({ ...monthIncomeQuery(summaryMonth ?? currentMonth()), enabled: showMonthlyBreakdown });

  const total = list.data?.pages[0]?.total;
  const entriesText = total !== undefined ? `${total} ${total === 1 ? "entry" : "entries"}` : null;
  const summaryText =
    entriesText === null
      ? null
      : showMonthlyBreakdown && monthly.data
        ? type === "expense"
          ? `${entriesText} · ${formatMinor(monthly.data.expenses, currency)} spent`
          : type === "income"
            ? `${entriesText} · ${formatMinor(monthly.data.income, currency)} in`
            : `${entriesText} · ${formatMinor(monthly.data.expenses, currency)} spent · ${formatMinor(monthly.data.income, currency)} in`
        : entriesText;

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

  const openTransaction = (id: string) => router.push(`/transaction/${id}`);

  const header = (
    <Stack>
      <Segmented options={TYPES} value={type} onChange={changeType} />
      {type !== "all" && activeCategories.length > 0 ? (
        <Stack gap="xs">
          <Chips
            label="Category"
            options={categoryChipOptions}
            value={categoryId ?? ALL_CATEGORIES}
            onChange={(next) => setCategoryId(next && next !== ALL_CATEGORIES ? next : null)}
          />
          {activeCategories.length > VISIBLE_CATEGORIES ? (
            <Button
              title={categoriesExpanded ? "Fewer" : "More"}
              variant="link"
              onPress={() => setCategoriesExpanded((e) => !e)}
            />
          ) : null}
        </Stack>
      ) : null}
      <Segmented options={RANGES} value={range} onChange={setRange} />
      {range === "custom" ? (
        <Row align="start">
          <Stack grow>
            <DateField label="From" value={custom.date_from} onChange={(date_from) => setCustom({ ...custom, date_from })} />
          </Stack>
          <Stack grow>
            <DateField label="To" value={custom.date_to} onChange={(date_to) => setCustom({ ...custom, date_to })} />
          </Stack>
        </Row>
      ) : null}
      {validRange ? null : <Banner tone="warning" message="The end date is before the start date." />}
      {summaryText ? (
        <Text variant="caption" tone="muted">
          {summaryText}
        </Text>
      ) : null}
      <Input
        label="Search"
        value={search}
        onChangeText={setSearch}
        placeholder="Payee, category, description or notes"
        autoCorrect={false}
        returnKeyType="search"
      />
      {/* Search only sees what has been loaded, so say so instead of showing a false "no results". */}
      {query && list.hasNextPage ? (
        <Text variant="caption" tone="muted">
          {`Searching the ${rows.length} transactions loaded so far. Scroll down to load more.`}
        </Text>
      ) : null}
      {list.isError && list.data && !list.isFetchNextPageError ? (
        <Banner tone="warning" message="Couldn't refresh. Showing what we have." />
      ) : null}
    </Stack>
  );

  const empty =
    list.isPending && validRange ? (
      <Stack>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={44} />
        ))}
      </Stack>
    ) : list.isError && !list.data ? (
      <ErrorState message={userMessage(list.error, "load your transactions")} onRetry={() => list.refetch()} />
    ) : query ? (
      <EmptyState
        icon="search-outline"
        title="No matches"
        message={list.hasNextPage ? "Nothing loaded so far matches. Scroll down to load more." : "Nothing matches that search."}
      />
    ) : (
      <EmptyState
        icon="receipt-outline"
        title="No transactions"
        message="Nothing here for these filters yet."
        actionLabel="Add transaction"
        onAction={() => router.push("/add-transaction")}
      />
    );

  const footer = list.isFetchingNextPage ? (
    <Skeleton height={44} />
  ) : list.isFetchNextPageError ? (
    <Button title="Couldn't load more. Try again" variant="link" onPress={() => list.fetchNextPage()} />
  ) : null;

  return (
    <Screen title="Transactions" scroll={false} tabBar>
      <SectionedList
        sections={sections}
        keyExtractor={(tx) => tx.id}
        renderItem={(tx) => <TransactionRow tx={tx} fallbackCurrency={currency} onPress={openTransaction} />}
        renderSectionHeader={(section: DaySection) => (
          <SectionHeader title={relativeDayLabel(section.date, today) ?? formatDate(section.date, "medium")}>
            <Amount variant="caption" value={section.net / 100} currency={currency} signed />
          </SectionHeader>
        )}
        header={header}
        footer={footer}
        empty={empty}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
      />
    </Screen>
  );
}
