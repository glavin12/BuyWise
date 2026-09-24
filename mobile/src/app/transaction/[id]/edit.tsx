import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { isNotFound, userMessage } from "@/lib/api";
import { isUuid } from "@/lib/ids";
import { useCreateCategory, useCreatePayee, useUpdateTransaction } from "@/lib/mutations";
import { categoriesQuery, payeesQuery, profileQuery, useSuggestCategory, useTransactionDetail } from "@/lib/queries";
import {
  draftFromTransaction,
  editPatch,
  isDirty,
  validateDraft,
  type PickedCategory,
  type PickedPayee,
  type TransactionDraft,
} from "@/lib/transactionForm";
import type { Transaction } from "@/lib/types";
import {
  ErrorState,
  hapticSuccess,
  NotFoundScreen,
  Screen,
  showToast,
  Skeleton,
  TransactionEditor,
  useDiscardGuard,
} from "@/ui";

export default function EditTransactionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!isUuid(id)) return <NotFoundScreen title="Edit transaction" what="Transaction" />;
  return <EditLoader id={id} />;
}

// Loads the row (instantly from a cached list when there is one). The form is
// built once from what was loaded, so a background refetch never wipes an edit.
function EditLoader({ id }: { id: string }) {
  const detail = useTransactionDetail(id);
  if (detail.data) return <EditForm key={detail.data.id} tx={detail.data} />;
  if (isNotFound(detail.error)) return <NotFoundScreen title="Edit transaction" what="Transaction" />;
  return (
    <Screen title="Edit transaction" back>
      {detail.isError ? (
        <ErrorState message={userMessage(detail.error, "load this transaction")} onRetry={() => detail.refetch()} />
      ) : (
        <Skeleton height={240} />
      )}
    </Screen>
  );
}

function EditForm({ tx }: { tx: Transaction }) {
  const router = useRouter();
  const [original] = useState(tx); // the row as opened: the patch is the difference from this
  const [baseline] = useState<TransactionDraft>(() => draftFromTransaction(tx));
  const [draft, setDraft] = useState<TransactionDraft>(baseline);

  const startingBalance = draft.type === "starting_balance";
  const kind = draft.type === "income" ? "income" : "expense";
  const profile = useQuery(profileQuery);
  const categories = useQuery({ ...categoriesQuery(kind), enabled: !startingBalance });
  const payees = useQuery({ ...payeesQuery(kind), enabled: !startingBalance });
  const update = useUpdateTransaction(original.id);
  const createCategory = useCreateCategory();
  const createPayee = useCreatePayee();
  const suggestCategory = useSuggestCategory();
  const { allowLeave } = useDiscardGuard(isDirty(draft, baseline));

  const { amount, errors } = validateDraft(draft);
  const patch = amount === null ? {} : editPatch(original, draft, amount);
  const changed = Object.keys(patch).length > 0;

  const pickPayee = (payee: PickedPayee) => {
    const typeAtPick = draft.type;
    setDraft((d) => ({ ...d, payee }));
    if (!payee.id || draft.category) return;
    void suggestCategory(payee.id, categories.data?.categories ?? [], typeAtPick).then((category) => {
      if (category) setDraft((d) => (d.category || d.type !== typeAtPick ? d : { ...d, category }));
    });
  };

  const save = async () => {
    if (amount === null || errors.category || !changed) return;
    try {
      await update.mutateAsync({
        patch,
        view: {
          category: draft.category?.name ?? null,
          category_icon: draft.category?.icon ?? null,
          payee: draft.payee?.name ?? null,
        },
      });
    } catch (err) {
      if (!isNotFound(err)) return; // shown by the error banner
      showToast("This transaction no longer exists");
      allowLeave();
      router.back();
      return;
    }
    hapticSuccess();
    showToast("Changes saved");
    allowLeave();
    router.back();
  };

  return (
    <TransactionEditor
      title="Edit transaction"
      editing
      draft={draft}
      onChange={setDraft}
      currency={original.currency || profile.data?.currency || "INR"}
      categories={{
        items: categories.data?.categories ?? [],
        loading: categories.isPending,
        error: categories.isError ? userMessage(categories.error, "load your categories") : null,
        onRetry: () => void categories.refetch(),
      }}
      payees={{
        items: payees.data?.payees ?? [],
        loading: payees.isPending,
        error: payees.isError ? userMessage(payees.error, "load your payees") : null,
        onRetry: () => void payees.refetch(),
      }}
      onPickPayee={pickPayee}
      onCreateCategory={async (name): Promise<PickedCategory> => {
        const category = await createCategory.mutateAsync({ name, type: kind });
        return { id: category.id, name: category.name, icon: category.icon };
      }}
      // A PATCH cannot create a payee by name, so here it is created (idempotently) first.
      onCreatePayee={async (name): Promise<PickedPayee> => {
        const payee = await createPayee.mutateAsync({ name, type: kind });
        return { id: payee.id, name: payee.name };
      }}
      // The form starts valid, so any error shown here comes from something the user just changed.
      errors={errors}
      formError={update.isError && !isNotFound(update.error) ? userMessage(update.error, "save your changes") : null}
      primary={{ label: "Save changes", onPress: save, disabled: !changed || update.isPending }}
    />
  );
}
