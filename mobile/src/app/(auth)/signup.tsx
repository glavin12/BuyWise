import { router } from "expo-router";
import { ArrowLeft, Lock, Mail } from "lucide-react-native";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";

import { escapeRich } from "@/lib/richText";
import { useAuth } from "@/providers/AuthProvider";
import { AuthField, AuthLayout, Banner, PrimaryButton } from "@/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sign up has no design of its own: the login frame and field style, with a headline in the same voice.
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
      <AuthLayout
        title={"Check your\nemail."}
        intro={`We sent a confirmation link to {dark:${escapeRich(confirmationSentTo)}}. Confirm it, then log in.`}
        action={<PrimaryButton label="Back to log in" icon={ArrowLeft} onPress={() => router.replace("/login")} />}
      />
    );
  }

  return (
    <AuthLayout
      title={"Let's get\ntalking."}
      intro="Start your smart finance journey with BuyWise."
      action={<PrimaryButton label="Create account" onPress={submit} requiresNetwork />}
      footer={{
        prompt: "Already have an account?",
        link: "Log in",
        // Sign-up is pushed over login, so back is login; a deep link straight here has nothing to go back to.
        onPress: () => (router.canGoBack() ? router.back() : router.replace("/login")),
      }}
    >
      {error ? <Banner tone="error" message={error} /> : null}
      <AuthField
        icon={Mail}
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
      <AuthField
        ref={passwordRef}
        icon={Lock}
        label="Password"
        secure
        placeholder="Password (6+ characters)"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <AuthField
        ref={confirmRef}
        icon={Lock}
        label="Confirm password"
        secure
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
    </AuthLayout>
  );
}
