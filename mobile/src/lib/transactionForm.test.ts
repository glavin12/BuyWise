import assert from "node:assert/strict";
import { test } from "node:test";

import {
  afterSaveAndAddAnother,
  applyPatch,
  draftFromTransaction,
  editPatch,
  emptyDraft,
  isDirty,
  suggestedCategory,
  switchType,
  toCreatePayload,
  validateDraft,
  type TransactionDraft,
} from "./transactionForm.ts";
import type { Transaction } from "./types";

const TODAY = "2026-09-24";
const FOOD = { id: "cat-food", name: "Food", icon: "food" };
const SALARY = { id: "cat-salary", name: "Salary", icon: null };

function filled(extra: Partial<TransactionDraft> = {}): TransactionDraft {
  return { ...emptyDraft(TODAY), amount: "250.50", category: FOOD, ...extra };
}

function saved(extra: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    category_id: FOOD.id,
    category: "Food",
    category_icon: "food",
    payee_id: "p1",
    payee: "Swiggy",
    amount: 25050,
    display_amount: 250.5,
    currency: "INR",
    transaction_type: "expense",
    payment_method: "upi",
    transaction_date: "2026-09-20",
    description: "Dinner",
    notes: null,
    cleared_status: "pending",
    parent_transaction_id: null,
    created_at: null,
    updated_at: null,
    ...extra,
  };
}

test("switching type clears category and payee; same type keeps them", () => {
  const draft = filled({ payee: { id: "p1", name: "Swiggy" }, method: "upi" });
  const income = switchType(draft, "income");
  assert.equal(income.type, "income");
  assert.equal(income.category, null);
  assert.equal(income.payee, null);
  assert.equal(income.amount, "250.50"); // the rest survives
  assert.equal(income.method, "upi");
  assert.equal(switchType(draft, "expense"), draft);
});

test("Save & add another keeps type, category, method and date and clears the rest", () => {
  const draft = filled({ payee: { name: "New Cafe" }, method: "cash", date: "2026-09-01", description: "Coffee", notes: "n" });
  assert.deepEqual(afterSaveAndAddAnother(draft), {
    type: "expense",
    amount: "",
    category: FOOD,
    payee: null,
    method: "cash",
    date: "2026-09-01",
    description: "",
    notes: "",
  });
});

test("validateDraft: amount and category rules", () => {
  assert.equal(validateDraft(filled()).amount, 25050);
  assert.deepEqual(validateDraft(filled()).errors, {});
  assert.equal(validateDraft(filled({ amount: "" })).errors.amount, "Enter an amount.");
  assert.equal(validateDraft(filled({ amount: "1.005" })).errors.amount, "Enter a valid amount, like 250 or 250.50.");
  assert.equal(validateDraft(filled({ amount: "1e5" })).errors.amount, "Enter a valid amount, like 250 or 250.50.");
  assert.equal(validateDraft(filled({ amount: "0" })).errors.amount, "The amount must be more than 0.");
  assert.equal(validateDraft(filled({ category: null })).errors.category, "Choose a category.");
  assert.equal(validateDraft(filled({ amount: "abc" })).amount, null);
});

test("a starting balance needs no category and may be 0", () => {
  const draft = filled({ type: "starting_balance", category: null, amount: "0" });
  assert.deepEqual(validateDraft(draft).errors, {});
  assert.equal(validateDraft(draft).amount, 0);
});

test("toCreatePayload sends the local date, integer amount, and payee_name only for a new payee", () => {
  const existing = toCreatePayload(filled({ payee: { id: "p1", name: "Swiggy" }, method: "upi", description: " Lunch " }), 25050, "INR");
  assert.deepEqual(existing, {
    transaction_type: "expense",
    amount: 25050,
    category_id: FOOD.id,
    payee_id: "p1",
    payment_method: "upi",
    transaction_date: TODAY,
    description: "Lunch",
    currency: "INR",
  });

  const fresh = toCreatePayload(filled({ payee: { name: "Corner Cafe" } }), 25050);
  assert.equal(fresh.payee_name, "Corner Cafe");
  assert.equal("payee_id" in fresh, false);
  assert.equal("currency" in fresh, false);

  const bare = toCreatePayload(filled(), 25050);
  assert.equal("payee_id" in bare || "payee_name" in bare, false);
  assert.equal(bare.description, null);
});

test("an unchanged edit form gives an empty patch", () => {
  const tx = saved();
  assert.deepEqual(editPatch(tx, draftFromTransaction(tx), 25050), {});
  // A stored empty-string description is the same as none.
  const blank = saved({ description: "", notes: "  " });
  assert.deepEqual(editPatch(blank, draftFromTransaction(blank), 25050), {});
});

test("an edit sends only the changed fields", () => {
  const tx = saved();
  const draft = { ...draftFromTransaction(tx), amount: "300", description: "Late dinner" };
  assert.deepEqual(editPatch(tx, draft, 30000), { amount: 30000, description: "Late dinner" });
  assert.deepEqual(editPatch(tx, { ...draftFromTransaction(tx), payee: null }, 25050), { payee_id: null });
});

test("editing the type forces a new category: the patch carries the cleared fields", () => {
  const tx = saved();
  const asIncome = switchType(draftFromTransaction(tx), "income");
  assert.equal(validateDraft(asIncome).errors.category, "Choose a category."); // Save stays disabled
  const repicked = { ...asIncome, category: SALARY };
  assert.deepEqual(editPatch(tx, repicked, 25050), {
    transaction_type: "income",
    category_id: SALARY.id,
    payee_id: null,
  });
});

test("an unchanged deactivated category is never re-sent", () => {
  const tx = saved(); // its category may have been deactivated since
  const patch = editPatch(tx, { ...draftFromTransaction(tx), notes: "receipt in drawer" }, 25050);
  assert.deepEqual(patch, { notes: "receipt in drawer" });
  assert.equal("category_id" in patch, false);
});

test("isDirty compares what the user sees, not object identity", () => {
  const tx = saved();
  const baseline = draftFromTransaction(tx);
  assert.equal(isDirty(baseline, baseline), false);
  assert.equal(isDirty({ ...baseline, category: { ...FOOD } }, baseline), false); // re-picked the same category
  assert.equal(isDirty({ ...baseline, description: "Dinner " }, baseline), false); // trailing space only
  assert.equal(isDirty({ ...baseline, amount: "251" }, baseline), true);
  assert.equal(isDirty(filled({ amount: "5" }), emptyDraft(TODAY)), true);
  assert.equal(isDirty(emptyDraft(TODAY), emptyDraft(TODAY)), false);
});

test("applyPatch shows the edit optimistically without touching other fields", () => {
  const tx = saved();
  const next = applyPatch(tx, { amount: 30000, category_id: SALARY.id, payee_id: null }, { category: "Salary", category_icon: null, payee: null });
  assert.equal(next.amount, 30000);
  assert.equal(next.display_amount, 300);
  assert.equal(next.category, "Salary");
  assert.equal(next.payee, null);
  assert.equal(next.description, "Dinner");
  assert.equal(tx.amount, 25050); // original untouched
});

test("suggestedCategory only pre-fills a still-active category of the current type", () => {
  const active = [FOOD, { id: "cat-fuel", name: "Fuel", icon: null }];
  assert.deepEqual(suggestedCategory({ category_id: FOOD.id, transaction_type: "expense" }, active, "expense"), FOOD);
  assert.equal(suggestedCategory({ category_id: "cat-gone", transaction_type: "expense" }, active, "expense"), null); // deactivated
  assert.equal(suggestedCategory({ category_id: FOOD.id, transaction_type: "income" }, active, "expense"), null); // other type
  assert.equal(suggestedCategory({ category_id: null, transaction_type: "expense" }, active, "expense"), null);
  assert.equal(suggestedCategory(undefined, active, "expense"), null); // payee never used
});
