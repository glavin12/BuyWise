import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { MSG } from "@/lib/errors";
import { wipeStaleSessionOnFreshInstall } from "@/lib/freshInstall";
import { profileQuery } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { TIMED_OUT, withTimeout } from "@/lib/timeout";

const SESSION_EXPIRED = "Your session has expired. Please log in again.";
const STARTUP_MS = 8_000; // longer than a normal refresh, shorter than "the app looks frozen"

type AuthContextValue = {
  session: Session | null;
  /** True until the stored session has been read; the splash screen stays up meanwhile. */
  loading: boolean;
  /** Set when the user was signed out involuntarily (L4, A3); shown on the login screen. */
  notice: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** `needsConfirmation` is true when Supabase wants the email confirmed first (A5). */
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  // Tells a sign-out the user asked for apart from one Supabase forced on us.
  const userInitiatedSignOut = useRef(false);

  useEffect(() => {
    let active = true;

    // F8: the first launch of a fresh install drops the session iOS's Keychain kept from before. That local
    // sign-out is the app's own doing, so it must not show "session expired".
    userInitiatedSignOut.current = true;
    const read = wipeStaleSessionOnFreshInstall()
      .finally(() => {
        userInitiatedSignOut.current = false;
      })
      .then(() => supabase.auth.getSession());

    // F1: a stalled refresh must not keep the splash up for ever. After STARTUP_MS the login screen shows with
    // "can't reach BuyWise". The stored session is untouched, so the read below (or the listener, once the
    // background refresh works) signs in by itself.
    void withTimeout(read, STARTUP_MS)
      .then((first) => {
        if (active && first === TIMED_OUT) {
          setNotice(MSG.network);
          setLoading(false);
        }
      })
      .catch(() => {});
    read
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        if (data.session) setNotice(null);
      })
      .catch(() => {}) // unreadable storage behaves like "not signed in"
      .finally(() => {
        if (active) setLoading(false);
      });

    // Only synchronous work in here: awaiting other Supabase calls inside this
    // callback can deadlock supabase-js.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (next) setNotice(null); // a late sign-in clears "can't reach BuyWise"
      if (event === "SIGNED_OUT") {
        // D12: two people sharing a phone must never see each other's cached data.
        queryClient.clear();
        setNotice(userInitiatedSignOut.current ? null : SESSION_EXPIRED);
        userInitiatedSignOut.current = false;
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const signIn = useCallback<AuthContextValue["signIn"]>(async (email, password) => {
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback<AuthContextValue["signUp"]>(
    async (email, password) => {
      setNotice(null);
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message, needsConfirmation: false };

      if (!data.session) return { error: null, needsConfirmation: true };

      // GET /profile creates the profile and seeds default categories and payees.
      // Prefetching through the shared query key means the Dashboard, which is
      // about to mount and ask for the same profile, joins this request instead
      // of racing it. A failure here is fine: the Dashboard's own query retries.
      void queryClient.prefetchQuery(profileQuery);
      return { error: null, needsConfirmation: false };
    },
    [queryClient]
  );

  const signOut = useCallback(async () => {
    userInitiatedSignOut.current = true;
    try {
      const { error } = await supabase.auth.signOut();
      // If the server call failed (e.g. offline) still clear this device. The first SIGNED_OUT reset the flag, and
      // this one must not read as "session expired" either.
      if (error) {
        userInitiatedSignOut.current = true;
        await supabase.auth.signOut({ scope: "local" });
      }
    } finally {
      // SIGNED_OUT has fired by now; make sure a no-op sign-out cannot leave the flag set.
      userInitiatedSignOut.current = false;
    }
  }, []);

  const value = useMemo(
    () => ({ session, loading, notice, signIn, signUp, signOut }),
    [session, loading, notice, signIn, signUp, signOut]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
