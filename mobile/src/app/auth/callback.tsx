import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { completeGoogleSignIn } from "@/lib/googleAuth";
import { AuthLayout, Banner, PrimaryButton } from "@/ui";

export default function GoogleCallback() {
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const callback = Platform.OS === "web" ? window.location.href : url;
    if (!callback) return;
    let active = true;
    // Defer so a synchronous validation failure follows the same error path.
    void Promise.resolve().then(() => completeGoogleSignIn(callback)).then(() => {
      if (active) router.replace("/");
    }).catch(() => {
      if (active) setError("Google sign-in was not completed. Please try again.");
    });
    return () => { active = false; };
  }, [url]);

  return (
    <AuthLayout
      title={error ? "Let's try\nagain." : "Signing\nyou in."}
      intro={error ? "Return to log in and try Google again, or use your email." : "Finishing your secure Google sign-in."}
      action={<PrimaryButton label="Back to log in" disabled={!error} onPress={() => router.replace("/login")} />}
    >
      {error ? <Banner tone="error" message={error} /> : null}
    </AuthLayout>
  );
}
