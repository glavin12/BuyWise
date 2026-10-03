import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { clearAllFlags } from "./flags";
import { supabase } from "./supabase";

// iOS keeps Keychain items (where SecureStore puts the session) when the app is deleted, so a reinstall would
// still be signed in. App files are deleted with the app, so a marker file tells a fresh install from a launch.
const marker = () => new File(Paths.document, "install.marker");

/**
 * First launch of a fresh install: drops the session and flags the Keychain kept from before. Never throws and
 * never blocks startup for long: any failure just leaves things as they were. Native only.
 * ponytail: an app that updates from a version without the marker is also signed out once (and sees the coach mark again).
 */
export async function wipeStaleSessionOnFreshInstall(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    if (marker().exists) return;
    await supabase.auth.signOut({ scope: "local" });
    await clearAllFlags();
    marker().create();
  } catch {
    // Unreadable storage or file system: carry on to the normal session read.
  }
}
