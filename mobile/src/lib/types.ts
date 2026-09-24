// ── Auth & Profile ──────────────────────────────────────────────

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
  timezone?: string;
  onboarding_complete?: boolean;
  savings_target_percent?: number | null;
  investment_style?: string;
  budget_alerts?: boolean;
}

// ── Payment methods ─────────────────────────────────────────────
// Multi-account model was removed; each transaction is tagged with an
// optional payment method instead. Balance is a single ledger-derived value.

export type PaymentMethod =
  | "cash"
  | "upi"
  | "bank_transfer"
  | "card"
  | "other";

// ── Categories ──────────────────────────────────────────────────

export type CategoryType = "expense" | "income";

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface CategoryCreate {
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
}

// A category's type is fixed once created; the API ignores it on update.
export interface CategoryUpdate {
  name?: string;
  icon?: string | null;
  color?: string | null;
}

export interface CategoryListResponse {
  count: number;
  categories: Category[];
}

// ── Payees ──────────────────────────────────────────────────────

export interface Payee {
  id: string;
  name: string;
  normalized_name: string;
  type: CategoryType;
  created_at: string | null;
  updated_at: string | null;
}

export interface PayeeCreate {
  name: string;
  type: CategoryType;
}

export interface PayeeUpdate {
  name: string;
}

export interface PayeeListResponse {
  payees: Payee[];
}

// ── Transactions ────────────────────────────────────────────────

export type TransactionType = "expense" | "income" | "starting_balance";
export type ClearedStatus = "pending" | "cleared";

export interface Transaction {
  id: string;
  category_id: string | null;
  category: string | null;
  category_icon: string | null;
  payee_id: string | null;
  payee: string | null;
  amount: number;
  display_amount: number;
  currency: string;
  transaction_type: TransactionType;
  payment_method: PaymentMethod | null;
  transaction_date: string;
  description: string | null;
  notes: string | null;
  cleared_status: ClearedStatus;
  parent_transaction_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TransactionCreate {
  category_id?: string | null;
  payee_id?: string | null;
  payee_name?: string | null;
  amount: number;
  currency?: string | null;
  transaction_type: TransactionType;
  payment_method?: PaymentMethod | null;
  transaction_date?: string;
  description?: string | null;
  notes?: string | null;
  cleared_status?: ClearedStatus;
}

export interface TransactionUpdate {
  category_id?: string | null;
  payee_id?: string | null;
  amount?: number;
  currency?: string | null;
  transaction_type?: TransactionType;
  payment_method?: PaymentMethod | null;
  transaction_date?: string;
  description?: string | null;
  notes?: string | null;
  cleared_status?: ClearedStatus;
}

export interface TransactionsResponse {
  period: string;
  count: number;
  total: number;
  limit: number;
  offset: number;
  transactions: Transaction[];
}

// ── Budgets ─────────────────────────────────────────────────────

export interface Budget {
  id: string;
  category_id: string;
  category: string | null;
  month: number;
  year: number;
  budgeted_amount: number;
  display_budgeted_amount: number;
  spent: number | null;
  display_spent: number | null;
  remaining: number | null;
  display_remaining: number | null;
  percent_used: number | null;
}

export interface BudgetCreate {
  category_id: string;
  month: number;
  year: number;
  budgeted_amount: number;
}

export interface BudgetUpdate {
  budgeted_amount: number;
}

export interface BudgetMonthResponse {
  month: number;
  year: number;
  budgets: Budget[];
}

// ── Goals ────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  category: string | null;
  goal_type: string | null;
  priority: string | null;
  target_amount: number;
  display_target_amount: number;
  current_amount: number;
  display_current_amount: number;
  progress_percent: number;
  remaining_amount: number;
  display_remaining_amount: number;
  target_date: string | null;
  monthly_needed_to_hit_target: number | null;
  display_monthly_needed_to_hit_target: number | null;
  days_remaining_in_month: number;
  status: string;
}

// The values the API accepts (its DB constraint and schema): anything else is a 422.
export type GoalType =
  | "emergency_fund"
  | "purchase"
  | "vacation"
  | "investment"
  | "debt_repayment"
  | "education"
  | "retirement"
  | "custom";
export type GoalPriority = "low" | "medium" | "high";
export type GoalStatus = "active" | "completed" | "archived";

export interface GoalCreate {
  title: string;
  category_id?: string | null;
  description?: string | null;
  target_amount: number;
  current_amount?: number;
  goal_type?: GoalType | null;
  priority?: GoalPriority | null;
  target_date?: string | null;
}

export interface GoalUpdate {
  title?: string;
  category_id?: string | null;
  description?: string | null;
  target_amount?: number;
  current_amount?: number;
  goal_type?: GoalType | null;
  priority?: GoalPriority | null;
  target_date?: string | null;
  status?: GoalStatus;
}

export interface GoalsListResponse {
  status: string;
  count: number;
  goals: Goal[];
}

// ── Analytics ───────────────────────────────────────────────────

export interface MonthlySummary {
  month: number;
  year: number;
  income: number;
  expenses: number;
  net: number;
}

export interface CategorySpending {
  category_id: string;
  category: string;
  icon: string | null;
  color: string | null;
  amount: number;
  display_amount: number;
  transaction_count: number;
  percent_of_total: number;
}

export interface PaymentMethodSpending {
  payment_method: string | null;
  amount: number;
  display_amount: number;
  transaction_count: number;
  percent_of_total: number;
}

export interface MonthComparisonDelta {
  amount: number;
  display_amount: number;
  percent: number | null;
}

export interface MonthComparison {
  first: MonthlySummary;
  second: MonthlySummary;
  change: {
    income: MonthComparisonDelta;
    expenses: MonthComparisonDelta;
    net: MonthComparisonDelta;
  };
}

// ── Dashboard ───────────────────────────────────────────────────

export interface DashboardData {
  period: string;
  month: string;
  year: number;
  currency: string;
  current_balance: number;
  display_current_balance: number;
  active_goals_count: number;
  total_income: number;
  display_total_income: number;
  total_spent: number;
  display_total_spent: number;
  net: number;
  display_net: number;
  total_budgeted: number;
  display_total_budgeted: number;
  remaining_budget: number;
  display_remaining_budget: number;
  unassigned: number;
  display_unassigned: number;
  has_budget: boolean;
  days_remaining_in_month: number;
}

// ── Chat & Conversations ────────────────────────────────────────

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
  reasoning?: string | null;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  idempotency_key?: string;
}
