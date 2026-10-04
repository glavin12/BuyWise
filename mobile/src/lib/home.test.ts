import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compactMoney,
  dailyBudget,
  dailySpend,
  daysLeft,
  monthFigures,
  pulsePercents,
  safeLine,
  safeToSpend,
  splitFraction,
  topCategories,
  weekOf,
  wholeIfRound,
} from "./home.ts";
import type { Transaction } from "./types";

function tx(date: string, amount: number, extra: Partial<Transaction> = {}): Transaction {
  return {
    id: `${date}-${amount}`,
    category_id: "food",
    category: "Food",
    category_icon: null,
    payee_id: null,
    payee: null,
    amount,
    display_amount: amount / 100,
    currency: "INR",
    transaction_type: "expense",
    payment_method: null,
    transaction_date: date,
    description: null,
    notes: null,
    cleared_status: "cleared",
    parent_transaction_id: null,
    created_at: null,
    updated_at: null,
    ...extra,
  } as Transaction;
}

test("weekOf starts on Monday, also when today is Sunday, and steps back whole weeks", () => {
  // 2026-09-27 is a Sunday.
  assert.deepEqual(weekOf("2026-09-27"), ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
  assert.equal(weekOf("2026-09-21")[0], "2026-09-21");
  assert.equal(weekOf("2026-10-01", 1)[0], "2026-09-21"); // crosses the month
});

test("dailySpend counts expenses only, skips split children, and filters by category", () => {
  const days = weekOf("2026-09-24");
  const rows = [
    tx("2026-09-21", 500),
    tx("2026-09-21", 250, { category_id: "travel" }),
    tx("2026-09-21", 999, { parent_transaction_id: "p" }),
    tx("2026-09-22", 10000, { transaction_type: "income" }),
    tx("2026-09-20", 700), // the Sunday before
  ];
  assert.deepEqual(dailySpend(rows, days), [750, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(dailySpend(rows, days, "travel"), [250, 0, 0, 0, 0, 0, 0]);
});

test("topCategories ranks by spending", () => {
  const rows = [tx("2026-09-21", 100), tx("2026-09-22", 300, { category_id: "bills", category: "Bills" }), tx("2026-09-22", 50), tx("2026-09-23", 9, { category_id: null })];
  assert.deepEqual(topCategories(rows, 1).map((c) => [c.id, c.total]), [["bills", 300]]);
  assert.equal(topCategories(rows, 5).length, 2);
});

test("pulsePercents uses the daily budget, else the week's peak, and caps at 999", () => {
  assert.equal(dailyBudget(300000, 9, 2026), 10000); // 30 days in September
  assert.deepEqual(pulsePercents([5000, 12000, 0], 10000), { of: "budget", percents: [50, 120, 0] });
  assert.deepEqual(pulsePercents([500, 1000], 0), { of: "peak", percents: [50, 100] });
  assert.deepEqual(pulsePercents([0, 0], 0).percents, [0, 0]);
  assert.equal(pulsePercents([1e9], 100).percents[0], 999);
});

test("money strings", () => {
  assert.deepEqual(splitFraction("₹1,24,860.00"), ["₹1,24,860", ".00"]);
  assert.deepEqual(splitFraction("-₹5.50"), ["-₹5", ".50"]);
  assert.deepEqual(splitFraction("1.234,56 €"), ["1.234", ",56 €"]);
  assert.equal(wholeIfRound("₹17,860.00"), "₹17,860");
  assert.equal(wholeIfRound("₹12.50"), "₹12.50");
  assert.equal(compactMoney(34000, "INR"), "₹340");
  assert.equal(compactMoney(-1200000, "INR"), "₹12K");
  assert.equal(compactMoney(12500000, "INR"), "₹1.3L");
  assert.equal(compactMoney(150000000, "USD"), "$1.5M");
});

// 22 October 2026: 9 days left after today, so 10 to share over; 22 of 31 days gone.
const october22 = { has_budget: true, total_budgeted: 4700000, total_spent: 3212000, remaining_budget: 1488000, days_remaining_in_month: 9 };

test("safeToSpend shares what is left over the days left, today included, and compares spending with the month", () => {
  assert.deepEqual(safeToSpend(october22, 10, 2026), {
    kind: "ok",
    perDay: 148800, // ₹14,880 over 10 days
    left: 1488000,
    days: 10,
    usedPercent: 68,
    monthPercent: 71,
    ahead: false,
  });
  // ₹36,000 of ₹47,000 is 77%, against 71% of the month: spending faster than the month.
  const faster = safeToSpend({ ...october22, total_spent: 3600000, remaining_budget: 1100000 }, 10, 2026);
  assert.equal(faster.kind === "ok" && faster.ahead, true);
});

test("safeToSpend rounds down, counts the last day as one, and has nothing to share without a budget", () => {
  // ₹10,000 over 9 days is ₹1,111.11 and a third: never offer the third.
  const odd = safeToSpend({ ...october22, remaining_budget: 1000000, days_remaining_in_month: 8 }, 10, 2026);
  assert.equal(odd.kind === "ok" && odd.perDay, 111111);
  const last = safeToSpend({ ...october22, days_remaining_in_month: 0 }, 10, 2026);
  assert.equal(last.kind === "ok" && last.days, 1);
  assert.equal(last.kind === "ok" && last.perDay, 1488000);
  assert.equal(last.kind === "ok" && last.monthPercent, 100);
  assert.deepEqual(safeToSpend({ ...october22, has_budget: false }, 10, 2026), { kind: "none" });
  assert.deepEqual(safeToSpend({ ...october22, total_budgeted: 0, remaining_budget: -3212000 }, 10, 2026), { kind: "none" });
});

test("safeToSpend: a spent or overspent budget has nothing safe to spend and says by how much", () => {
  assert.deepEqual(safeToSpend({ ...october22, total_spent: 4820000, remaining_budget: -120000 }, 10, 2026), {
    kind: "over",
    overBy: 120000,
    days: 10,
    usedPercent: 103,
    monthPercent: 71,
  });
  const exact = safeToSpend({ ...october22, total_spent: 4700000, remaining_budget: 0 }, 10, 2026);
  assert.equal(exact.kind === "over" && exact.overBy, 0);
});

test("safeLine and daysLeft word each state", () => {
  const money = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN")}`;
  assert.equal(safeLine(safeToSpend(october22, 10, 2026), money), "On track: ₹14,880 left in your budget.");
  assert.equal(
    safeLine(safeToSpend({ ...october22, total_spent: 3600000, remaining_budget: 1100000 }, 10, 2026), money),
    "Spending faster than the month: ₹11,000 left in your budget.",
  );
  assert.equal(safeLine({ kind: "over", overBy: 120000, days: 10, usedPercent: 103, monthPercent: 71 }, money), "₹1,200 over this month's budget.");
  assert.equal(safeLine({ kind: "over", overBy: 0, days: 10, usedPercent: 100, monthPercent: 71 }, money), "This month's budget is all spent.");
  assert.equal(safeLine({ kind: "none" }, money), "Set a budget for this month to see what you can spend each day.");
  assert.equal(daysLeft(10), "10 days left");
  assert.equal(daysLeft(1), "last day");
});

test("monthFigures: In in mint, Out plain, Net signed and coloured by its direction", () => {
  const money = (minor: number) => `₹${minor / 100}`;
  assert.deepEqual(monthFigures({ total_income: 5000000, total_spent: 3214000, net: 1786000 }, "Oct", money), [
    { label: "In · Oct", value: "₹50000", tone: "mint" },
    { label: "Out", value: "₹32140", tone: "text" },
    { label: "Net", value: "+₹17860", tone: "mint" },
  ]);
  assert.deepEqual(monthFigures({ total_income: 0, total_spent: 50000, net: -50000 }, "Oct", money)[2], { label: "Net", value: "−₹500", tone: "tomato" });
  assert.deepEqual(monthFigures({ total_income: 0, total_spent: 0, net: 0 }, "Oct", money)[2], { label: "Net", value: "₹0", tone: "text" });
});
