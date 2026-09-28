import { Tabs } from "expo-router/js-tabs";

import { TabBar } from "@/ui";

// Design v3 (DESIGN.md §5): Home · Activity · [AI chat] · Budget · Profile, no labels. The
// centre opens Chat on tap and the QuickAdd sheet on a 350 ms hold (both in TabBar). Activity
// shows the first-run coach mark for it (design/screens/03-activity.png).
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} surfaces={{ budget: "marigold" }} coachOn="transactions" />}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="transactions" options={{ title: "Activity" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="budget" options={{ title: "Budget" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
