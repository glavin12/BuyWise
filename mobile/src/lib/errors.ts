// How a failed request becomes text for the user. Import-free so `npm test` can
// run it; api.ts re-exports ApiError and userMessage for the rest of the app.

// User-facing wording for failures (C5-C9). Raw server bodies are never shown for 5xx.
export const MSG = {
  network: "Can't reach BuyWise right now. Check your connection and try again.",
  timeout: "The request took too long. Please try again.",
  expired: "Your session has expired. Please log in again.",
  rateLimited: "Too many requests. Please wait a moment.",
  server: "Something went wrong on our end. Please try again.",
  malformed: "Unexpected response from the server. Please try again.",
  invalid: "Some details look invalid. Please check them and try again.",
  notFound: "This no longer exists. It may have been deleted.",
  duplicate: "That already exists, so pick it from the list instead.",
  busy: "Still working on your last message. Please wait a moment.",
};

/** `status` is 0 when no HTTP response was received (offline, DNS, timeout). */
export class ApiError extends Error {
  status: number;
  /** Seconds the server asked us to wait (429 only). */
  retryAfter?: number;

  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype); // keeps `instanceof` working when Error is transpiled
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/**
 * The one place a failure becomes text for the user (guide: never show raw
 * technical errors). `action` completes "We couldn't ..." for the operation that
 * failed, e.g. "save this expense". Screens must not render `err.message` themselves.
 */
export function userMessage(err: unknown, action: string): string {
  if (!(err instanceof ApiError)) return MSG.server;
  const { status, message } = err;
  if (status === 0 || status === 401 || status >= 500) return message; // network, timeout, expired, server: already user-facing
  if (status === 429) {
    return err.retryAfter ? `Too many requests. Please wait ${err.retryAfter} seconds and try again.` : MSG.rateLimited;
  }
  if (status === 404) return MSG.notFound;
  if (status === 409) return /still processing/i.test(message) ? MSG.busy : `We couldn't ${action}. ${MSG.duplicate}`;
  return `We couldn't ${action}. ${message}`; // 400/422: the backend's own explanation
}

/** The server says the thing is gone (deleted elsewhere, or a stale link). */
export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/**
 * A failure every remaining item of a batch would hit too (offline or timed out,
 * signed out, rate limited): stop the batch instead of failing the rest one by one.
 */
export function stopsBatch(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status === 401 || err.status === 429);
}
