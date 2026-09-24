import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { isValidRange, rangeFor, relativeDayLabel, todayLocal, type DateRange, type RangeKind } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { flattenPages, groupByDay, matchesSearch, type DaySection } from "@/lib/ledger";
import { profileQuery, transactionsListQuery, type TransactionFilters } from "@/lib/queries";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import {
  Amount,
  Banner,
  Button,
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

export default function TransactionsTab() {
  const router = useRouter();
  const [type, setType] = useState<TypeFilter>("all");
  const [range, setRange] = useState<RangeKind>("this_month");
  const [custom, setCustom] = useState<DateRange>(() => rangeFor("this_month"));
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const query = useDebouncedValue(search.trim(), 300);

  // Dates are always explicit and computed on the phone: the server's own
  // "this month" follows its UTC clock, not the user's calendar.
  const dates = range === "custom" ? custom : rangeFor(range);
  const validRange = isValidRange(dates);
  const filters: TransactionFilters = { type: type === "all" ? undefined : type, ...dates };

  const list = useInfiniteQuery({ ...transactionsListQuery(filters), enabled: validRange });
  const profile = useQuery(profileQuery);
  useRefetchStaleOnFocus();

  const currency = profile.data?.currency ?? "INR";
  const rows = flattenPages(list.data?.pages ?? []);
  const shown = query ? rows.filter((tx) => matchesSearch(tx, query)) : rows;
  const sections = groupByDay(shown);
  const today = todayLocal();

  const refresh = async () => {
    if (refreshing) return; // ignore a second pull while one is running
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
      <Segmented options={TYPES} value={type} onChange={setType} />
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
    <Screen title="Transactions" scroll={false} insetBottom={false}>
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
