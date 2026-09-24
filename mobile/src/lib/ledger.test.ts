import assert from "node:assert/strict";
import { test } from "node:test";

import {
  diffFields,
  findInPages,
  flattenPages,
  groupByDay,
  mapPages,
  matchesSearch,
  planBudgetCopy,
} from "./ledger.ts";
import type { Budget, Transaction } from "./types";

function tx(id: string, date: string, type: Transaction["transaction_type"], amount: number, extra: Partial<Transaction> = {}): Transaction {
  return {
    id,
    category_id: "c1",
    category: "Food",
    category_icon: null,
    payee_id: null,
    payee: null,
    amount,
    display_amount: amount / 100,
    currency: "INR",
    transaction_type: type,
    payment_method: null,
    transaction_date: date,
    description: null,
    notes: null,
    cleared_status: "pending",
    parent_transaction_id: null,
    created_at: null,
    updated_at: null,
    ...extra,
  };
}

function budget(categoryId: string, amount: number, name: string | null = null): Budget {
  return {
    id: `b-${categoryId}`,
    category_id: categoryId,
    category: name,
    month: 8,
    year: 2026,
    budgeted_amount: amount,
    display_budgeted_amount: amount / 100,
    spent: null,
    display_spent: null,
    remaining: null,
    display_remaining: null,
    percent_used: null,
  };
}

test("groupByDay nets income minus expenses as integers and excludes starting balances", () => {
  const sections = groupByDay([
    tx("1", "2026-09-24", "expense", 25000),
    tx("2", "2026-09-24", "income", 100000),
    tx("3", "2026-09-24", "starting_balance", 500000),
    tx("4", "2026-09-23", "expense", 10),
  ]);
  assert.deepEqual(sections.map((s) => [s.date, s.net, s.data.length]), [
    ["2026-09-24", 75000, 3],
    ["2026-09-23", -10, 1],
  ]);
});

test("groupByDay: 0.1 + 0.2 style sums stay exact", () => {
  const [day] = groupByDay([tx("1", "2026-01-01", "income", 10), tx("2", "2026-01-01", "income", 20)]);
  assert.equal(day?.net, 30);
});

test("a day split across two pages becomes one section with the combined net", () => {
  const page1 = { transactions: [tx("1", "2026-09-24", "expense", 100), tx("2", "2026-09-24", "expense", 200)] };
  const page2 = { transactions: [tx("3", "2026-09-24", "income", 1000), tx("4", "2026-09-23", "expense", 5)] };
  const sections = groupByDay(flattenPages([page1, page2]));
  assert.equal(sections.length, 2);
  assert.deepEqual([sections[0]?.date, sections[0]?.net, sections[0]?.data.length], ["2026-09-24", 700, 3]);
});

test("flattenPages keeps the first copy of a row repeated across pages", () => {
  const rows = flattenPages([
    { transactions: [tx("1", "2026-09-24", "expense", 1), tx("2", "2026-09-24", "expense", 2)] },
    { transactions: [tx("2", "2026-09-24", "expense", 2), tx("3", "2026-09-23", "expense", 3)] },
  ]);
  assert.deepEqual(rows.map((r) => r.id), ["1", "2", "3"]);
});

test("matchesSearch covers payee, description, notes and category, ignoring case", () => {
  const row = tx("1", "2026-09-24", "expense", 100, { payee: "Swiggy", description: "Dinner", notes: "with Asha", category: "Food" });
  for (const q of ["swig", "DINNER", "asha", "foo", "  ", ""]) assert.ok(matchesSearch(row, q), q);
  assert.ok(!matchesSearch(row, "uber"));
  assert.ok(!matchesSearch(tx("2", "2026-09-24", "expense", 1, { category: null }), "food"));
});

test("mapPages patches or removes rows and keeps totals consistent", () => {
  const data = {
    pages: [
      { total: 3, transactions: [tx("1", "2026-09-24", "expense", 100), tx("2", "2026-09-24", "expense", 200)] },
      { total: 3, transactions: [tx("3", "2026-09-23", "expense", 300)] },
    ],
  };
  const patched = mapPages(data, (t) => (t.id === "2" ? { ...t, amount: 999 } : t));
  assert.equal(patched.pages[0]?.transactions[1]?.amount, 999);
  assert.equal(data.pages[0]?.transactions[1]?.amount, 200); // input not mutated

  const removed = mapPages(data, (t) => (t.id === "3" ? null : t));
  assert.deepEqual(removed.pages.map((p) => [p.transactions.length, p.total]), [[2, 2], [0, 2]]);
});

test("findInPages looks through every cached list", () => {
  const a = { pages: [{ transactions: [tx("1", "2026-09-24", "expense", 1)] }] };
  const b = { pages: [{ transactions: [tx("2", "2026-09-24", "expense", 2)] }] };
  assert.equal(findInPages([undefined, a, b], "2")?.amount, 2);
  assert.equal(findInPages([a, b], "9"), undefined);
  assert.equal(findInPages([], "1"), undefined);
});

test("diffFields: an unchanged form is an empty diff", () => {
  const form = { amount: 25000, category_id: "c1", payee_id: null, description: null };
  assert.deepEqual(diffFields(form, { ...form }), {});
});

test("diffFields sends only changed fields, including clearing one to null", () => {
  const initial: { amount: number; category_id: string; payee_id: string | null; description: string | null } = {
    amount: 25000,
    category_id: "c1",
    payee_id: "p1",
    description: "Lunch",
  };
  assert.deepEqual(diffFields(initial, { ...initial, amount: 30000 }), { amount: 30000 });
  assert.deepEqual(diffFields(initial, { ...initial, payee_id: null, description: "Dinner" }), {
    payee_id: null,
    description: "Dinner",
  });
});

test("planBudgetCopy skips categories already set this month and inactive ones", () => {
  const lastMonth = [budget("food", 500000, "Food"), budget("rent", 1500000, "Rent"), budget("old", 100000, "Old"), budget("fun", 200000)];
  const thisMonth = [budget("rent", 1600000, "Rent")];
  const plan = planBudgetCopy(lastMonth, thisMonth, new Set(["food", "rent", "fun"]));
  assert.deepEqual(plan.copy.map((c) => [c.category_id, c.budgeted_amount]), [
    ["food", 500000],
    ["fun", 200000],
  ]);
  assert.equal(plan.skipped, 2);
  assert.deepEqual(plan.reasons, { already_set: 1, inactive: 1 });
});

test("planBudgetCopy with nothing last month copies nothing", () => {
  const plan = planBudgetCopy([], [budget("food", 1)], new Set(["food"]));
  assert.deepEqual(plan, { copy: [], skipped: 0, reasons: { already_set: 0, inactive: 0 } });
});
