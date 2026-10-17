import { dehydrate, focusManager, hydrate, QueryClient, type DehydratedState } from "@tanstack/react-query";
import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import { AppState, Platform } from "react-native";

import { ApiError } from "./api";
import { FRESH_FOR, packSaved, SAVED_FOR, unpackSaved, type SavedOwner } from "./cachePolicy";

// App foreground/background drives refetch-on-focus (L3, R5): stale queries
// refetch when the app returns to the foreground, fresh ones are left alone.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
  return () => sub.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FRESH_FOR,
      // Retry a transient failure once, but never a definitive 4xx answer.
      retry: (failureCount, error) =>
        failureCount < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      // NetInfo can be wrong (e.g. LAN-only Wi-Fi). Never let it pause requests;
      // real failures surface as errors instead.
      networkMode: "always",
      // C2: reconnecting marks data stale (see lib/network.ts) but does not refetch everything.
      refetchOnReconnect: false,
    },
    mutations: { networkMode: "always" },
  },
});

// ── Kept on the phone ───────────────────────────────────────────
// The queries marked `meta.saved` (queries.ts) are written to one file, so after a restart, or offline, their last
// answers show at once while the API is asked again. The file is in the cache folder, which backups skip and the OS may
// empty. It holds API answers only: the session stays in SecureStore. Native only: the web build keeps memory alone.

const savedFile = () => new File(Paths.cache, "query-cache.json");
const owner = (userId: string): SavedOwner => ({ userId, app: Constants.expoConfig?.version ?? "" });
// Whose answers are being written. forgetSaved clears it, so a write still waiting when the user signs out is dropped.
let savingFor: string | undefined;

/** Puts back `userId`'s saved answers before any screen asks for them. Never throws: an unreadable file means none. */
export async function restoreSaved(userId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const file = savedFile();
    if (!file.exists) return;
    const queries = unpackSaved<DehydratedState["queries"][number]>(await file.text(), owner(userId), Date.now());
    // Kept in memory as long as on disk: an answer no screen has asked for yet would otherwise be dropped after the
    // default 5 minutes, and then from the next save.
    hydrate(queryClient, { mutations: [], queries }, { defaultOptions: { queries: { gcTime: SAVED_FOR } } });
  } catch {
    // Start without it: every screen loads from the API as it did before.
  }
}

/** While `userId` is signed in, writes the saved queries a second after one of them changes. Returns the stop function. */
export function keepSaved(userId: string): () => void {
  if (Platform.OS === "web") return () => {};
  savingFor = userId;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = queryClient.getQueryCache().subscribe(({ query }) => {
    if (query.meta?.saved !== true) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (savingFor !== userId) return; // signed out meanwhile
      try {
        const { queries } = dehydrate(queryClient, { shouldDehydrateQuery: (q) => q.meta?.saved === true && q.state.data !== undefined });
        const file = savedFile();
        if (!file.exists) file.create();
        file.write(packSaved(queries, owner(userId)));
      } catch {
        // Not written this time; the next change tries again.
      }
    }, 1_000);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}

/** On sign-out: nothing of the user's stays on the phone. */
export function forgetSaved() {
  if (Platform.OS === "web") return;
  savingFor = undefined;
  try {
    const file = savedFile();
    if (file.exists) file.delete();
  } catch {
    // Left behind: the next user's id will not match it, so it is never shown.
  }
}
