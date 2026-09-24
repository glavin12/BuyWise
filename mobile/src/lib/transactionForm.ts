// The transaction form as pure functions: draft shape, validation, API payloads,
// and the rules for switching type and "Save & add another". The screens only
// wire these to state. Type-only imports plus explicit .ts siblings so `npm test`
// can run it.

import { diffFields } from "./ledger.ts";
import { minorToAmountText, parseAmountToMinor } from "./money.ts";
import type {
  Category,
  PaymentMethod,
  Transaction,
  TransactionCreate,
  TransactionType,
  TransactionUpdate,
} from "./types";

export type PickedCategory = Pick<Category, "id" | "name" | "icon">;
/** A payee without an `id` is new: the backend creates it (race-safe) only when the transaction saves. */
export type PickedPayee = { id?: string; name: string };

export type TransactionDraft = {
  type: TransactionType;
  /** Text as typed; parsed to minor units only by validateDraft. */
  amount: string;
  category: PickedCategory | null;
  payee: PickedPayee | null;
  method: PaymentMethod | null;
  /** "YYYY-MM-DD", local calendar date */
  date: string;
  description: string;
  notes: string;
};

export const DESCRIPTION_MAX = 500; // backend TransactionCreate.description
export const NOTES_MAX = 2000; // backend TransactionCreate.notes

export function emptyDraft(today: string): TransactionDraft {
  return { type: "expense", amount: "", category: null, payee: null, method: null, date: today, description: "", notes: "" };
}

export function draftFromTransaction(tx: Transaction): TransactionDraft {
  return {
    type: tx.transaction_type,
    amount: minorToAmountText(tx.amount),
    category: tx.category_id ? { id: tx.category_id, name: tx.category ?? "", icon: tx.category_icon } : null,
    payee: tx.payee_id ? { id: tx.payee_id, name: tx.payee ?? "" } : null,
    method: tx.payment_method,
    date: tx.transaction_date,
    description: tx.description ?? "",
    notes: tx.notes ?? "",
  };
}

/**
 * Switching between expense and income clears the category and payee: both are
 * typed, and the backend rejects a transaction whose category or payee type
 * differs from its own.
 */
export function switchType(draft: TransactionDraft, type: TransactionType): TransactionDraft {
  return type === draft.type ? draft : { ...draft, type, category: null, payee: null };
}

/** "Save & add another": keep type, category, method and date; clear what is specific to one purchase. */
export function afterSaveAndAddAnother(draft: TransactionDraft): TransactionDraft {
  return { ...draft, amount: "", payee: null, description: "", notes: "" };
}

/** A stable fingerprint of what the user can see and edit, so "dirty" ignores object identity. */
function fingerprint(draft: TransactionDraft): string {
  const { type, amount, category, payee, method, date, description, notes } = draft;
  return JSON.stringify([type, amount.trim(), category?.id ?? null, payee?.id ?? payee?.name ?? null, method, date, description.trim(), notes.trim()]);
}

export function isDirty(draft: TransactionDraft, baseline: TransactionDraft): boolean {
  return fingerprint(draft) !== fingerprint(baseline);
}

export type DraftErrors = { amount?: string; category?: string };

/** `amount` is the parsed minor-unit value when it is usable. */
export function validateDraft(draft: TransactionDraft): { amount: number | null; errors: DraftErrors } {
  const amount = parseAmountToMinor(draft.amount);
  const errors: DraftErrors = {};
  if (draft.amount.trim() === "") errors.amount = "Enter an amount.";
  else if (amount === null) errors.amount = "Enter a valid amount, like 250 or 250.50.";
  else if (amount === 0 && draft.type !== "starting_balance") errors.amount = "The amount must be more than 0.";
  if (draft.type !== "starting_balance" && !draft.category) errors.category = "Choose a category.";
  return { amount: errors.amount ? null : amount, errors };
}

/** POST body. Always carries the local transaction_date, and the profile currency when known. */
export function toCreatePayload(draft: TransactionDraft, amount: number, currency?: string): TransactionCreate {
  const payee = draft.payee;
  return {
    transaction_type: draft.type,
    amount,
    category_id: draft.category?.id ?? null,
    ...(payee?.id ? { payee_id: payee.id } : payee?.name ? { payee_name: payee.name } : {}),
    payment_method: draft.method,
    transaction_date: draft.date,
    description: draft.description.trim() || null,
    ...(currency ? { currency } : {}),
  };
}

/** The fields an edit can change. Compared by value so an unchanged form is an empty diff. */
export type EditableFields = {
  transaction_type: TransactionType;
  amount: number;
  category_id: string | null;
  payee_id: string | null;
  payment_method: PaymentMethod | null;
  transaction_date: string;
  description: string | null;
  notes: string | null;
};

export function editableFieldsOf(tx: Transaction): EditableFields {
  return {
    transaction_type: tx.transaction_type,
    amount: tx.amount,
    category_id: tx.category_id,
    payee_id: tx.payee_id,
    payment_method: tx.payment_method,
    transaction_date: tx.transaction_date,
    description: tx.description?.trim() || null,
    notes: tx.notes?.trim() || null,
  };
}

/** PATCH body: only what changed. Empty means nothing to save. */
export function editPatch(original: Transaction, draft: TransactionDraft, amount: number): TransactionUpdate {
  const current: EditableFields = {
    transaction_type: draft.type,
    amount,
    category_id: draft.category?.id ?? null,
    payee_id: draft.payee?.id ?? null,
    payment_method: draft.method,
    transaction_date: draft.date,
    description: draft.description.trim() || null,
    notes: draft.notes.trim() || null,
  };
  return diffFields(editableFieldsOf(original), current);
}

/** The row as it will look once `patch` is applied, for the optimistic cache update. */
export function applyPatch(tx: Transaction, patch: TransactionUpdate, view: Partial<Transaction>): Transaction {
  const next: Transaction = { ...tx, ...view };
  if (patch.amount !== undefined) {
    next.amount = patch.amount;
    next.display_amount = patch.amount / 100; // display only; every total is summed from `amount`
  }
  if (patch.transaction_type !== undefined) next.transaction_type = patch.transaction_type;
  if (patch.category_id !== undefined) next.category_id = patch.category_id;
  if (patch.payee_id !== undefined) next.payee_id = patch.payee_id;
  if (patch.payment_method !== undefined) next.payment_method = patch.payment_method;
  if (patch.transaction_date !== undefined) next.transaction_date = patch.transaction_date;
  if (patch.description !== undefined) next.description = patch.description;
  if (patch.notes !== undefined) next.notes = patch.notes;
  return next;
}

/**
 * The category to pre-fill after a payee is picked: the one used on that payee's
 * most recent transaction, but only if it is still active and of the current type.
 * `categories` is the active list for `type`, so membership is the whole check.
 */
export function suggestedCategory(
  last: Pick<Transaction, "category_id" | "transaction_type"> | undefined,
  categories: readonly PickedCategory[],
  type: TransactionType
): PickedCategory | null {
  if (!last?.category_id || last.transaction_type !== type) return null;
  return categories.find((category) => category.id === last.category_id) ?? null;
}
