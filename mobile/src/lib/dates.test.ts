import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isOverAYearAgo,
  isValidRange,
  monthKey,
  monthShift,
  parseDateOnly,
  rangeFor,
  relativeDayLabel,
  shiftDays,
  todayLocal,
  toYmd,
} from "./dates.ts";

// Dates are built from LOCAL components so these tests give the same answer in any timezone.

test("todayLocal uses the local calendar date, not the UTC one", () => {
  assert.equal(todayLocal(new Date(2026, 0, 1, 0, 30)), "2026-01-01"); // 00:30 local
  assert.equal(todayLocal(new Date(2026, 11, 31, 23, 59)), "2026-12-31"); // 23:59 local
  assert.equal(toYmd(new Date(2026, 8, 5)), "2026-09-05"); // zero-padded
});

test("parseDateOnly returns a local date and rejects impossible ones", () => {
  const d = parseDateOnly("2026-03-09");
  assert.ok(d);
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 2, 9, 0]);
  assert.equal(parseDateOnly("2026-02-31"), null);
  assert.equal(parseDateOnly("2026-13-01"), null);
  assert.equal(parseDateOnly("2026-00-10"), null);
  assert.equal(parseDateOnly("0099-01-01"), null);
  assert.equal(parseDateOnly("2026-3-9"), null);
  assert.equal(parseDateOnly("not a date"), null);
  assert.ok(parseDateOnly("2024-02-29")); // leap day
  assert.equal(parseDateOnly("2026-02-29"), null);
});

test("monthShift rolls over the year in both directions", () => {
  assert.deepEqual(monthShift(12, 2026, 1), { month: 1, year: 2027 });
  assert.deepEqual(monthShift(1, 2026, -1), { month: 12, year: 2025 });
  assert.deepEqual(monthShift(3, 2026, -14), { month: 1, year: 2025 });
  assert.deepEqual(monthShift(6, 2026, 0), { month: 6, year: 2026 });
});

test("monthShift clamps to the years the backend accepts (2020-2100)", () => {
  assert.deepEqual(monthShift(1, 2020, -1), { month: 1, year: 2020 });
  assert.deepEqual(monthShift(6, 2020, -100), { month: 1, year: 2020 });
  assert.deepEqual(monthShift(12, 2100, 1), { month: 12, year: 2100 });
  assert.deepEqual(monthShift(11, 2100, 1), { month: 12, year: 2100 });
});

test("rangeFor gives explicit inclusive local-calendar bounds", () => {
  const now = new Date(2026, 8, 24, 14, 0); // 24 Sep 2026
  assert.deepEqual(rangeFor("this_month", now), { date_from: "2026-09-01", date_to: "2026-09-30" });
  assert.deepEqual(rangeFor("last_month", now), { date_from: "2026-08-01", date_to: "2026-08-31" });
  assert.deepEqual(rangeFor("last_3_months", now), { date_from: "2026-07-01", date_to: "2026-09-30" });
});

test("rangeFor handles year boundaries and leap February", () => {
  assert.deepEqual(rangeFor("last_month", new Date(2026, 0, 15)), { date_from: "2025-12-01", date_to: "2025-12-31" });
  assert.deepEqual(rangeFor("last_3_months", new Date(2026, 1, 10)), { date_from: "2025-12-01", date_to: "2026-02-28" });
  assert.deepEqual(rangeFor("this_month", new Date(2028, 1, 10)), { date_from: "2028-02-01", date_to: "2028-02-29" });
});

test("shiftDays and relativeDayLabel", () => {
  assert.equal(shiftDays("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDays("2026-12-31", 1), "2027-01-01");
  assert.equal(relativeDayLabel("2026-09-24", "2026-09-24"), "Today");
  assert.equal(relativeDayLabel("2026-09-23", "2026-09-24"), "Yesterday");
  assert.equal(relativeDayLabel("2026-09-22", "2026-09-24"), null);
  assert.equal(relativeDayLabel("2026-12-31", "2027-01-01"), "Yesterday");
});

test("monthKey and range validation", () => {
  assert.equal(monthKey(3, 2026), "2026-03");
  assert.ok(isValidRange({ date_from: "2026-01-01", date_to: "2026-01-01" }));
  assert.ok(!isValidRange({ date_from: "2026-02-01", date_to: "2026-01-01" }));
  assert.ok(!isValidRange({ date_from: "2026-02-30", date_to: "2026-03-01" }));
});

test("isOverAYearAgo flags likely typos only", () => {
  assert.ok(isOverAYearAgo("2025-09-23", "2026-09-24"));
  assert.ok(!isOverAYearAgo("2025-09-24", "2026-09-24"));
  assert.ok(!isOverAYearAgo("2027-01-01", "2026-09-24")); // future dates are allowed
});
