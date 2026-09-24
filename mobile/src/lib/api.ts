import { isAuthRetryableFetchError } from "@supabase/supabase-js";

import { ApiError, isNotFound, MSG, userMessage } from "./errors";
import { supabase } from "./supabase";
import type {
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
  PaymentMethodSpending,
  ProfileUpdate,
  Transaction,
  TransactionCreate,
  TransactionsResponse,
  TransactionUpdate,
  UserProfile,
} from "./types";

// A phone cannot reach the PC via 127.0.0.1; this must be the PC's LAN IP.
const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

if (!API_BASE) {
  throw new Error("Missing EXPO_PUBLIC_API_URL. Copy .env.example to .env.local and fill it in.");
}

export { ApiError, isNotFound, userMessage };

const CRUD_TIMEOUT_MS = 15_000; // C4
const CHAT_TIMEOUT_MS = 60_000; // AI1: Groq tool chains can legitimately take 30s+

async function currentToken(): Promise<string | null> {
  // getSession() refreshes an expired access token on its own (L3).
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// A2: however many requests hit a 401 together, only one refresh runs and the
// rest await the same promise.
let refreshing: Promise<string | null> | null = null;

function refreshToken(staleToken: string): Promise<string | null> {
  refreshing ??= (async () => {
    // A request that failed just after another one finished refreshing already
    // has a newer token available; use it instead of refreshing again.
    const latest = await currentToken();
    if (latest && latest !== staleToken) return latest;

    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      // A network blip during refresh must not sign the user out.
      if (isAuthRetryableFetchError(error)) throw new ApiError(0, MSG.network);
      return null;
    }
    return data.session?.access_token ?? null;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

type RawResponse = { status: number; body: string; retryAfter?: number };

async function send(
  path: string,
  options: RequestInit,
  token: string,
  timeoutMs: number
): Promise<RawResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    // Read the body inside the timeout too, so a stalled body cannot hang forever.
    const retryAfter = Number.parseInt(res.headers.get("Retry-After") ?? "", 10);
    return { status: res.status, body: await res.text(), retryAfter: retryAfter > 0 ? retryAfter : undefined };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new ApiError(0, aborted ? MSG.timeout : MSG.network);
  } finally {
    clearTimeout(timer);
  }
}

function errorFor({ status, body, retryAfter }: RawResponse): ApiError {
  if (status === 429) return new ApiError(status, MSG.rateLimited, retryAfter);
  if (status >= 500) return new ApiError(status, MSG.server);
  let detail: unknown;
  try {
    detail = JSON.parse(body)?.detail;
  } catch {
    // not JSON: fall through to the generic message
  }
  // FastAPI sends a string `detail` for HTTPException and a list for 422 validation.
  if (typeof detail === "string" && detail) return new ApiError(status, detail);
  return new ApiError(status, MSG.invalid);
}

async function fetchAPI<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = CRUD_TIMEOUT_MS
): Promise<T> {
  const token = await currentToken();
  if (!token) throw new ApiError(401, MSG.expired);

  let res = await send(path, options, token, timeoutMs);

  // A1: a 401 means the token went stale mid-flight. Refresh once, retry once,
  // and only sign out if that still fails, so the user normally never sees it.
  if (res.status === 401) {
    const fresh = await refreshToken(token);
    if (fresh) res = await send(path, options, fresh, timeoutMs);
    if (!fresh || res.status === 401) {
      await supabase.auth.signOut({ scope: "local" });
      throw new ApiError(401, MSG.expired);
    }
  }

  if (res.status < 200 || res.status >= 300) throw errorFor(res);

  try {
    return JSON.parse(res.body) as T;
  } catch {
    throw new ApiError(res.status, MSG.malformed); // C9
  }
}

export const api = {
  // ── Chat ────────────────────────────────────────────────────────
  chat: (body: ChatRequest) =>
    fetchAPI<ChatResponse>(
      "/api/v1/chat",
      { method: "POST", body: JSON.stringify(body) },
      CHAT_TIMEOUT_MS
    ),

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
  listPayees: (type?: "expense" | "income") => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    const qs = params.toString();
    return fetchAPI<PayeeListResponse>(`/api/v1/payees${qs ? `?${qs}` : ""}`);
  },

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

  paymentMethodAnalytics: (month: number, year: number) =>
    fetchAPI<PaymentMethodSpending[]>(
      `/api/v1/analytics/payment-methods?month=${month}&year=${year}`
    ),

  comparisonAnalytics: (
    month1: number, year1: number,
    month2: number, year2: number
  ) =>
    fetchAPI<MonthComparison>(
      `/api/v1/analytics/comparison?month1=${month1}&year1=${year1}&month2=${month2}&year2=${year2}`
    ),
};
