import assert from "node:assert/strict";
import { test } from "node:test";

import { categoryHue, hueForColor } from "./categoryStyle.ts";

test("seeded names map to their hue", () => {
  assert.equal(categoryHue("Food"), "coral");
  assert.equal(categoryHue("Salary"), "mint");
  assert.equal(categoryHue("Transport"), "sky");
});

test("a saved colour wins over the name, matched on the bar hex in any case", () => {
  assert.equal(hueForColor("#a46fcf"), "plum");
  assert.equal(categoryHue("Food", "#A46FCF"), "plum");
  assert.equal(categoryHue("Food", "#F97316"), "coral"); // the backend's seeded hex is not a palette colour: ignored
});

test("unknown names get a stable, non-neutral hue; no name is neutral", () => {
  const hue = categoryHue("Chai with friends");
  assert.equal(categoryHue("Chai with friends"), hue);
  assert.notEqual(hue, "neutral");
  // Same hash as the web: (h << 5) - h + code, over "ab" = 97 * 31 + 98 = 3105, 3105 % 7 = 4 -> plum.
  assert.equal(categoryHue("ab"), "plum");
  assert.equal(categoryHue(null), "neutral");
});
