import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

type QueryPrefix = readonly unknown[];

/**
 * Tabs stay mounted, so switching back to one does not remount its queries.
 * On tab focus, refetch only what has gone stale (L3, X1, N8): rapid tab
 * switching never refetches fresh data. The first focus is skipped because the
 * queries just fetched on mount.
 */
export function useRefetchStaleOnFocus(queryPrefixes?: readonly QueryPrefix[]) {
  const queryClient = useQueryClient();
  const firstFocus = useRef(true);
  const prefixes = useRef(queryPrefixes);
  prefixes.current = queryPrefixes;

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      const currentPrefixes = prefixes.current;
      if (currentPrefixes) {
        void Promise.all(
          currentPrefixes.map((queryKey) => queryClient.refetchQueries({ queryKey, stale: true, type: "active" }))
        );
      } else {
        void queryClient.refetchQueries({ stale: true, type: "active" });
      }
    }, [queryClient])
  );
}
