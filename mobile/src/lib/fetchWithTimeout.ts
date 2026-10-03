// `fetch` that aborts after a limit: React Native's Android HTTP client has no timeout of its own, so a stalled
// connection would otherwise never settle. Import-free so `npm test` can run it.

/**
 * Calls `fetchImpl`, aborting after `ms` and also when the caller's own `init.signal` aborts.
 * ponytail: the timer stops once the response headers arrive, so a body that stalls afterwards is not covered.
 * Fine for the small auth responses this is used for; `api.ts` `send()` reads its bodies under its own timer.
 */
export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const outer = init?.signal;
  if (outer?.aborted) abort();
  else outer?.addEventListener("abort", abort, { once: true });

  const timer = setTimeout(abort, ms);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", abort);
  }
}
