// How long the app trusts what it fetched, and what it keeps on the phone between launches (queryClient.ts applies
// both; queries.ts marks the saved queries). Import-free so `npm test` can run it.

/**
 * Fetched data counts as fresh for this long, so switching tabs or coming back to the app inside it makes no API call.
 * Every write in the app marks what it changed stale at once (`invalidateAfter`), so this only delays changes made
 * elsewhere (the web app, another phone); pull to refresh fetches them at once.
 */
export const FRESH_FOR = 5 * 60_000;

/** A copy kept on the phone is shown for at most this long after it was fetched, then dropped. */
export const SAVED_FOR = 7 * 24 * 60 * 60_000;

/** Bump when a saved query's response shape changes (types.ts), so an older copy is never read into the new shape. */
const SAVED_VERSION = 1;

/** Whose copy it is: another user's, or one written by another app version, is never restored. */
export type SavedOwner = { userId: string; app: string };

/** The parts of a dehydrated query this reads; the rest is passed through untouched. */
type SavedQuery = { meta?: Record<string, unknown>; state: { dataUpdatedAt: number } };

const isSaved = (query: SavedQuery) => query.meta?.saved === true;

/**
 * The file's text: the queries marked `meta.saved` (queries.ts), each stored as a success. A refresh that failed keeps
 * its last data, and that data must not come back as an error on the next launch.
 */
export function packSaved(queries: readonly SavedQuery[], owner: SavedOwner): string {
  return JSON.stringify({
    version: SAVED_VERSION,
    ...owner,
    queries: queries
      .filter(isSaved)
      .map((query) => ({ ...query, state: { ...query.state, status: "success", fetchStatus: "idle", error: null, fetchFailureCount: 0, fetchFailureReason: null } })),
  });
}

/**
 * What to restore: nothing unless the file is `owner`'s and this version's, and no copy older than SAVED_FOR. Each copy
 * comes back marked stale, so the first screen that shows it also asks the API: the database stays the truth, and a
 * change made on another device (or a save just before the app closed) shows up at launch.
 */
export function unpackSaved<Query extends SavedQuery>(text: string, owner: SavedOwner, now: number): Query[] {
  try {
    const saved = JSON.parse(text);
    if (saved?.version !== SAVED_VERSION || saved.userId !== owner.userId || saved.app !== owner.app || !Array.isArray(saved.queries)) return [];
    return saved.queries
      .filter((query: Query) => isSaved(query) && now - query.state.dataUpdatedAt < SAVED_FOR)
      .map((query: Query) => ({ ...query, state: { ...query.state, isInvalidated: true } }));
  } catch {
    return []; // a torn or foreign file: start without it
  }
}

/** One query a screen draws from, as `useQuery` reports it. */
type Shown = { data: unknown; dataUpdatedAt: number; isFetching: boolean; isError: boolean };

/**
 * How current the numbers drawn from `queries` are: "failed" when a refresh failed and older numbers are still shown,
 * "updating" while numbers older than FRESH_FOR are being refreshed (a copy saved on the phone at launch, or a return
 * after a while), else null. The refresh right after a save is not flagged: those numbers are minutes old.
 * `updatedAt` is when the oldest flagged numbers were fetched ("last updated 3h ago").
 */
export function shownFreshness(queries: readonly Shown[], now = Date.now()): { state: "failed" | "updating"; updatedAt: number } | null {
  const shown = queries.filter((query) => query.data !== undefined);
  const failed = shown.filter((query) => query.isError);
  const flagged = failed.length > 0 ? failed : shown.filter((query) => query.isFetching && now - query.dataUpdatedAt > FRESH_FOR);
  if (flagged.length === 0) return null;
  return { state: failed.length > 0 ? "failed" : "updating", updatedAt: Math.min(...flagged.map((query) => query.dataUpdatedAt)) };
}
