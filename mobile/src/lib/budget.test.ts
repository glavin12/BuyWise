import assert from "node:assert/strict";
import { test } from "node:test";

import {
  budgetProgress,
  copyBudgets,
  copySummary,
  envelopesFor,
  envelopeStack,
  envelopeStatus,
  frontEnvelope,
  readyToAssign,
  unbudgetedCategories,
} from "./budget.ts";
import type { BudgetCopyItem } from "./ledger.ts";
import type { Budget, Category, CategorySpending } from "./types";

function category(id: string, name: string, extra: Partial<Category> = {}): Category {
  return { id, name, type: "expense", icon: null, color: null, is_active: true, created_at: null, updated_at: null, ...extra };
}

const item = (id: string): BudgetCopyItem => ({ category_id: id, category: id, budgeted_amount: 1000 });

test("readyToAssign is income minus assigned, negative when over-assigned", () => {
  assert.deepEqual(readyToAssign(8500000, [{ budgeted_amount: 1000000 }, { budgeted_amount: 300000 }]), {
    income: 8500000,
    assigned: 1300000,
    ready: 7200000,
  });
  assert.equal(readyToAssign(100, [{ budgeted_amount: 250 }]).ready, -150);
  assert.deepEqual(readyToAssign(0, []), { income: 0, assigned: 0, ready: 0 });
});

test("budgetProgress: the bar is capped at 100 but the text percent is true", () => {
  const under = budgetProgress({ budgeted_amount: 1000000, spent: 400000 });
  assert.deepEqual(under, { barPercent: 40, usedPercent: 40, over: false, left: 600000, overBy: 0 });

  const over = budgetProgress({ budgeted_amount: 400000, spent: 500000 });
  assert.deepEqual(over, { barPercent: 100, usedPercent: 125, over: true, left: 0, overBy: 100000 });
});

test("budgetProgress edge cases: exactly on budget, nothing spent, null spent, zero budget", () => {
  assert.deepEqual(budgetProgress({ budgeted_amount: 500, spent: 500 }), { barPercent: 100, usedPercent: 100, over: false, left: 0, overBy: 0 });
  assert.equal(budgetProgress({ budgeted_amount: 500, spent: 0 }).barPercent, 0);
  assert.equal(budgetProgress({ budgeted_amount: 500, spent: null }).usedPercent, 0);
  // 99.96% rounds to 100% on screen but is still under budget: "over" follows the integers.
  assert.equal(budgetProgress({ budgeted_amount: 10000, spent: 9996 }).over, false);
  assert.equal(budgetProgress({ budgeted_amount: 0, spent: 300 }).usedPercent, null);
  assert.equal(budgetProgress({ budgeted_amount: 0, spent: 300 }).over, true);
});

test("unbudgetedCategories is active expense categories without a budget", () => {
  const cats = [
    category("food", "Food"),
    category("rent", "Rent"),
    category("old", "Old", { is_active: false }),
    category("salary", "Salary", { type: "income" }),
  ];
  assert.deepEqual(unbudgetedCategories(cats, [{ category_id: "rent" }]).map((c) => c.id), ["food"]);
  assert.deepEqual(unbudgetedCategories(cats, []).map((c) => c.id), ["food", "rent"]);
});

function budget(categoryId: string, budgeted: number, spent: number): Budget {
  return {
    id: `b-${categoryId}`,
    category_id: categoryId,
    category: categoryId,
    month: 9,
    year: 2026,
    budgeted_amount: budgeted,
    display_budgeted_amount: budgeted / 100,
    spent,
    display_spent: spent / 100,
    remaining: budgeted - spent,
    display_remaining: (budgeted - spent) / 100,
    percent_used: null,
  };
}

const spend = (categoryId: string, amount: number, count: number): CategorySpending => ({
  category_id: categoryId,
  category: categoryId,
  icon: null,
  color: null,
  amount,
  display_amount: amount / 100,
  transaction_count: count,
  percent_of_total: 0,
});

test("envelopesFor: budgets first, then unbudgeted categories with spending (most first), the rest apart", () => {
  const cats = [category("food", "Food"), category("rent", "Rent"), category("fuel", "Fuel"), category("bus", "Bus"), category("pets", "Pets")];
  const { envelopes, rest } = envelopesFor(
    [budget("rent", 1800000, 1800000), budget("gone", 1000, 0)],
    [spend("food", 630000, 14), spend("rent", 1800000, 1), spend("bus", 900000, 3)],
    cats,
  );
  assert.deepEqual(envelopes.map((e) => [e.categoryId, e.spent, e.count, e.archived]), [
    ["rent", 1800000, 1, false],
    ["gone", 0, 0, true], // its category is no longer in the active list
    ["bus", 900000, 3, false],
    ["food", 630000, 14, false],
  ]);
  assert.deepEqual(rest.map((c) => c.id), ["fuel", "pets"]);
  // Categories not loaded: only the budgets are known, none marked archived.
  assert.deepEqual(envelopesFor([budget("rent", 1, 0)], [], undefined), {
    envelopes: [{ categoryId: "rent", name: "rent", budget: budget("rent", 1, 0), spent: 0, count: 0, archived: false }],
    rest: [],
  });
});

test("frontEnvelope: the picked one, else the most spent", () => {
  const { envelopes } = envelopesFor([budget("a", 100, 10), budget("b", 100, 50), budget("c", 100, 50)], [], []);
  assert.equal(frontEnvelope(envelopes, null)?.categoryId, "b"); // a tie keeps the first
  assert.equal(frontEnvelope(envelopes, "a")?.categoryId, "a");
  assert.equal(frontEnvelope(envelopes, "gone")?.categoryId, "b");
  assert.equal(frontEnvelope([], null), undefined);
});

test("envelopeStack: a tapped card comes to the front, the old front goes to the end of the tabs", () => {
  const { envelopes } = envelopesFor([budget("rent", 100, 10), budget("food", 100, 90), budget("bus", 100, 20), budget("fuel", 100, 5)], [], []);
  const ids = (s: ReturnType<typeof envelopeStack>) => [s.behind.map((e) => e.categoryId), s.front?.categoryId];
  assert.deepEqual(ids(envelopeStack(envelopes, [])), [["rent", "bus", "fuel"], "food"]); // most spent in front
  assert.deepEqual(ids(envelopeStack(envelopes, ["bus"])), [["rent", "fuel", "food"], "bus"]);
  assert.deepEqual(ids(envelopeStack(envelopes, ["bus", "rent"])), [["fuel", "food", "bus"], "rent"]);
  assert.deepEqual(ids(envelopeStack(envelopes, ["bus", "rent", "food"])), [["fuel", "bus", "rent"], "food"]);
  assert.deepEqual(ids(envelopeStack(envelopes, ["gone", "bus"])), [["rent", "fuel", "food"], "bus"]); // an envelope no longer there is ignored
  assert.deepEqual(ids(envelopeStack([], ["bus"])), [[], undefined]);
});

test("envelopeStatus says the state in words", () => {
  const money = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN")}`;
  const status = (b: Budget | null, spent = b?.spent ?? 0) =>
    envelopeStatus({ categoryId: "x", name: "X", budget: b, spent, count: 0, archived: false }, money);
  assert.deepEqual(status(budget("x", 1800000, 1800000)), { kind: "done", text: "₹18,000 / 18,000" });
  assert.deepEqual(status(budget("x", 800000, 630000)), { kind: "progress", text: "₹6,300 / 8,000" });
  assert.deepEqual(status(budget("x", 480000, 600000)), { kind: "over", text: "125% · over ₹1,200" });
  assert.deepEqual(status(budget("x", 0, 300)), { kind: "over", text: "over ₹3" }); // no budget to divide by, so no percent
  assert.deepEqual(status(null, 500), { kind: "unset", text: "not budgeted" });
});

test("copyBudgets writes in order and carries on past an individual failure", async () => {
  const written: string[] = [];
  const run = await copyBudgets(
    [item("a"), item("b"), item("c")],
    async (i) => {
      if (i.category_id === "b") throw new Error("category not found");
      written.push(i.category_id);
    },
    () => false
  );
  assert.deepEqual(written, ["a", "c"]);
  assert.deepEqual(run, { copied: 2, failed: 1, notTried: 0, stopped: false });
});

test("copyBudgets stops on a fatal error and reports partial progress", async () => {
  const written: string[] = [];
  const run = await copyBudgets(
    [item("a"), item("b"), item("c"), item("d")],
    async (i) => {
      if (i.category_id === "c") throw new Error("429");
      written.push(i.category_id);
    },
    (error) => error instanceof Error && error.message === "429"
  );
  assert.deepEqual(written, ["a", "b"]);
  assert.deepEqual(run, { copied: 2, failed: 1, notTried: 1, stopped: true });
});

test("copyBudgets with nothing planned does nothing", async () => {
  assert.deepEqual(await copyBudgets([], async () => {}, () => false), { copied: 0, failed: 0, notTried: 0, stopped: false });
});

test("copySummary reads 'Copied 8 · skipped 2 · failed 1' and notes an early stop", () => {
  assert.equal(copySummary({ copied: 8, failed: 1, notTried: 0, stopped: false }, 2), "Copied 8 · skipped 2 · failed 1");
  assert.equal(
    copySummary({ copied: 2, failed: 1, notTried: 3, stopped: true }, 0),
    "Copied 2 · skipped 0 · failed 1 · 3 not tried (stopped early)"
  );
});
