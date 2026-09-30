import { router } from "expo-router";
import { Lock, Mail } from "lucide-react-native";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";

import { useAuth } from "@/providers/AuthProvider";
import { AuthField, AuthLayout, Banner, PrimaryButton } from "@/ui";

// Log in (design/screens/01-login.png): the shared signed-out frame, two fields and the button.
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
    <AuthLayout
      title={"Money that\ntalks back."}
      intro="Log a spend in {dark:3 taps}, or just ask where it all went."
      action={<PrimaryButton label="Log in" onPress={submit} requiresNetwork />}
      footer={{ prompt: "New here?", link: "Create an account", onPress: () => router.push("/signup") }}
    >
      {notice ? <Banner tone="info" message={notice} /> : null}
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
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
    </AuthLayout>
  );
}
