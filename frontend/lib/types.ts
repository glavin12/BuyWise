export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id: string | null;
  status: "pending" | "completed" | "failed";
  created_at: string;
}

export interface ConversationHistory {
  conversation_id: string;
  messages: Message[];
}

export interface ToolCall {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: string;
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  tool_calls: ToolCall[];
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  idempotency_key?: string;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  currency: string;
  income_type: string | null;
  salary_day: number | null;
  timezone: string;
  onboarding_complete: boolean;
  savings_target_percent: number | null;
  investment_style: string | null;
  budget_alerts: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  full_name?: string;
  currency?: string;
  income_type?: string;
  salary_day?: number | null;
  savings_target_percent?: number | null;
  investment_style?: string;
  budget_alerts?: boolean;
  onboarding_complete?: boolean;
}

export interface DashboardData {
  period: string;
  month: string;
  year: number;
  currency: string;
  has_plan: boolean;
  expected_income: number;
  minimum_savings_goal: number;
  total_income_received: number;
  total_spent: number;
  current_balance: number;
  actual_savings: number;
  active_goals_count: number;
  days_remaining_in_month: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  goal_type: string | null;
  priority: string | null;
  target_amount: number;
  current_amount: number;
  progress_percent: number;
  remaining_amount: number;
  target_date: string | null;
  monthly_needed_to_hit_target: number | null;
  days_remaining_in_month: number;
  status: string;
}

export interface GoalsResponse {
  status: string;
  count: number;
  goals: Goal[];
}

export interface Transaction {
  id: string;
  title: string;
  merchant_name: string | null;
  amount: number;
  type: string;
  category: string | null;
  category_icon: string | null;
  payment_method: string | null;
  is_recurring: boolean;
  description: string | null;
  transaction_date: string | null;
}

export interface TransactionsResponse {
  period: string;
  count: number;
  transactions: Transaction[];
}
