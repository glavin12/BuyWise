import assert from "node:assert/strict";
import { test } from "node:test";

import { heroFit } from "./authLayout.ts";

test("the design's 390 x 844 frame gets the whole hero and its full wordmark row", () => {
  assert.deepEqual(heroFit(390, 844, 44, 20), { width: 390, lead: 26, height: 372 });
});

test("a tall phone keeps the hero whole and the sheet takes the spare height", () => {
  assert.deepEqual(heroFit(412, 915, 32, 32), { width: 412, lead: 26, height: 393 });
});

test("an iPhone with a notch and a home indicator gives up the wordmark row before any of the hero", () => {
  assert.deepEqual(heroFit(390, 844, 47, 42), { width: 390, lead: 1, height: 372 });
});

test("a short phone crops the hero's sky down to the minimum, then scrolls", () => {
  const short = heroFit(375, 667, 20, 20);
  assert.equal(short.lead, 0);
  assert.equal(short.height, Math.round((262 * 375) / 390));
  assert.equal(heroFit(390, 300, 20, 20).height, 262);
});

test("a wide screen gets a 480 column and a hero scaled to it", () => {
  assert.deepEqual(heroFit(768, 1024, 24, 20), { width: 480, lead: 26, height: 458 });
});
