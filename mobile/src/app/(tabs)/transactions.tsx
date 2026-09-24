import { EmptyState, Screen } from "@/ui";

export default function TransactionsTab() {
  return (
    <Screen insetBottom={false}>
      <EmptyState icon="swap-horizontal-outline" title="Transactions" message="Coming in Phase 2." />
    </Screen>
  );
}
