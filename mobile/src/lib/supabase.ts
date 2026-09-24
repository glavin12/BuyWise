import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill it in."
  );
}

// SecureStore can refuse values over ~2 KB and a Supabase session (tokens plus
// user object) can exceed that, so each value is split into chunks:
// `<key>.n` holds the chunk count, `<key>.0 .. <key>.n-1` hold the pieces.
// Key names may only use alphanumerics, ".", "-" and "_".
// The `u` flag keeps a surrogate pair (emoji in a user's name) inside one chunk.
const CHUNK_PATTERN = /[\s\S]{1,1000}/gu;

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = Number(await SecureStore.getItemAsync(`${key}.n`));
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`))
    );
    // A missing piece means a torn write: treat as signed out rather than parse garbage.
    return parts.every((p) => p !== null) ? parts.join("") : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    await secureStorage.removeItem(key);
    const parts = value.match(CHUNK_PATTERN) ?? [""];
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${key}.${i}`, p)));
    // Count is written last so a reader never sees a count without its pieces.
    await SecureStore.setItemAsync(`${key}.n`, String(parts.length));
  },

  async removeItem(key: string): Promise<void> {
    const count = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
    await Promise.all([
      SecureStore.deleteItemAsync(`${key}.n`),
      ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
    ]);
  },
};

export const supabase = createClient(url, anonKey, {
  auth: {
    // SecureStore does not exist on web; supabase-js then falls back to localStorage.
    storage: Platform.OS === "web" ? undefined : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase's React Native pattern (edge case L3): only refresh tokens while the
// app is in the foreground; on return, refresh immediately if the token expired.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
