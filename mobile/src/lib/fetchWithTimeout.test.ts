import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchWithTimeout } from "./fetchWithTimeout.ts";

// A request that never answers and only ends when it is aborted (at once, like fetch, if it already is).
const hangingFetch = ((_input: unknown, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    if (init?.signal?.aborted) reject(new Error("aborted"));
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  })) as typeof fetch;

test("aborts a request that outlives the limit", async () => {
  await assert.rejects(fetchWithTimeout(hangingFetch, "https://example.test", undefined, 20), /aborted/);
});

test("returns the response and stops its timer (a stray 1-minute timer would keep this run waiting)", async () => {
  const answer = new Response("ok");
  const fast = (async () => answer) as unknown as typeof fetch;
  assert.equal(await fetchWithTimeout(fast, "https://example.test", undefined, 60_000), answer);
});

test("aborts when the caller's own signal aborts", async () => {
  const outer = new AbortController();
  const pending = fetchWithTimeout(hangingFetch, "https://example.test", { signal: outer.signal }, 60_000);
  outer.abort();
  await assert.rejects(pending, /aborted/);
});

test("a signal that is already aborted aborts at once", async () => {
  await assert.rejects(fetchWithTimeout(hangingFetch, "https://example.test", { signal: AbortSignal.abort() }, 60_000), /aborted/);
});

test("passes the request details through", async () => {
  let seen: RequestInit | undefined;
  const spy = (async (_input: unknown, init?: RequestInit) => {
    seen = init;
    return new Response("ok");
  }) as unknown as typeof fetch;
  await fetchWithTimeout(spy, "https://example.test", { method: "POST", body: "{}" }, 1000);
  assert.equal(seen?.method, "POST");
  assert.equal(seen?.body, "{}");
  assert.ok(seen?.signal instanceof AbortSignal);
});
