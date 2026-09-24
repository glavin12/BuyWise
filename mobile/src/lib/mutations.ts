import { useMutation, useMutationState, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";

import { api, isNotFound, stopsBatch } from "./api";
import { copyBudgets } from "./budget";
import { changesFromTools } from "./chat";
import type { MonthYear } from "./dates";
import { placeGoal } from "./goals";
import { mapPages, type BudgetCopyPlan } from "./ledger";
import { conversationsQuery, GOAL_LISTS, goalsQuery, invalidateAfter, messagesQuery, transactionDetailKey } from "./queries";
import { applyPatch } from "./transactionForm";
import type {
  BudgetCreate,
  CategoryCreate,
  Conversation,
  ConversationHistory,
  Message,
  Goal,
  GoalCreate,
  GoalsListResponse,
  GoalUpdate,
  PayeeCreate,
  Transaction,
  TransactionCreate,
  TransactionUpdate,
  TransactionsResponse,
} from "./types";

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

// ── Budgets ─────────────────────────────────────────────────────
// These invalidate on settle, not just on success: a 404 (deleted on another
// device) is also a reason for the month's list to refresh.

export function useSetBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BudgetCreate) => api.setBudget(body), // an upsert: replaces a budget already set for that category and month
    onSettled: () => {
      void invalidateAfter(queryClient, { kind: "budget" });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, budgeted_amount }: { id: string; budgeted_amount: number }) => api.updateBudget(id, { budgeted_amount }),
    onSettled: () => {
      void invalidateAfter(queryClient, { kind: "budget" });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteBudget(id),
    onSettled: () => {
      void invalidateAfter(queryClient, { kind: "budget" });
    },
  });
}

/**
 * Runs a planned "copy from last month" one request at a time (which stays under
 * the API's per-minute limit). It never rejects: what was done, what failed and
 * what was never tried comes back as a CopyRun for the summary.
 */
export function useCopyBudgets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plan, to }: { plan: BudgetCopyPlan; to: MonthYear }) =>
      copyBudgets(
        plan.copy,
        (item) => api.setBudget({ category_id: item.category_id, month: to.month, year: to.year, budgeted_amount: item.budgeted_amount }),
        stopsBatch
      ),
    onSettled: () => {
      void invalidateAfter(queryClient, { kind: "budget" });
    },
  });
}

// ── Goals ───────────────────────────────────────────────────────

/**
 * Writes a goal the server just returned into both cached lists, so the next
 * screen (and a second contribution, which adds to the cached total) starts from
 * the new numbers instead of waiting for the refetch. An archived goal is left
 * for that refetch: dropping it here would make the screen it was archived from
 * flash "not found" while it slides away.
 */
function seedGoal(queryClient: QueryClient, goal: Goal) {
  if (goal.status === "archived") return;
  for (const status of GOAL_LISTS) {
    queryClient.setQueryData<GoalsListResponse>(goalsQuery(status).queryKey, (list) => (list ? placeGoal(list, goal, status) : list));
  }
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GoalCreate) => api.createGoal(body),
    onSuccess: (goal) => seedGoal(queryClient, goal),
    onSettled: () => {
      void invalidateAfter(queryClient, { kind: "goal" });
    },
  });
}

/** Contribute, edit and archive are all a PATCH; the goal it returns (with its new status) is the truth. */
export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: GoalUpdate }) => api.updateGoal(id, patch),
    onSuccess: (goal) => seedGoal(queryClient, goal),
    onSettled: () => {
      void invalidateAfter(queryClient, { kind: "goal" });
    },
  });
}

// ── Chat ────────────────────────────────────────────────────────

/** A retry sends the same `idempotencyKey`: the server replays a finished send and reruns a failed one. */
export type SendVars = { message: string; conversationId?: string; idempotencyKey: string };

const localMessage = (id: string, role: Message["role"], content: string): Message => ({
  id,
  role,
  content,
  tool_call_id: null,
  status: "completed",
  created_at: new Date().toISOString(),
});

/** Adds a row to a thread's cache (creating it for a new conversation), once per id. */
function appendMessage(queryClient: QueryClient, conversationId: string, message: Message) {
  queryClient.setQueryData<ConversationHistory>(messagesQuery(conversationId).queryKey, (history) => {
    const messages = history?.messages ?? [];
    if (messages.some((m) => m.id === message.id)) return history;
    return { conversation_id: conversationId, messages: [...messages, message] };
  });
}

/**
 * The cache writes live here, not in `mutate(..., { onSuccess })`, so they still
 * happen if the user leaves the thread while the AI is thinking (AI5).
 */
export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["chat"],
    mutationFn: ({ message, conversationId, idempotencyKey }: SendVars) =>
      api.chat({ message, conversation_id: conversationId, idempotency_key: idempotencyKey }),
    onMutate: async ({ message, conversationId, idempotencyKey }) => {
      if (!conversationId) return;
      await queryClient.cancelQueries({ queryKey: messagesQuery(conversationId).queryKey });
      appendMessage(queryClient, conversationId, localMessage(`sent-${idempotencyKey}`, "user", message));
    },
    onSuccess: (response, { message, idempotencyKey }) => {
      const id = response.conversation_id;
      appendMessage(queryClient, id, localMessage(`sent-${idempotencyKey}`, "user", message)); // a new conversation had no cache yet
      appendMessage(queryClient, id, localMessage(`reply-${idempotencyKey}`, "assistant", response.response));
      void invalidateAfter(queryClient, { kind: "conversation" });
      for (const change of changesFromTools(response.tool_calls)) void invalidateAfter(queryClient, change);
    },
  });
}

/** Conversations with a send in flight, from any screen (AI7: History won't delete them). */
export function usePendingChatIds(): string[] {
  return useMutationState({
    filters: { mutationKey: ["chat"], status: "pending" },
    select: (mutation) => (mutation.state.variables as SendVars | undefined)?.conversationId ?? "",
  }).filter(Boolean);
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: conversationsQuery.queryKey, exact: true });
      const previous = queryClient.getQueryData<Conversation[]>(conversationsQuery.queryKey);
      queryClient.setQueryData<Conversation[]>(conversationsQuery.queryKey, (list) => list?.filter((c) => c.id !== id));
      return { previous };
    },
    onError: (error, _id, context) => {
      if (isNotFound(error)) return; // already gone: the delete's goal is met
      if (context) queryClient.setQueryData(conversationsQuery.queryKey, context.previous);
    },
    onSettled: (_data, _error, id) => {
      queryClient.removeQueries({ queryKey: messagesQuery(id).queryKey });
      void invalidateAfter(queryClient, { kind: "conversation" });
    },
  });
}
