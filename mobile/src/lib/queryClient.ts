import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";

import { ApiError } from "./api";

// App foreground/background drives refetch-on-focus (L3, R5): stale queries
// refetch when the app returns to the foreground, fresh ones are left alone.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
  return () => sub.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
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
