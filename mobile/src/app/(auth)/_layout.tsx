import { Stack } from "expo-router";

import { stackScreenOptions } from "@/ui";

export default function AuthLayout() {
  return <Stack screenOptions={stackScreenOptions} />;
}
