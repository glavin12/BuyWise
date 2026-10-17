import assert from "node:assert/strict";
import { test } from "node:test";

import { FRESH_FOR, packSaved, SAVED_FOR, shownFreshness, unpackSaved } from "./cachePolicy.ts";

const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
const OWNER = { userId: "user-a", app: "1.0.0" };

type Q = { queryKey: unknown[]; meta?: Record<string, unknown>; state: { dataUpdatedAt: number; status: string; data: unknown; error: unknown } };

function query(key: string, saved: boolean, extra: Partial<Q["state"]> = {}): Q {
  return {
    queryKey: [key],
    ...(saved ? { meta: { saved: true } } : {}),
    state: { dataUpdatedAt: NOW - 60_000, status: "success", data: { key }, error: null, ...extra },
  };
}

test("packSaved writes only the queries marked saved, stamped with their owner", () => {
  const text = packSaved([query("dashboard", true), query("transactions-list", false)], OWNER);
  const file = JSON.parse(text);
  assert.equal(file.userId, "user-a");
  assert.equal(file.app, "1.0.0");
  assert.deepEqual(
    file.queries.map((q: Q) => q.queryKey[0]),
    ["dashboard"],
  );
});

test("packSaved stores a refresh that failed as its last success", () => {
  const failed = query("dashboard", true, { status: "error", error: { status: 0 } });
  const [saved] = JSON.parse(packSaved([failed], OWNER)).queries;
  assert.equal(saved.state.status, "success");
  assert.equal(saved.state.error, null);
  assert.deepEqual(saved.state.data, { key: "dashboard" });
});

test("unpackSaved gives the owner back what was saved, marked stale so the API confirms it", () => {
  const restored = unpackSaved<Q & { state: { isInvalidated?: boolean } }>(packSaved([query("dashboard", true), query("payees", true)], OWNER), OWNER, NOW);
  assert.deepEqual(
    restored.map((q) => q.queryKey[0]),
    ["dashboard", "payees"],
  );
  assert.ok(restored.every((q) => q.state.isInvalidated === true));
  assert.deepEqual(restored[0].state.data, { key: "dashboard" });
});

test("unpackSaved never hands one user's copy to another, or to another app version", () => {
  const text = packSaved([query("dashboard", true)], OWNER);
  assert.deepEqual(unpackSaved(text, { userId: "user-b", app: "1.0.0" }, NOW), []);
  assert.deepEqual(unpackSaved(text, { userId: "user-a", app: "1.1.0" }, NOW), []);
});

test("unpackSaved ignores a file from another cache version, a torn file and unmarked queries", () => {
  const file = JSON.parse(packSaved([query("dashboard", true)], OWNER));
  assert.deepEqual(unpackSaved(JSON.stringify({ ...file, version: 999 }), OWNER, NOW), []);
  assert.deepEqual(unpackSaved('{"version":1,"userId":"user-a"', OWNER, NOW), []);
  assert.deepEqual(unpackSaved("", OWNER, NOW), []);
  const planted = JSON.stringify({ ...file, queries: [...file.queries, query("transactions-list", false)] });
  assert.deepEqual(
    unpackSaved<Q>(planted, OWNER, NOW).map((q) => q.queryKey[0]),
    ["dashboard"],
  );
});

test("unpackSaved drops copies older than SAVED_FOR", () => {
  const text = packSaved(
    [query("dashboard", true, { dataUpdatedAt: NOW - SAVED_FOR - 1 }), query("payees", true, { dataUpdatedAt: NOW - SAVED_FOR + 60_000 })],
    OWNER,
  );
  assert.deepEqual(
    unpackSaved<Q>(text, OWNER, NOW).map((q) => q.queryKey[0]),
    ["payees"],
  );
});

const shown = (extra: Partial<{ data: unknown; dataUpdatedAt: number; isFetching: boolean; isError: boolean }> = {}) => ({
  data: {},
  dataUpdatedAt: NOW - 60_000,
  isFetching: false,
  isError: false,
  ...extra,
});

test("shownFreshness says nothing about fresh numbers, or about a screen with nothing to show", () => {
  assert.equal(shownFreshness([shown()], NOW), null);
  assert.equal(shownFreshness([shown({ data: undefined, isError: true })], NOW), null);
});

test("shownFreshness flags old numbers while they are being refreshed, not the refresh after a save", () => {
  const old = NOW - FRESH_FOR - 1;
  assert.deepEqual(shownFreshness([shown({ dataUpdatedAt: old, isFetching: true })], NOW), { state: "updating", updatedAt: old });
  assert.equal(shownFreshness([shown({ dataUpdatedAt: NOW - 30_000, isFetching: true })], NOW), null);
  assert.equal(shownFreshness([shown({ dataUpdatedAt: old })], NOW), null); // old but not being refreshed: no claim
});

test("shownFreshness reports a failed refresh first, with the oldest failed numbers' time", () => {
  const older = NOW - 3 * 60 * 60_000;
  const result = shownFreshness(
    [shown({ dataUpdatedAt: NOW - FRESH_FOR - 1, isFetching: true }), shown({ dataUpdatedAt: older, isError: true }), shown({ isError: true })],
    NOW,
  );
  assert.deepEqual(result, { state: "failed", updatedAt: older });
});
