import type { PaymentMethod, TransactionType } from "./types";

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
