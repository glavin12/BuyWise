import { EmptyState, Screen } from "@/ui";

// Placeholder modal. Phase 2 replaces it with the quick-add bottom sheet.
export default function AddTransactionModal() {
  return (
    <Screen title="Add transaction" back>
      <EmptyState icon="add-circle-outline" title="Quick add" message="Coming in Phase 2." />
    </Screen>
  );
}
