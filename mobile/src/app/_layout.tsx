import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { AppShell, ErrorBoundary, sheetScreenOptions, stackScreenOptions } from "@/ui";

// Keep the native splash up until the stored session has been read.
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
        <Stack.Screen name="settings" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="add-transaction" options={sheetScreenOptions} />
        <Stack.Screen name="transaction/[id]" />
        <Stack.Screen name="transaction/[id]/edit" />
        <Stack.Screen name="budget/set" options={sheetScreenOptions} />
        <Stack.Screen name="goals/index" />
        <Stack.Screen name="goals/[id]" />
        <Stack.Screen name="goals/new" options={sheetScreenOptions} />
        <Stack.Screen name="goals/[id]/contribute" options={sheetScreenOptions} />
        <Stack.Screen name="goals/[id]/edit" options={sheetScreenOptions} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
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
