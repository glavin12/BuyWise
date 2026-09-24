import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { profileQuery } from "@/lib/queries";
import { supabase } from "@/lib/supabase";

const SESSION_EXPIRED = "Your session has expired. Please log in again.";

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

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {}) // unreadable storage behaves like "not signed in"
      .finally(() => {
        if (active) setLoading(false);
      });

    // Only synchronous work in here: awaiting other Supabase calls inside this
    // callback can deadlock supabase-js.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
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
      // If the server call failed (e.g. offline) still clear this device.
      if (error) await supabase.auth.signOut({ scope: "local" });
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
