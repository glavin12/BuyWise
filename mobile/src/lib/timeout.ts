// A wait that gives up. Import-free so `npm test` can run it.

export const TIMED_OUT = Symbol("timed-out");

/**
 * Resolves with `TIMED_OUT` instead of waiting forever on `promise`. The promise keeps running, and its late
 * result (or rejection) is dropped here: the caller decides whether to listen to it separately.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}
