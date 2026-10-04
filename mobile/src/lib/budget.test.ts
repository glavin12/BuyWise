import assert from "node:assert/strict";
import { test } from "node:test";

import {
  budgetRow,
  byAttention,
  copyBudgets,
  carriedRow,
  copySummary,
  coverAmount,
  monthFlow,
  monthGone,
  readyLine,
  unbudgetedCategories,
} from "./budget.ts";
import type { BudgetCopyItem } from "./ledger.ts";
import type { Budget, Category } from "./types";

function category(id: string, name: string, extra: Partial<Category> = {}): Category {
  return { id, name, type: "expense", icon: null, color: null, is_active: true, created_at: null, updated_at: null, ...extra };
}

const item = (id: string): BudgetCopyItem => ({ category_id: id, category: id, budgeted_amount: 1000 });

test("readyLine words the money left to budget, over-budgeted included", () => {
  assert.equal(readyLine(486000), "Money you have that isn't in a budget yet.");
  assert.equal(readyLine(0), "All your money is budgeted.");
  assert.equal(readyLine(-100), "You budgeted more than you have.");
});

test("coverAmount is the budgeted amount that brings an overspent category back to zero", () => {
  assert.equal(coverAmount(300000, -50000), 350000);
  assert.equal(coverAmount(0, -300), 300);
  assert.equal(coverAmount(300000, 0), null);
  assert.equal(coverAmount(300000, 120000), null);
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

const money = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN")}`;

test("budgetRow: one figure, left or over, and a bar against what the category had, so the two agree", () => {
  const row = (budgeted: number, spent: number) => budgetRow(budget("x", budgeted, spent), money, "Sep");
  assert.deepEqual(row(1000000, 400000), { kind: "left", figure: "₹6,000", word: "left", line: "₹4,000 of ₹10,000 spent", barPercent: 40, available: 600000 });
  // 83% used: nearly spent
  assert.deepEqual(row(150000, 124000), { kind: "near", figure: "₹260", word: "left", line: "₹1,240 of ₹1,500 spent", barPercent: 83, available: 26000 });
  assert.deepEqual(row(1800000, 1800000), { kind: "done", figure: "₹0", word: "left", line: "₹18,000 of ₹18,000 spent", barPercent: 100, available: 0 });
  assert.deepEqual(row(500000, 620000), { kind: "over", figure: "₹1,200", word: "over", line: "₹6,200 of ₹5,000 spent", barPercent: 100, available: -120000 });
  assert.deepEqual(row(0, 0), { kind: "done", figure: "₹0", word: "left", line: "nothing spent", barPercent: 0, available: 0 });
  assert.deepEqual(row(0, 300), { kind: "over", figure: "₹3", word: "over", line: "₹3 spent", barPercent: 100, available: -300 });
  assert.equal(row(800000, 0).line, "₹0 of ₹8,000 spent");
  // 74.99% is not yet "nearly spent": decided on the integers
  assert.equal(row(1000000, 749900).kind, "left");
  assert.equal(row(1000000, 750000).kind, "near");
});

test("budgetRow with rollover: the bar counts the carried money too, and the line names where it came from", () => {
  const row = (budgeted: number, spent: number, carried: number) =>
    budgetRow({ budgeted_amount: budgeted, spent, carried_in: carried, available: carried + budgeted - spent }, money, "Sep");
  // Food: ₹1,000 left over from September plus ₹8,000 budgeted, ₹7,500 spent: ₹1,500 left, 83% of ₹9,000 used
  assert.deepEqual(row(800000, 750000, 100000), {
    kind: "near",
    figure: "₹1,500",
    word: "left",
    line: "₹7,500 of ₹8,000 spent · +₹1,000 from Sep",
    barPercent: 83,
    available: 150000,
  });
  // Entertainment: a ₹500 overspend from September comes off this month's ₹3,000
  assert.deepEqual(row(300000, 200000, -50000), {
    kind: "near",
    figure: "₹500",
    word: "left",
    line: "₹2,000 of ₹3,000 spent · −₹500 from Sep",
    barPercent: 80,
    available: 50000,
  });
  // still in debt: over, and the bar is full
  assert.deepEqual(row(100000, 40000, -90000), {
    kind: "over",
    figure: "₹300",
    word: "over",
    line: "₹400 of ₹1,000 spent · −₹900 from Sep",
    barPercent: 100,
    available: -30000,
  });
  // carried money used up exactly
  assert.deepEqual(row(0, 50000, 50000), { kind: "done", figure: "₹0", word: "left", line: "₹500 spent · +₹500 from Sep", barPercent: 100, available: 0 });
  // nothing carried: no note
  assert.equal(row(150000, 124000, 0).line, "₹1,240 of ₹1,500 spent");
});

test("carriedRow: a category with money carried in but no budget this month", () => {
  assert.deepEqual(carriedRow({ carried_in: 60000, spent: 10000, available: 50000 }, money, "Sep"), {
    kind: "left",
    figure: "₹500",
    word: "left",
    line: "₹100 spent · +₹600 from Sep",
    barPercent: 17, // ₹100 of the ₹600 carried in
    available: 50000,
  });
  assert.equal(carriedRow({ carried_in: 150000, spent: 0, available: 150000 }, money, "Sep").line, "nothing spent · +₹1,500 from Sep");
  assert.deepEqual(carriedRow({ carried_in: -50000, spent: 0, available: -50000 }, money, "Dec"), {
    kind: "over",
    figure: "₹500",
    word: "over",
    line: "nothing spent · −₹500 from Dec",
    barPercent: 100,
    available: -50000,
  });
});

test("byAttention: overspent first, then nearly spent, the rest and finished; the least left first within each", () => {
  const rows = [
    { name: "Rent", state: { kind: "done", available: 0 } },
    { name: "Food", state: { kind: "near", available: 170000 } },
    { name: "Transport", state: { kind: "left", available: 230000 } },
    { name: "Coffee", state: { kind: "left", available: 20000 } },
    { name: "Groceries", state: { kind: "over", available: -120000 } },
    { name: "Fuel", state: { kind: "over", available: -5000 } },
    { name: "Bills", state: { kind: "done", available: 0 } },
  ] as const;
  assert.deepEqual(
    byAttention(rows).map((r) => r.name),
    ["Groceries", "Fuel", "Food", "Coffee", "Transport", "Bills", "Rent"],
  );
});

test("monthFlow: Started, In, Out and Now add up left to right", () => {
  assert.deepEqual(monthFlow(7486000, 9272000, 3214000, true, money), [
    { label: "Started", value: "₹74,860", tone: "text" },
    { label: "In", value: "+₹50,000", tone: "mint" },
    { label: "Out", value: "−₹32,140", tone: "text" },
    { label: "Now", value: "₹92,720", tone: "text" },
  ]);
  // A ₹10,000 starting balance logged this month counts as money in, so the row still adds up.
  assert.equal(monthFlow(0, 950000, 50000, true, money)[1].value, "+₹10,000");
  // A past month ends; negative balances are tomato; nothing in or out reads ₹0.
  assert.deepEqual(monthFlow(-20000, -20000, 0, false, money), [
    { label: "Started", value: "−₹200", tone: "tomato" },
    { label: "In", value: "₹0", tone: "mint" },
    { label: "Out", value: "₹0", tone: "text" },
    { label: "End", value: "−₹200", tone: "tomato" },
  ]);
});

test("monthGone: how much of today's month has gone, today included; null for any other month", () => {
  assert.equal(monthGone("2026-10-22", 10, 2026), 71);
  assert.equal(monthGone("2026-10-31", 10, 2026), 100);
  assert.equal(monthGone("2026-02-14", 2, 2026), 50);
  assert.equal(monthGone("2026-10-22", 9, 2026), null);
  assert.equal(monthGone("2025-10-22", 10, 2026), null);
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
