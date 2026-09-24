import type { GoalPriority, GoalType, PaymentMethod, TransactionType } from "./types";

/** Display words for API enums. Meaning is always carried by these words too, never by colour alone. */
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other",
};

export const PAYMENT_METHODS = Object.keys(METHOD_LABEL) as PaymentMethod[];

export const TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  starting_balance: "Starting balance",
};

export const GOAL_TYPE_LABEL: Record<GoalType, string> = {
  emergency_fund: "Emergency fund",
  purchase: "Purchase",
  vacation: "Vacation",
  investment: "Investment",
  debt_repayment: "Debt repayment",
  education: "Education",
  retirement: "Retirement",
  custom: "Custom",
};

export const GOAL_TYPES = Object.keys(GOAL_TYPE_LABEL) as GoalType[];

export const PRIORITY_LABEL: Record<GoalPriority, string> = { low: "Low", medium: "Medium", high: "High" };
