import { BarlowSemiCondensed_600SemiBold } from "@expo-google-fonts/barlow-semi-condensed/600SemiBold";
import { BarlowSemiCondensed_700Bold } from "@expo-google-fonts/barlow-semi-condensed/700Bold";
import { InstrumentSans_400Regular } from "@expo-google-fonts/instrument-sans/400Regular";
import { InstrumentSans_500Medium } from "@expo-google-fonts/instrument-sans/500Medium";
import { InstrumentSans_600SemiBold } from "@expo-google-fonts/instrument-sans/600SemiBold";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif/400Regular";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono/400Regular";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono/700Bold";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { AppShell, ErrorBoundary, quickAddSheetOptions, sheetScreenOptions, stackScreenOptions } from "@/ui";

// Keep the native splash up until the fonts are loaded and the stored session has been read.
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  const signedIn = session !== null;

  // Route guard: signed-out users can only reach (auth), signed-in users only
  // the app. When the session changes, Expo Router moves to the allowed side.
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings/profile" />
        <Stack.Screen name="settings/categories" />
        <Stack.Screen name="settings/category/new" options={sheetScreenOptions} />
        <Stack.Screen name="settings/category/[id]" options={sheetScreenOptions} />
        <Stack.Screen name="settings/payees" />
        <Stack.Screen name="settings/payee/new" options={sheetScreenOptions} />
        <Stack.Screen name="settings/payee/[id]" options={sheetScreenOptions} />
        <Stack.Screen name="reports" />
        <Stack.Screen name="add-transaction" options={quickAddSheetOptions} />
        <Stack.Screen name="transaction/[id]" />
        <Stack.Screen name="transaction/[id]/edit" />
        <Stack.Screen name="budget/set" options={sheetScreenOptions} />
        <Stack.Screen name="goals/index" />
        <Stack.Screen name="goals/new" options={sheetScreenOptions} />
        <Stack.Screen name="goals/[id]/contribute" options={sheetScreenOptions} />
        <Stack.Screen name="goals/[id]/edit" options={sheetScreenOptions} />
        <Stack.Screen name="conversations/index" />
        <Stack.Screen name="conversations/[id]" />
        {/* Dev-only gallery of the design v3 kit (the screen redirects home in production). */}
        <Stack.Screen name="kit" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // The names are the families theme.ts and tokens.ts use. A font that fails to load falls back to the system font rather than a stuck splash.
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSerif_400Regular,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
    BarlowSemiCondensed_600SemiBold,
    BarlowSemiCondensed_700Bold,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* P7: light theme only for now */}
            <StatusBar style="dark" />
            <AppShell>
              <RootNavigator />
            </AppShell>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
