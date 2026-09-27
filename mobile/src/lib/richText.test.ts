import assert from "node:assert/strict";
import { test } from "node:test";

import { escapeRich, parseRich } from "./richText.ts";

test("parseRich splits words and chips and keeps the spacing between them", () => {
  assert.deepEqual(parseRich("Up {mint:+₹17,860} this month."), [
    { kind: "word", text: "Up", space: true },
    { kind: "mint", text: "+₹17,860", space: true },
    { kind: "word", text: "this", space: true },
    { kind: "word", text: "month.", space: false },
  ]);
});

test("parseRich reads links and glues punctuation to the chip before it", () => {
  assert.deepEqual(parseRich("{hi@budget:₹4,860}. Done"), [
    { kind: "hi", text: "₹4,860", space: false, link: "budget" },
    { kind: "word", text: ".", space: true },
    { kind: "word", text: "Done", space: false },
  ]);
});

test("parseRich leaves unknown kinds and stray braces as words", () => {
  assert.deepEqual(parseRich("a {big:x} }"), [
    { kind: "word", text: "a", space: true },
    { kind: "word", text: "{big:x}", space: true },
    { kind: "word", text: "}", space: false },
  ]);
  assert.deepEqual(parseRich(""), []);
});

test("escapeRich stops interpolated values from opening a chip", () => {
  assert.deepEqual(parseRich(`Paid ${escapeRich("{mint:x}")}`).map((p) => p.kind), ["word", "word"]);
});
