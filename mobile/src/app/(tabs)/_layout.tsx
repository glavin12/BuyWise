import { Tabs, useRouter } from "expo-router";

import { AddTabButton, tabIcon, tabScreenOptions } from "@/ui";

export default function TabsLayout() {
  const router = useRouter();

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: tabIcon("home-outline") }} />
      <Tabs.Screen
        name="transactions"
        options={{ title: "Transactions", tabBarIcon: tabIcon("swap-horizontal-outline") }}
      />
      {/* Centre button: opens the quick-add modal instead of showing a tab screen. */}
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarButton: () => <AddTabButton onPress={() => router.push("/add-transaction")} />,
        }}
      />
      <Tabs.Screen name="budget" options={{ title: "Budget", tabBarIcon: tabIcon("wallet-outline") }} />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: tabIcon("chatbubbles-outline") }} />
    </Tabs>
  );
}
