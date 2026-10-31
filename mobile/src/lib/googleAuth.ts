import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { oauthCode } from "./oauthCallback";
import { supabase } from "./supabase";

export function googleRedirectTo() {
  return Platform.OS === "web"
    ? new URL("/auth/callback", window.location.origin).href
    : Linking.createURL("auth/callback", { scheme: "buywise" });
}

// The browser result and the callback screen may receive the same single-use code.
let lastExchange: { code: string; promise: Promise<void> } | undefined;
export function completeGoogleSignIn(url: string): Promise<void> {
  const code = oauthCode(url, googleRedirectTo());
  if (lastExchange?.code === code) return lastExchange.promise;
  const promise = (async () => {
    const flowId = new URL(url).searchParams.get("sb_flow_id");
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) throw new Error("Couldn't finish Google sign-in. Please try again.");
  })();
  lastExchange = { code, promise };
  return promise;
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  try {
    if (Platform.OS !== "web" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      return { error: "Google sign-in needs a BuyWise development or installed build. In Expo Go, use email and password." };
    }
    const redirectTo = googleRedirectTo();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: Platform.OS !== "web" },
    });
    if (error) throw error;
    if (Platform.OS !== "web") {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "success") await completeGoogleSignIn(result.url);
      // Closing the browser returns to the form without an error.
    }
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't connect to Google. Please try again." };
  }
}
