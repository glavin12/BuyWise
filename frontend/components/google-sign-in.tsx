"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignIn({ disabled = false }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    setLoading(true);
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch {
      setError("Couldn't connect to Google. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" className="w-full min-h-11" disabled={disabled} loading={loading} onClick={signIn}>
        Continue with Google
      </Button>
      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
      <p className="text-center text-sm text-secondary">or use your email</p>
    </div>
  );
}
