import { EmptyState, Screen } from "@/ui";

export default function BudgetTab() {
  return (
    <Screen insetBottom={false}>
      <EmptyState icon="wallet-outline" title="Budget & goals" message="Coming in Phase 3." />
    </Screen>
  );
}
