import assert from "node:assert/strict";
import { test } from "node:test";

import { averageRate, barPercents, lastMonths, monthLabel, rateInsight, savingsRate, topCategory } from "./reports.ts";

test("monthLabel is the 3-letter abbreviation", () => {
  assert.equal(monthLabel({ month: 1, year: 2026 }), "Jan");
  assert.equal(monthLabel({ month: 12, year: 2026 }), "Dec");
});

test("lastMonths returns count months ending at `to`, oldest first", () => {
  assert.deepEqual(lastMonths({ month: 3, year: 2026 }, 3), [
    { month: 1, year: 2026 },
    { month: 2, year: 2026 },
    { month: 3, year: 2026 },
  ]);
  // rolls over the year boundary
  assert.deepEqual(lastMonths({ month: 1, year: 2026 }, 2), [
    { month: 12, year: 2025 },
    { month: 1, year: 2026 },
  ]);
});

test("savingsRate is net/income*100, null when there was no income", () => {
  assert.equal(savingsRate({ income: 10000, net: 2500 }), 25);
  assert.equal(savingsRate({ income: 0, net: 0 }), null);
  assert.equal(savingsRate({ income: -100, net: 50 }), null); // "or less" (income never actually goes negative, but guard it)
  assert.equal(savingsRate({ income: 10000, net: -2000 }), -20);
});

test("averageRate ignores no-income months and needs at least 2 with income", () => {
  assert.equal(averageRate([]), null);
  assert.equal(averageRate([{ income: 10000, net: 2000 }]), null); // only one month had income
  assert.equal(averageRate([{ income: 0, net: 0 }, { income: 0, net: 0 }]), null); // zero months don't count
  assert.equal(
    averageRate([
      { income: 10000, net: 2000 }, // 20%
      { income: 0, net: 0 }, // skipped
      { income: 10000, net: 4000 }, // 40%
    ]),
    30
  );
});

test("rateInsight covers the null and equal edges", () => {
  assert.equal(rateInsight(null, null), "Add income this month to see your savings rate.");
  assert.equal(rateInsight(30, null), "30% saved this month.");
  assert.equal(rateInsight(30, 30), "30% saved, in line with your 6-month average.");
  assert.equal(rateInsight(35, 30), "35% saved, 5 points above your 6-month average.");
  assert.equal(rateInsight(20, 30), "20% saved, 10 points below your 6-month average.");
});

test("topCategory names the largest share, null for an empty list", () => {
  assert.equal(topCategory([]), null);
  assert.equal(
    topCategory([
      { category: "Food", percent_of_total: 40 },
      { category: "Rent", percent_of_total: 55.4 },
    ]),
    "Rent leads at 55% of spend"
  );
});

test("barPercents scales every bar off the single biggest value, and is all zero when nothing happened", () => {
  assert.deepEqual(
    barPercents([
      { income: 10000, expenses: 4000 },
      { income: 5000, expenses: 10000 },
    ]),
    [
      { incomePercent: 100, spendPercent: 40 },
      { incomePercent: 50, spendPercent: 100 },
    ]
  );
  assert.deepEqual(barPercents([{ income: 0, expenses: 0 }]), [{ incomePercent: 0, spendPercent: 0 }]);
  assert.deepEqual(barPercents([]), []);
});
