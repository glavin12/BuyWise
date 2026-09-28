import assert from "node:assert/strict";
import { test } from "node:test";

import { balanceSentence, compactMoney, dailyBudget, dailySpend, pulsePercents, splitFraction, topCategories, weekOf, wholeIfRound } from "./home.ts";
import type { DashboardData, Transaction } from "./types";

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

test("balanceSentence covers each budget state and pluralises goals", () => {
  const base = {
    net: 1786000, display_net: 17860, has_budget: true, unassigned: 486000, display_unassigned: 4860,
    remaining_budget: 0, display_remaining_budget: 0, active_goals_count: 3,
  } as DashboardData;
  const money = (v: number) => `₹${v}`;
  assert.equal(
    balanceSentence(base, "this month", money),
    "Up {mint:+₹17860} this month. {hi@budget:₹4860} is ready to assign. {dark@goals:3 goals} in progress.",
  );
  const over = { ...base, net: -100, display_net: -1, unassigned: 0, remaining_budget: -500, display_remaining_budget: -5, active_goals_count: 1 };
  assert.equal(balanceSentence(over, "last month", money), "Down {coral:−₹1} last month. {coral@budget:₹5} over budget. {dark@goals:1 goal} in progress.");
  const none = { ...base, net: 0, has_budget: false, active_goals_count: 0 };
  assert.equal(balanceSentence(none, "this month", money), "Even this month. No budget yet: {hi@budget:set one}. No goals yet: {dark@goals:add one}.");
});
