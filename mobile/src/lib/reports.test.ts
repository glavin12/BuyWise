import assert from "node:assert/strict";
import { test } from "node:test";

import {
  arrowPercent,
  barPercents,
  categoryShares,
  dailyAverage,
  dailyChange,
  daysCounted,
  keptLine,
  lastMonths,
  methodShares,
  monthLabel,
  monthYear,
  percentChange,
  periodLabel,
  savedBadge,
  signedCompact,
  signedPercent,
  trend,
  txnLabel,
} from "./reports.ts";

test("monthLabel is the 3-letter abbreviation, monthYear adds the year", () => {
  assert.equal(monthLabel({ month: 1, year: 2026 }), "Jan");
  assert.equal(monthLabel({ month: 12, year: 2026 }), "Dec");
  assert.equal(monthYear({ month: 9, year: 2026 }), "Sep 2026");
});

test("periodLabel names this month and last month, then the month and year", () => {
  const now = { month: 9, year: 2026 };
  assert.equal(periodLabel({ month: 9, year: 2026 }, now), "this month");
  assert.equal(periodLabel({ month: 8, year: 2026 }, now), "last month");
  assert.equal(periodLabel({ month: 7, year: 2026 }, now), "Jul 2026");
  // across the year boundary
  assert.equal(periodLabel({ month: 12, year: 2025 }, { month: 1, year: 2026 }), "last month");
  assert.equal(periodLabel({ month: 11, year: 2025 }, { month: 1, year: 2026 }), "Nov 2025");
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

test("barPercents scales every column off the single biggest value, and is all zero when nothing happened", () => {
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

test("percentChange is to one decimal, null with nothing before", () => {
  assert.equal(percentChange(5300, 5000), 6);
  assert.equal(percentChange(5000, 5300), -5.7);
  assert.equal(percentChange(0, 100), -100);
  assert.equal(percentChange(100, 100), 0);
  assert.equal(percentChange(500, 0), null);
  assert.equal(percentChange(0, 0), null);
});

test("signedPercent and arrowPercent read the sign, and say so when there is nothing to compare", () => {
  assert.equal(signedPercent(7.5), "+7.5%");
  assert.equal(signedPercent(-2.4), "−2.4%");
  assert.equal(signedPercent(0), "0%");
  assert.equal(signedPercent(null), "—");
  assert.equal(arrowPercent(7.5), "↑ 7.5%");
  assert.equal(arrowPercent(-2.4), "↓ 2.4%");
  assert.equal(arrowPercent(0), "→ 0%");
  assert.equal(arrowPercent(null), "—");
});

test("trend is good news when income or savings rise or spending falls, flat with no move", () => {
  assert.equal(trend(7.5, true), "good");
  assert.equal(trend(-7.5, true), "bad");
  assert.equal(trend(-2.4, false), "good");
  assert.equal(trend(2.4, false), "bad");
  assert.equal(trend(0, true), "flat");
  assert.equal(trend(null, false), "flat");
});

test("signedCompact is a short signed amount", () => {
  assert.equal(signedCompact(320000, "INR"), "+₹3.2K");
  assert.equal(signedCompact(-110000, "INR"), "−₹1.1K");
  assert.equal(signedCompact(0, "INR"), "₹0");
  assert.equal(signedCompact(-5000, "INR"), "−₹50");
  assert.equal(signedCompact(320000, "USD"), "+$3.2K");
});

test("daysCounted is the day so far for the running month and all its days for a past one", () => {
  assert.equal(daysCounted({ month: 9, year: 2026 }, "2026-09-24"), 24);
  assert.equal(daysCounted({ month: 9, year: 2026 }, "2026-09-01"), 1);
  assert.equal(daysCounted({ month: 8, year: 2026 }, "2026-09-24"), 31);
  assert.equal(daysCounted({ month: 2, year: 2026 }, "2026-09-24"), 28);
  assert.equal(daysCounted({ month: 2, year: 2028 }, "2028-09-24"), 29); // a leap year
  assert.equal(daysCounted({ month: 12, year: 2025 }, "2026-01-05"), 31); // last month, over the year boundary
});

test("dailyAverage rounds to a whole currency unit and never divides by zero", () => {
  assert.equal(dailyAverage(3214000, 30), 107100); // ₹32,140 over 30 days = ₹1,071.33
  assert.equal(dailyAverage(3214000, 0), 0);
  assert.equal(dailyAverage(0, 24), 0);
});

test("dailyChange compares the two averages without rounding them first", () => {
  assert.equal(dailyChange(3000, 30, 3100, 31), 0); // ₹100 a day both months
  assert.equal(dailyChange(6000, 30, 3100, 31), 100); // twice as much a day
  assert.equal(dailyChange(1500, 15, 3100, 31), 0); // half a month in, same pace
  assert.equal(dailyChange(500, 10, 0, 30), null); // nothing spent the month before
});

test("keptLine is honest with no income, and when more was spent than came in", () => {
  assert.equal(keptLine(5000000, 3214000), "You kept\n36% of it");
  assert.equal(keptLine(10000, 10000), "You kept\n0% of it");
  assert.equal(keptLine(10000, 0), "You kept\n100% of it");
  assert.equal(keptLine(0, 0), "No income\nlogged");
  assert.equal(keptLine(0, 5000), "No income\nlogged");
  assert.equal(keptLine(10000, 12000), "You spent\n120% of it");
  assert.equal(keptLine(100, 100000), "You spent\n999%+ of it");
});

test("savedBadge says saved or overspent, and nothing when nothing was logged", () => {
  const money = (minor: number) => `₹${minor / 100}`;
  assert.equal(savedBadge(5000000, 3214000, money), "₹17860 saved");
  assert.equal(savedBadge(10000, 12000, money), "₹20 overspent");
  assert.equal(savedBadge(0, 5000, money), "₹50 overspent");
  assert.equal(savedBadge(0, 0, money), null);
});

test("txnLabel is singular for one", () => {
  assert.equal(txnLabel(1), "1 txn");
  assert.equal(txnLabel(14), "14 txns");
  assert.equal(txnLabel(0), "0 txns");
});

const row = (id: string, amount: number, count = 1) => ({ category_id: id, category: id.toUpperCase(), color: null, amount, transaction_count: count });

test("categoryShares keeps up to five categories by name, biggest first", () => {
  const shares = categoryShares([row("b", 300), row("a", 500), row("c", 200)]);
  assert.deepEqual(
    shares.map((s) => [s.name, s.amount, s.percent, s.other]),
    [
      ["A", 500, 50, false],
      ["B", 300, 30, false],
      ["C", 200, 20, false],
    ]
  );
  // exactly five: the fifth is a tail of one, so it keeps its name instead of becoming "Other"
  const five = categoryShares([row("a", 50), row("b", 40), row("c", 30), row("d", 20), row("e", 10)]);
  assert.deepEqual(five.map((s) => s.name), ["A", "B", "C", "D", "E"]);
});

test("categoryShares sums everything past the top four into Other", () => {
  const shares = categoryShares([row("a", 600, 2), row("b", 200, 3), row("c", 100, 4), row("d", 50, 5), row("e", 30, 6), row("f", 20, 7)]);
  assert.deepEqual(shares.map((s) => s.name), ["A", "B", "C", "D", "Other"]);
  const other = shares[4];
  assert.equal(other.amount, 50);
  assert.equal(other.count, 13);
  assert.equal(other.percent, 5);
  assert.equal(other.other, true);
  assert.equal(other.key, "other");
});

test("categoryShares drops zero amounts and is empty when nothing was spent", () => {
  assert.deepEqual(categoryShares([]), []);
  assert.deepEqual(categoryShares([row("a", 0)]), []);
  assert.deepEqual(categoryShares([row("a", 0), row("b", 100)]).map((s) => s.name), ["B"]);
});

test("methodShares orders by amount, keeps the untagged as null, and drops zeros", () => {
  const shares = methodShares([
    { payment_method: "card", amount: 25 },
    { payment_method: "upi", amount: 50 },
    { payment_method: null, amount: 25 },
    { payment_method: "cash", amount: 0 },
  ]);
  assert.deepEqual(
    shares.map((s) => [s.key, s.method, s.percent]),
    [
      ["upi", "upi", 50],
      ["card", "card", 25],
      ["none", null, 25],
    ]
  );
  assert.deepEqual(methodShares([]), []);
});
