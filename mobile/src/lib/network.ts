import NetInfo from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";

import { queryClient } from "./queryClient";

// One shared NetInfo subscription; every screen and button reads the same value.
// "Offline" means no connection at all (airplane mode). NetInfo's
// isInternetReachable probe is ignored on purpose: it can read false on a
// LAN-only Wi-Fi or in a browser and would wrongly lock the app. Real outages
// show up as request errors instead (C7, C8).
let online = true;
let started = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  if (!started) {
    started = true; // app-lifetime subscription, intentionally never removed
    NetInfo.addEventListener((state) => {
      const next = state.isConnected !== false;
      if (next === online) return;
      online = next;
      // C2: back online marks cached data stale without refetching everything;
      // the next pull-to-refresh, focus or tab switch fetches fresh data.
      if (next) queryClient.invalidateQueries({ refetchType: "none" });
      listeners.forEach((l) => l());
    });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => online, () => true);
}
