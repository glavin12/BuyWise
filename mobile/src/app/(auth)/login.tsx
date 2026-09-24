import { router } from "expo-router";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";

import { useAuth } from "@/providers/AuthProvider";
import { Banner, Button, Input, Screen, Stack, Text } from "@/ui";

export default function LoginScreen() {
  const { signIn, notice } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    // On success the route guard moves to the app, so there is nothing to do here.
    const result = await signIn(email.trim(), password);
    // A6: show Supabase's message as-is (e.g. "Invalid login credentials").
    if (result.error) setError(result.error);
  };

  return (
    <Screen keyboard>
      <Stack gap="xs">
        <Text variant="title">BuyWise</Text>
        <Text tone="muted">Log in to your account</Text>
      </Stack>

      {notice ? <Banner tone="info" message={notice} /> : null}
      {error ? <Banner tone="error" message={error} /> : null}

      <Stack>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <Input
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </Stack>

      <Button title="Log in" onPress={submit} requiresNetwork />
      <Button title="Create an account" variant="link" onPress={() => router.push("/signup")} />
    </Screen>
  );
}
