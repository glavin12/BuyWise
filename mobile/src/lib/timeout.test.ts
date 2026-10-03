import assert from "node:assert/strict";
import { test } from "node:test";

import { TIMED_OUT, withTimeout } from "./timeout.ts";

test("resolves with the value when the promise settles in time", async () => {
  assert.equal(await withTimeout(Promise.resolve(42), 1000), 42);
});

test("resolves TIMED_OUT for a promise that never settles", async () => {
  const started = Date.now();
  assert.equal(await withTimeout(new Promise(() => {}), 20), TIMED_OUT);
  assert.ok(Date.now() - started < 1000);
});

test("passes a rejection through", async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error("boom")), 1000), /boom/);
});

test("a result that arrives after the timeout is dropped without crashing", async () => {
  let rejectLate!: (error: Error) => void;
  const slow = new Promise<number>((_resolve, reject) => {
    rejectLate = reject;
  });
  assert.equal(await withTimeout(slow, 10), TIMED_OUT);
  rejectLate(new Error("late")); // already handled by the race: an unhandled rejection would fail this run
  await new Promise((resolve) => setTimeout(resolve, 20));
});

test("clears its timer once settled (a stray 1-minute timer would keep this run waiting)", async () => {
  assert.equal(await withTimeout(Promise.resolve("done"), 60_000), "done");
});
