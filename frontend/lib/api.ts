import { createClient } from "@/lib/supabase/client";
import type {
  ChatRequest,
  ChatResponse,
  Conversation,
  ConversationHistory,
  DashboardData,
  GoalsResponse,
  TransactionsResponse,
  UserProfile,
  ProfileUpdate,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  chat: (body: ChatRequest) =>
    fetchAPI<ChatResponse>("/api/v1/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),

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

  getProfile: () => fetchAPI<UserProfile>("/api/v1/profile"),

  updateProfile: (data: ProfileUpdate) =>
    fetchAPI<UserProfile>("/api/v1/profile", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getDashboard: (period = "this_month") =>
    fetchAPI<DashboardData>(`/api/v1/dashboard?period=${period}`),

  getGoals: (status = "active") =>
    fetchAPI<GoalsResponse>(`/api/v1/goals?status=${status}`),

  getTransactions: (limit = 10, period?: string, type?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (period) params.set("period", period);
    if (type) params.set("type", type);
    return fetchAPI<TransactionsResponse>(
      `/api/v1/transactions?${params.toString()}`
    );
  },
};
