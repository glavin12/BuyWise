import assert from "node:assert/strict";
import { test } from "node:test";

import {
  budgetProgress,
  budgetRow,
  byAssigned,
  copyBudgets,
  carriedRow,
  copySummary,
  coverAmount,
  readyLine,
  unbudgetedCategories,
} from "./budget.ts";
import type { BudgetCopyItem } from "./ledger.ts";
import type { Budget, Category } from "./types";

function category(id: string, name: string, extra: Partial<Category> = {}): Category {
  return { id, name, type: "expense", icon: null, color: null, is_active: true, created_at: null, updated_at: null, ...extra };
}

const item = (id: string): BudgetCopyItem => ({ category_id: id, category: id, budgeted_amount: 1000 });

test("readyLine words the unassigned money, over-assigned included", () => {
  assert.equal(readyLine(486000), "give every rupee a job");
  assert.equal(readyLine(0), "every rupee has a job");
  assert.equal(readyLine(-100), "you assigned more than you have");
});

test("coverAmount is the assigned amount that brings an overspent category back to zero", () => {
  assert.equal(coverAmount(300000, -50000), 350000);
  assert.equal(coverAmount(0, -300), 300);
  assert.equal(coverAmount(300000, 0), null);
  assert.equal(coverAmount(300000, 120000), null);
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

test("byAssigned: the most assigned first, ties by name", () => {
  const sorted = byAssigned([budget("fuel", 100, 0), budget("rent", 1800000, 0), budget("bus", 100, 0), budget("food", 800000, 0)]);
  assert.deepEqual(sorted.map((b) => b.category_id), ["rent", "food", "bus", "fuel"]);
});

test("budgetRow says the state in words, with what is available", () => {
  const money = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN")}`;
  const row = (budgeted: number, spent: number) => budgetRow(budget("x", budgeted, spent), money);
  assert.deepEqual(row(150000, 124000), { kind: "left", available: "₹260", line: "₹1,240 of ₹1,500 spent", barPercent: 83 });
  assert.deepEqual(row(1800000, 1800000), { kind: "done", available: "₹0", line: "fully spent", barPercent: 100 });
  assert.deepEqual(row(500000, 620000), { kind: "over", available: "−₹1,200", line: "overspent by ₹1,200", barPercent: 100 });
  assert.deepEqual(row(0, 0), { kind: "done", available: "₹0", line: "nothing assigned", barPercent: 0 });
  assert.deepEqual(row(0, 300), { kind: "over", available: "−₹3", line: "overspent by ₹3", barPercent: 100 });
  assert.equal(row(800000, 0).line, "₹0 of ₹8,000 spent");
});

test("budgetRow with rollover: the pill is available money, the bar and 'spent' stay this month's", () => {
  const money = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN")}`;
  const row = (budgeted: number, spent: number, carried: number) =>
    budgetRow({ budgeted_amount: budgeted, spent, carried_in: carried, available: carried + budgeted - spent }, money);
  // September's Food: ₹1,000 carried in, ₹8,000 assigned, ₹7,500 spent -> ₹1,500 available
  assert.deepEqual(row(800000, 750000, 100000), { kind: "left", available: "₹1,500", line: "₹7,500 of ₹8,000 spent · +₹1,000 carried", barPercent: 94 });
  // Entertainment: a ₹500 overspend carried in is paid off by this month's ₹3,000
  assert.deepEqual(row(300000, 200000, -50000), { kind: "left", available: "₹500", line: "₹2,000 of ₹3,000 spent · −₹500 carried", barPercent: 67 });
  // still in debt: red, and the bar shows only this month's 40%
  assert.deepEqual(row(100000, 40000, -90000), { kind: "over", available: "−₹300", line: "overspent by ₹300 · −₹900 carried", barPercent: 40 });
  // carried money used up exactly
  assert.deepEqual(row(0, 50000, 50000), { kind: "done", available: "₹0", line: "fully spent · +₹500 carried", barPercent: 100 });
  // a budget with nothing carried reads exactly as before
  assert.equal(row(150000, 124000, 0).line, "₹1,240 of ₹1,500 spent");
});

test("carriedRow: a category with money carried in but no budget this month", () => {
  const money = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN")}`;
  assert.deepEqual(carriedRow({ carried_in: 60000, spent: 10000, available: 50000 }, money), {
    kind: "left",
    available: "₹500",
    line: "₹100 spent · +₹600 carried",
    barPercent: 17, // ₹100 of the ₹600 carried in
  });
  assert.equal(carriedRow({ carried_in: 150000, spent: 0, available: 150000 }, money).line, "nothing assigned · +₹1,500 carried");
  assert.deepEqual(carriedRow({ carried_in: -50000, spent: 0, available: -50000 }, money), {
    kind: "over",
    available: "−₹500",
    line: "overspent by ₹500 · −₹500 carried",
    barPercent: 100,
  });
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
