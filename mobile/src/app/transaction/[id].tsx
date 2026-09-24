import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { isNotFound, userMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { METHOD_LABEL, TYPE_LABEL } from "@/lib/labels";
import { useDeleteTransaction } from "@/lib/mutations";
import { profileQuery, useTransactionDetail } from "@/lib/queries";
import {
  Amount,
  Banner,
  Button,
  Card,
  confirm,
  ErrorState,
  goBack,
  hapticSuccess,
  NotFoundScreen,
  Screen,
  showToast,
  Skeleton,
  Stack,
  Text,
} from "@/ui";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Stack gap="xs">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text>{value}</Text>
    </Stack>
  );
}

export default function TransactionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // The id comes from a URL: anything that is not a UUID is not found.
  if (!isUuid(id)) return <NotFoundScreen title="Transaction" what="Transaction" />;
  return <TransactionDetail id={id} />;
}

function TransactionDetail({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false); // stops a refetch of the row we just deleted
  const [refreshing, setRefreshing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const detail = useTransactionDetail(id, !deleting);
  const profile = useQuery(profileQuery);
  const remove = useDeleteTransaction();

  const tx = detail.data;

  if (isNotFound(detail.error)) return <NotFoundScreen title="Transaction" what="Transaction" />;

  if (!tx) {
    return (
      <Screen title="Transaction" back>
        {detail.isError ? (
          <ErrorState
            message={userMessage(detail.error, "load this transaction")}
            onRetry={() => detail.refetch()}
          />
        ) : (
          <>
            <Skeleton height={96} />
            <Skeleton height={180} />
          </>
        )}
      </Screen>
    );
  }

  const currency = tx.currency || profile.data?.currency || "INR";
  const startingBalance = tx.transaction_type === "starting_balance";
  const value = tx.transaction_type === "expense" ? -tx.display_amount : tx.display_amount;

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await detail.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const onDelete = async () => {
    const what = `${formatCurrency(tx.display_amount, currency)} ${TYPE_LABEL[tx.transaction_type].toLowerCase()}`;
    const yes = await confirm(`Delete this ${what}?`, "This can't be undone.", "Delete", true);
    if (!yes) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      if (!isNotFound(err)) {
        setDeleting(false);
        setDeleteError(userMessage(err, "delete this transaction"));
        return;
      }
      // Already deleted elsewhere: the goal is met, so carry on as a success.
    }
    hapticSuccess();
    showToast("Transaction deleted");
    goBack();
  };

  return (
    <Screen title="Transaction" back onRefresh={refresh} refreshing={refreshing}>
      {detail.isError ? <Banner tone="warning" message="Couldn't refresh. Showing the last details we have." /> : null}
      {deleteError ? <Banner tone="error" message={deleteError} /> : null}

      <Card>
        <Text variant="caption" tone="muted">
          {TYPE_LABEL[tx.transaction_type]}
        </Text>
        <Amount variant="display" value={value} currency={currency} signed={!startingBalance} />
        <Text tone="muted">{formatDate(tx.transaction_date, "long")}</Text>
      </Card>

      <Card>
        {startingBalance ? null : (
          <>
            <Field label="Category" value={tx.category} />
            <Field label="Payee" value={tx.payee} />
            <Field label="Payment method" value={tx.payment_method ? METHOD_LABEL[tx.payment_method] : null} />
            <Field label="Description" value={tx.description} />
          </>
        )}
        <Field label="Notes" value={tx.notes} />
        <Field label="Status" value={tx.cleared_status === "cleared" ? "Cleared" : "Pending"} />
      </Card>

      <Button title="Edit" onPress={() => router.push(`/transaction/${id}/edit`)} />
      <Button title="Delete" variant="danger" requiresNetwork onPress={onDelete} />
    </Screen>
  );
}
