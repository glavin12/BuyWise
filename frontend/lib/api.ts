import { createClient } from "@/lib/supabase/client";
import type {
  Account,
  AccountCreate,
  AccountListResponse,
  AccountUpdate,
  Budget,
  BudgetCreate,
  BudgetMonthResponse,
  BudgetUpdate,
  Category,
  CategoryCreate,
  CategoryListResponse,
  CategoryUpdate,
  CategorySpending,
  ChatRequest,
  ChatResponse,
  Conversation,
  ConversationHistory,
  DashboardData,
  GoalCreate,
  GoalUpdate,
  GoalsListResponse,
  Goal,
  MonthlySummary,
  MonthComparison,
  Payee,
  PayeeCreate,
  PayeeListResponse,
  PayeeUpdate,
  ProfileUpdate,
  Transaction,
  TransactionCreate,
  TransactionsResponse,
  TransactionUpdate,
  TransferCreate,
  TransferResponse,
  UserProfile,
} from "./types";

// Uvicorn's default local listener is IPv4-only; avoid localhost resolving to
// ::1 first in browsers that do not fall back cleanly to IPv4.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function fetchAPI<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    let detail = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      detail = parsed.detail || errorBody;
    } catch {
      // use raw text
    }
    throw new Error(detail);
  }

  return res.json();
}

export const api = {
  // ── Chat ────────────────────────────────────────────────────────
  chat: (body: ChatRequest) =>
    fetchAPI<ChatResponse>("/api/v1/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ── Conversations ──────────────────────────────────────────────
  listConversations: (limit = 50) =>
    fetchAPI<Conversation[]>(`/api/v1/conversations?limit=${limit}`),

  getMessages: (conversationId: string, limit = 100) =>
    fetchAPI<ConversationHistory>(
      `/api/v1/conversations/${conversationId}/messages?limit=${limit}`
    ),

  deleteConversation: (conversationId: string) =>
    fetchAPI<{ status: string; conversation_id: string }>(
      `/api/v1/conversations/${conversationId}`,
      { method: "DELETE" }
    ),

  // ── Profile ────────────────────────────────────────────────────
  getProfile: () => fetchAPI<UserProfile>("/api/v1/profile"),

  updateProfile: (data: ProfileUpdate) =>
    fetchAPI<UserProfile>("/api/v1/profile", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Dashboard ──────────────────────────────────────────────────
  getDashboard: (period = "this_month") =>
    fetchAPI<DashboardData>(`/api/v1/dashboard?period=${period}`),

  // ── Accounts ───────────────────────────────────────────────────
  listAccounts: () =>
    fetchAPI<AccountListResponse>("/api/v1/accounts"),

  getAccount: (id: string) =>
    fetchAPI<Account>(`/api/v1/accounts/${id}`),

  createAccount: (data: AccountCreate) =>
    fetchAPI<Account>("/api/v1/accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAccount: (id: string, data: AccountUpdate) =>
    fetchAPI<Account>(`/api/v1/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteAccount: (id: string) =>
    fetchAPI<{ status: string; account_id: string }>(
      `/api/v1/accounts/${id}`,
      { method: "DELETE" }
    ),

  // ── Categories ─────────────────────────────────────────────────
  listCategories: (type?: "expense" | "income") => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    const qs = params.toString();
    return fetchAPI<CategoryListResponse>(
      `/api/v1/categories${qs ? `?${qs}` : ""}`
    );
  },

  getCategory: (id: string) =>
    fetchAPI<Category>(`/api/v1/categories/${id}`),

  createCategory: (data: CategoryCreate) =>
    fetchAPI<Category>("/api/v1/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCategory: (id: string, data: CategoryUpdate) =>
    fetchAPI<Category>(`/api/v1/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: string) =>
    fetchAPI<{ status: string; category_id: string }>(
      `/api/v1/categories/${id}`,
      { method: "DELETE" }
    ),

  // ── Payees ─────────────────────────────────────────────────────
  listPayees: () =>
    fetchAPI<PayeeListResponse>("/api/v1/payees"),

  getPayee: (id: string) =>
    fetchAPI<Payee>(`/api/v1/payees/${id}`),

  createPayee: (data: PayeeCreate) =>
    fetchAPI<Payee>("/api/v1/payees", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePayee: (id: string, data: PayeeUpdate) =>
    fetchAPI<Payee>(`/api/v1/payees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deletePayee: (id: string) =>
    fetchAPI<{ status: string; payee_id: string }>(
      `/api/v1/payees/${id}`,
      { method: "DELETE" }
    ),

  // ── Transactions ───────────────────────────────────────────────
  listTransactions: (params: {
    account_id?: string;
    category_id?: string;
    payee_id?: string;
    transaction_type?: string;
    cleared_status?: string;
    date_from?: string;
    date_to?: string;
    period?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.account_id) qs.set("account_id", params.account_id);
    if (params.category_id) qs.set("category_id", params.category_id);
    if (params.payee_id) qs.set("payee_id", params.payee_id);
    if (params.transaction_type) qs.set("transaction_type", params.transaction_type);
    if (params.cleared_status) qs.set("cleared_status", params.cleared_status);
    if (params.date_from) qs.set("date_from", params.date_from);
    if (params.date_to) qs.set("date_to", params.date_to);
    if (params.period) qs.set("period", params.period);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    return fetchAPI<TransactionsResponse>(
      `/api/v1/transactions?${qs.toString()}`
    );
  },

  getTransaction: (id: string) =>
    fetchAPI<Transaction>(`/api/v1/transactions/${id}`),

  createTransaction: (data: TransactionCreate) =>
    fetchAPI<Transaction>("/api/v1/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTransaction: (id: string, data: TransactionUpdate) =>
    fetchAPI<Transaction>(`/api/v1/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteTransaction: (id: string) =>
    fetchAPI<{ status: string; transaction_id: string }>(
      `/api/v1/transactions/${id}`,
      { method: "DELETE" }
    ),

  // ── Transfers ──────────────────────────────────────────────────
  createTransfer: (data: TransferCreate) =>
    fetchAPI<TransferResponse>("/api/v1/transfers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteTransfer: (groupId: string) =>
    fetchAPI<{ status: string; transfer_group_id: string }>(
      `/api/v1/transfers/${groupId}`,
      { method: "DELETE" }
    ),

  // ── Budgets ────────────────────────────────────────────────────
  setBudget: (data: BudgetCreate) =>
    fetchAPI<Budget>("/api/v1/budgets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMonthBudgets: (year: number, month: number) =>
    fetchAPI<BudgetMonthResponse>(
      `/api/v1/budgets/${String(year)}-${String(month).padStart(2, "0")}`
    ),

  getBudget: (id: string) =>
    fetchAPI<Budget>(`/api/v1/budgets/id/${id}`),

  updateBudget: (id: string, data: BudgetUpdate) =>
    fetchAPI<Budget>(`/api/v1/budgets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteBudget: (id: string) =>
    fetchAPI<{ status: string; budget_id: string }>(
      `/api/v1/budgets/${id}`,
      { method: "DELETE" }
    ),

  // ── Goals ──────────────────────────────────────────────────────
  listGoals: (status = "active") =>
    fetchAPI<GoalsListResponse>(`/api/v1/goals?status=${status}`),

  createGoal: (data: GoalCreate) =>
    fetchAPI<Goal>("/api/v1/goals", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateGoal: (id: string, data: GoalUpdate) =>
    fetchAPI<Goal>(`/api/v1/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // ── Analytics ──────────────────────────────────────────────────
  monthlyAnalytics: (month: number, year: number) =>
    fetchAPI<MonthlySummary>(
      `/api/v1/analytics/monthly?month=${month}&year=${year}`
    ),

  categoryAnalytics: (month: number, year: number) =>
    fetchAPI<CategorySpending[]>(
      `/api/v1/analytics/categories?month=${month}&year=${year}`
    ),

  comparisonAnalytics: (
    month1: number, year1: number,
    month2: number, year2: number
  ) =>
    fetchAPI<MonthComparison>(
      `/api/v1/analytics/comparison?month1=${month1}&year1=${year1}&month2=${month2}&year2=${year2}`
    ),
};
