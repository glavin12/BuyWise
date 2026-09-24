import assert from "node:assert/strict";
import { test } from "node:test";

import { budgetProgress, budgetStatusText, copyBudgets, copySummary, isArchivedBudget, readyToAssign, unbudgetedCategories } from "./budget.ts";
import type { BudgetCopyItem } from "./ledger.ts";
import type { Category } from "./types";

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

test("isArchivedBudget: a budget whose category is not in the active list", () => {
  const active = new Set(["food"]);
  assert.equal(isArchivedBudget({ category_id: "food" }, active), false);
  assert.equal(isArchivedBudget({ category_id: "gone" }, active), true);
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

test("budgetStatusText says over or left in words, with the true percent", () => {
  const money = (minor: number) => `$${minor / 100}`;
  assert.equal(budgetStatusText(budgetProgress({ budgeted_amount: 100000, spent: 60000 }), money), "$400 left · 60% used");
  assert.equal(budgetStatusText(budgetProgress({ budgeted_amount: 40000, spent: 50000 }), money), "Over by $100 · 125% used");
  assert.equal(budgetStatusText(budgetProgress({ budgeted_amount: 500, spent: 500 }), money), "$0 left · 100% used");
  assert.equal(budgetStatusText(budgetProgress({ budgeted_amount: 0, spent: 300 }), money), "Over by $3"); // no budget to divide by, so no percent
});
