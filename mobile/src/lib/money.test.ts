import assert from "node:assert/strict";
import { test } from "node:test";

import { minorToAmountText, parseAmountToMinor, parsePositiveAmount, sanitizeAmountInput, sumMinor } from "./money.ts";

test("minorToAmountText shows minor units as field text and round-trips through the parser", () => {
  assert.equal(minorToAmountText(25000), "250");
  assert.equal(minorToAmountText(25050), "250.50");
  assert.equal(minorToAmountText(5), "0.05");
  assert.equal(minorToAmountText(0), "0");
  for (const minor of [0, 1, 99, 100, 101, 1050, 999999999900]) {
    assert.equal(parseAmountToMinor(minorToAmountText(minor)), minor);
  }
});

test("parses plain amounts to integer minor units", () => {
  assert.equal(parseAmountToMinor("250"), 25000);
  assert.equal(parseAmountToMinor("12.3"), 1230);
  assert.equal(parseAmountToMinor("12.34"), 1234);
  assert.equal(parseAmountToMinor("0.05"), 5);
  assert.equal(parseAmountToMinor("0"), 0);
  assert.equal(parseAmountToMinor("  99.99 "), 9999);
});

test("a comma is the decimal point when it is the only separator", () => {
  assert.equal(parseAmountToMinor("0,5"), 50);
  assert.equal(parseAmountToMinor("12,34"), 1234);
});

test("strips leading zeros and accepts half-typed decimals", () => {
  assert.equal(parseAmountToMinor("00150"), 15000);
  assert.equal(parseAmountToMinor(".5"), 50);
  assert.equal(parseAmountToMinor("5."), 500);
});

test("never rounds: more than 2 decimals is invalid", () => {
  assert.equal(parseAmountToMinor("1.005"), null);
  assert.equal(parseAmountToMinor("0.999"), null);
});

test("rejects signs, exponents, letters, thousands separators and empties", () => {
  for (const bad of ["1e5", "-5", "+5", "abc", "1 000", "1,234.50", "1.2.3", "1,2,3", "", "  ", ".", ","]) {
    assert.equal(parseAmountToMinor(bad), null, `"${bad}" should be invalid`);
  }
});

test("limits the integer part to 10 digits", () => {
  assert.equal(parseAmountToMinor("9999999999"), 999999999900);
  assert.equal(parseAmountToMinor("12345678901"), null); // 11 digits
  assert.equal(parseAmountToMinor("00000000001"), 100); // zeros do not count
});

test("no float drift: sums of integers stay exact", () => {
  assert.equal(sumMinor([parseAmountToMinor("0.1")!, parseAmountToMinor("0.2")!]), 30);
  assert.equal(sumMinor([]), 0);
});

test("sanitizeAmountInput keeps pasted text inside what parseAmountToMinor accepts", () => {
  assert.equal(sanitizeAmountInput("₹1,234.50"), "1234.50"); // thousands + decimal
  assert.equal(sanitizeAmountInput("1.234,50"), "1234.50");
  assert.equal(sanitizeAmountInput("12a.3b4c5"), "12.34"); // junk and a 3rd decimal dropped
  assert.equal(sanitizeAmountInput("-5"), "5");
  assert.equal(sanitizeAmountInput("1e5"), "15");
  assert.equal(sanitizeAmountInput("0,5"), "0.5");
  assert.equal(sanitizeAmountInput("12345678901234"), "1234567890"); // 10 digits max
  assert.equal(sanitizeAmountInput(""), "");
  for (const pasted of ["₹1,234.50", "1.234,50", "12a.3b4c5", "--1e5", "9,9,9", "١٢٣"]) {
    const clean = sanitizeAmountInput(pasted);
    assert.ok(clean === "" || parseAmountToMinor(clean) !== null, `"${pasted}" -> "${clean}"`);
  }
});

test("parsePositiveAmount gives minor units, or the reason the text is not usable", () => {
  assert.deepEqual(parsePositiveAmount("500"), { minor: 50000, error: null });
  assert.deepEqual(parsePositiveAmount("0,5"), { minor: 50, error: null });
  assert.equal(parsePositiveAmount("").error, "Enter an amount.");
  assert.equal(parsePositiveAmount("   ").error, "Enter an amount.");
  assert.equal(parsePositiveAmount("0").error, "The amount must be more than 0.");
  assert.equal(parsePositiveAmount("0.00").error, "The amount must be more than 0.");
  assert.equal(parsePositiveAmount("1.005").error, "Enter a valid amount, like 500 or 500.50.");
  assert.equal(parsePositiveAmount("-5").minor, null);
});
