import { useMutation, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";

import { api, isNotFound } from "./api";
import { mapPages } from "./ledger";
import { invalidateAfter, transactionDetailKey } from "./queries";
import { applyPatch } from "./transactionForm";
import type { CategoryCreate, PayeeCreate, Transaction, TransactionCreate, TransactionUpdate, TransactionsResponse } from "./types";

// Every write the app makes. Screens never call `api` themselves; they call
// these, which also own cache updates and invalidation. Buttons that trigger a
// mutation are disabled while it is pending, and there is no server-side
// idempotency for transactions, so that guard is what stops a double tap.

type Lists = [readonly unknown[], InfiniteData<TransactionsResponse> | undefined][];

/**
 * Cancels in-flight transaction fetches (a refetch landing after an optimistic
 * update would overwrite it) and snapshots every cached list for rollback.
 */
async function snapshotLists(queryClient: QueryClient): Promise<Lists> {
  await queryClient.cancelQueries({ queryKey: ["transactions"] });
  return queryClient.getQueriesData<InfiniteData<TransactionsResponse>>({ queryKey: ["transactions", "list"] });
}

function restoreLists(queryClient: QueryClient, lists: Lists) {
  for (const [key, data] of lists) queryClient.setQueryData(key, data);
}

/** The server no longer has this row (deleted on another device): drop it everywhere instead of rolling back to it. */
function forgetTransaction(queryClient: QueryClient, id: string) {
  for (const [key, data] of queryClient.getQueriesData<InfiniteData<TransactionsResponse>>({ queryKey: ["transactions", "list"] })) {
    if (data) queryClient.setQueryData(key, mapPages(data, (tx) => (tx.id === id ? null : tx)));
  }
  queryClient.removeQueries({ queryKey: transactionDetailKey(id), exact: true });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TransactionCreate) => api.createTransaction(body),
    onSuccess: () => {
      void invalidateAfter(queryClient, { kind: "transaction" });
    },
  });
}

/** `view` carries the display fields a patch cannot (category and payee names) for the optimistic row. */
export type EditVars = { patch: TransactionUpdate; view: Partial<Transaction> };

export function useUpdateTransaction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patch }: EditVars) => api.updateTransaction(id, patch),
    onMutate: async ({ patch, view }) => {
      const lists = await snapshotLists(queryClient);
      const detail = queryClient.getQueryData<Transaction>(transactionDetailKey(id));
      for (const [key, data] of lists) {
        if (data) queryClient.setQueryData(key, mapPages(data, (tx) => (tx.id === id ? applyPatch(tx, patch, view) : tx)));
      }
      if (detail) queryClient.setQueryData(transactionDetailKey(id), applyPatch(detail, patch, view));
      return { lists, detail };
    },
    onError: (error, _vars, context) => {
      if (isNotFound(error)) return forgetTransaction(queryClient, id);
      if (!context) return;
      restoreLists(queryClient, context.lists);
      queryClient.setQueryData(transactionDetailKey(id), context.detail);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(transactionDetailKey(id), updated); // the server's row is the truth
    },
    onSettled: () => {
      void invalidateAfter(queryClient, { kind: "transaction" });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onMutate: async (id) => {
      const lists = await snapshotLists(queryClient);
      for (const [key, data] of lists) {
        if (data) queryClient.setQueryData(key, mapPages(data, (tx) => (tx.id === id ? null : tx)));
      }
      return { lists };
    },
    onError: (error, id, context) => {
      if (isNotFound(error)) return forgetTransaction(queryClient, id); // already gone: the delete's goal is met
      if (context) restoreLists(queryClient, context.lists);
    },
    onSettled: () => {
      void invalidateAfter(queryClient, { kind: "transaction" });
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoryCreate) => api.createCategory(data), // idempotent: an existing name returns that category
    onSuccess: (category) => {
      void invalidateAfter(queryClient, { kind: "category", type: category.type });
    },
  });
}

export function useCreatePayee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PayeeCreate) => api.createPayee(data), // idempotent: find-or-create by name
    onSuccess: (payee) => {
      void invalidateAfter(queryClient, { kind: "payee", type: payee.type });
    },
  });
}
