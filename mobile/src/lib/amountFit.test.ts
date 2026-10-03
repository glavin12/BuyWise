import assert from "node:assert/strict";
import { test } from "node:test";

import { fitFontSize } from "./amountFit.ts";

test("keeps the full size while the figure fits", () => {
  assert.equal(fitFontSize(1, 295, 86), 86);
  assert.equal(fitFontSize(0, 295, 86), 86); // an empty field is measured as one character
});

test("shrinks as the figure grows", () => {
  assert.equal(fitFontSize(8, 295, 86), 73);
  assert.equal(fitFontSize(13, 295, 86), 45);
});

test("never goes below the minimum", () => {
  assert.equal(fitFontSize(30, 100, 86), 36);
  assert.equal(fitFontSize(30, 100, 86, 20), 20);
});

test("uses the full size until the width is measured", () => {
  assert.equal(fitFontSize(5, 0, 86), 86);
  assert.equal(fitFontSize(5, -4, 86), 86);
  assert.equal(fitFontSize(5, Number.NaN, 86), 86);
});
