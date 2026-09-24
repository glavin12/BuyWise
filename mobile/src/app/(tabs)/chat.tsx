import { EmptyState, Screen } from "@/ui";

export default function ChatTab() {
  return (
    <Screen insetBottom={false}>
      <EmptyState icon="chatbubbles-outline" title="AI chat" message="Coming in Phase 4." />
    </Screen>
  );
}
