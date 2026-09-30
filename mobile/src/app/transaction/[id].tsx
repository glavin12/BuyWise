import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Pencil } from "lucide-react-native";
import { useState, type ReactNode } from "react";

import { isNotFound, userMessage } from "@/lib/api";
import { loggedTime } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/format";
import { splitFraction } from "@/lib/home";
import { isUuid } from "@/lib/ids";
import { METHOD_LABEL, TYPE_LABEL } from "@/lib/labels";
import { useDeleteTransaction } from "@/lib/mutations";
import { profileQuery, useTransactionDetail } from "@/lib/queries";
import {
  Banner,
  CategoryTile,
  CircleButton,
  confirm,
  DetailList,
  ErrorState,
  goBack,
  hapticSuccess,
  HeroAmount,
  NotFoundScreen,
  Panel,
  PrimaryButton,
  Row,
  Screen,
  SecondaryButton,
  showToast,
  Skeleton,
  Stack,
  Title,
} from "@/ui";

// Transaction detail, in Activity's design language (design/screens/03-activity.png) on a charcoal stack
// screen with a back button: the category tile, the payee, the signed amount (income in mint), then the
// row's fields. Edit opens the Quick Add sheet filled with this row; Delete asks first.

function DetailScreen({ title, onRefresh, refreshing, children }: { title: string; onRefresh?: () => void; refreshing?: boolean; children: ReactNode }) {
  return (
    <Screen surface="screen" onRefresh={onRefresh} refreshing={refreshing}>
      <Row>
        <CircleButton icon={ArrowLeft} label="Go back" onPress={goBack} />
        <Stack grow>
          <Title>{title}</Title>
        </Stack>
      </Row>
      {children}
    </Screen>
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
      <DetailScreen title="Transaction">
        {detail.isError ? (
          <ErrorState message={userMessage(detail.error, "load this transaction")} onRetry={() => detail.refetch()} />
        ) : (
          <>
            <Skeleton tone="dark" height={150} round="card" />
            <Skeleton tone="dark" height={230} round="card" />
          </>
        )}
      </DetailScreen>
    );
  }

  const currency = tx.currency || profile.data?.currency || "INR";
  const startingBalance = tx.transaction_type === "starting_balance";
  const income = tx.transaction_type === "income";
  const sign = tx.transaction_type === "expense" ? "−" : income ? "+" : "";
  const money = formatCurrency(tx.display_amount, currency);
  const [whole, fraction] = splitFraction(money);
  const who = tx.payee || tx.category || TYPE_LABEL[tx.transaction_type];
  const spoken = tx.transaction_type === "expense" ? "Spent" : income ? "Received" : "Starting balance";

  const date = { label: "Date", value: formatDate(tx.transaction_date, "long") };
  const logged = { label: "Logged", value: loggedTime(tx.created_at, tx.transaction_date) };
  const details = { label: "Details", value: tx.notes };
  const rows = startingBalance
    ? [date, logged, details]
    : [
        { label: "Category", value: tx.category },
        { label: "Method", value: tx.payment_method && METHOD_LABEL[tx.payment_method] },
        date,
        logged,
        { label: "Note", value: tx.description },
        details,
      ];

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
    const what = `${money} ${TYPE_LABEL[tx.transaction_type].toLowerCase()}`;
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
    <DetailScreen title={TYPE_LABEL[tx.transaction_type]} onRefresh={refresh} refreshing={refreshing}>
      {detail.isError ? <Banner tone="warning" message="Couldn't refresh. Showing the last details we have." /> : null}
      {deleteError ? <Banner tone="error" message={deleteError} /> : null}

      <Panel>
        <Stack gap="lg">
          <Row gap="md">
            <CategoryTile name={tx.category} icon={tx.category_icon} size={58} />
            <Stack grow>
              <Title size="panelTitle">{who}</Title>
            </Stack>
          </Row>
          <Stack accessible accessibilityLabel={`${spoken} ${money}`}>
            <HeroAmount whole={sign + whole} fraction={fraction} tone={income ? "mint" : "text"} />
          </Stack>
        </Stack>
      </Panel>

      <DetailList rows={rows} />

      <PrimaryButton label="Edit" icon={Pencil} onPress={() => router.push(`/transaction/${id}/edit`)} />
      <SecondaryButton label="Delete" surface="dark" danger requiresNetwork onPress={onDelete} />
    </DetailScreen>
  );
}
