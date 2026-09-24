import {
  infiniteQueryOptions,
  queryOptions,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "./api";
import { findInPages } from "./ledger";
import { suggestedCategory, type PickedCategory } from "./transactionForm";
import type { CategoryType, TransactionType, TransactionsResponse } from "./types";

// Every query the app makes is declared here, and every screen reads server data
// through these options or the hooks below, never through `api` directly. The
// key shapes below are the cache layout, and `invalidateAfter` is the only place
// that knows which screens a write makes stale.

const FIVE_MINUTES = 5 * 60_000;
export const PAGE_SIZE = 20;

// Shared by the Dashboard, Settings and the post-signup provisioning call.
// Every caller goes through this one key, so React Query sends a single request
// and everyone shares the result (the backend also tolerates a race on the first read).
export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: () => api.getProfile(),
  staleTime: 10 * 60_000,
});

export type DashboardPeriod = "this_month" | "last_month";

export const dashboardQuery = (period: DashboardPeriod) =>
  queryOptions({
    queryKey: ["dashboard", period],
    queryFn: () => api.getDashboard(period),
  });

// ── Transactions ────────────────────────────────────────────────

export type TransactionFilters = {
  /** Omitted = expenses, income and starting balances. */
  type?: "expense" | "income";
  date_from: string;
  date_to: string;
};

export const recentTransactionsQuery = queryOptions({
  queryKey: ["transactions", "recent"],
  queryFn: () => api.listTransactions({ limit: 3 }),
});

export const transactionsListQuery = (filters: TransactionFilters) =>
  infiniteQueryOptions({
    queryKey: ["transactions", "list", filters],
    queryFn: ({ pageParam }) =>
      api.listTransactions({
        transaction_type: filters.type,
        date_from: filters.date_from,
        date_to: filters.date_to,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.count > 0 && last.offset + last.limit < last.total ? last.offset + last.limit : undefined),
  });

export const transactionDetailKey = (id: string) => ["transactions", "detail", id] as const;

export const transactionDetailQuery = (id: string) =>
  queryOptions({
    queryKey: transactionDetailKey(id),
    queryFn: () => api.getTransaction(id),
  });

/** Opens from any cached list instantly, then always confirms with a GET. */
export function useTransactionDetail(id: string, enabled = true) {
  const queryClient = useQueryClient();
  return useQuery({
    ...transactionDetailQuery(id),
    enabled,
    staleTime: 0,
    initialData: () =>
      findInPages(
        queryClient
          .getQueriesData<InfiniteData<TransactionsResponse>>({ queryKey: ["transactions", "list"] })
          .map(([, data]) => data),
        id
      ),
  });
}

const lastTransactionForPayeeQuery = (payeeId: string) =>
  queryOptions({
    queryKey: ["transactions", "lastForPayee", payeeId],
    queryFn: () => api.listTransactions({ payee_id: payeeId, limit: 1 }),
    staleTime: FIVE_MINUTES,
  });

/**
 * Returns a function that suggests a category once a payee is picked: the one
 * used on that payee's latest transaction (cached per payee, nothing stored on
 * the phone). Best effort: any failure just means no suggestion.
 */
export function useSuggestCategory() {
  const queryClient = useQueryClient();
  return async (payeeId: string, categories: readonly PickedCategory[], type: TransactionType): Promise<PickedCategory | null> => {
    try {
      const { transactions } = await queryClient.fetchQuery(lastTransactionForPayeeQuery(payeeId));
      return suggestedCategory(transactions[0], categories, type);
    } catch {
      return null;
    }
  };
}

// ── Categories and payees ───────────────────────────────────────

export const categoriesQuery = (type: CategoryType) =>
  queryOptions({
    queryKey: ["categories", type],
    queryFn: () => api.listCategories(type),
    staleTime: FIVE_MINUTES,
  });

export const payeesQuery = (type: CategoryType) =>
  queryOptions({
    queryKey: ["payees", type],
    queryFn: () => api.listPayees(type),
    staleTime: FIVE_MINUTES,
  });

// ── Invalidation ────────────────────────────────────────────────

export type Change =
  | { kind: "transaction" }
  | { kind: "category" | "payee"; type: CategoryType };

/**
 * Marks stale everything a write can affect, and refetches what is on screen.
 * Deliberately not awaited by the mutations: the form closes as soon as the
 * server answers, and the lists behind it refresh in the background.
 */
export function invalidateAfter(queryClient: QueryClient, change: Change): Promise<unknown> {
  const invalidate = (queryKey: readonly unknown[]) => queryClient.invalidateQueries({ queryKey });
  switch (change.kind) {
    case "transaction":
      // A transaction moves balances, budgets' spent/remaining and every report.
      return Promise.all([invalidate(["transactions"]), invalidate(["dashboard"]), invalidate(["budgets"]), invalidate(["analytics"])]);
    case "category":
      return invalidate(["categories", change.type]);
    case "payee":
      return invalidate(["payees", change.type]);
  }
}
