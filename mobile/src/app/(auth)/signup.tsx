import { router } from "expo-router";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";

import { useAuth } from "@/providers/AuthProvider";
import { Banner, Button, EmptyState, Input, Screen, Stack, Text } from "@/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Set when Supabase wants the email confirmed before it issues a session (A5).
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const submit = async () => {
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);

    const result = await signUp(address, password);
    if (result.error) setError(result.error);
    else if (result.needsConfirmation) setConfirmationSentTo(address);
    // Otherwise a session exists and the route guard moves to the app.
  };

  if (confirmationSentTo) {
    return (
      <Screen>
        <EmptyState
          icon="mail-outline"
          title="Check your email"
          message={`We sent a confirmation link to ${confirmationSentTo}. Confirm it, then log in.`}
          actionLabel="Back to log in"
          onAction={() => router.replace("/login")}
        />
      </Screen>
    );
  }

  return (
    <Screen keyboard back>
      <Stack gap="xs">
        <Text variant="title">Create an account</Text>
        <Text tone="muted">Start your smart finance journey with BuyWise</Text>
      </Stack>

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
          autoComplete="new-password"
          placeholder="At least 6 characters"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <Input
          ref={confirmRef}
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </Stack>

      <Button title="Create account" onPress={submit} requiresNetwork />
    </Screen>
  );
}
