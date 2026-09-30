import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { isNotFound, userMessage } from "@/lib/api";
import { isUuid } from "@/lib/ids";
import { useUpdateTransaction } from "@/lib/mutations";
import { profileQuery, useTransactionDetail } from "@/lib/queries";
import { draftFromTransaction, editPatch, isDirty, validateDraft, type TransactionDraft } from "@/lib/transactionForm";
import type { Transaction } from "@/lib/types";
import { hapticSuccess, SheetLoading, SheetNotFound, showToast, TransactionEditor, useDiscardGuard } from "@/ui";

// Edit is the Quick Add sheet (`TransactionEditor`) filled with the row's own values.

export default function EditTransactionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!isUuid(id)) return <SheetNotFound title="Edit transaction" what="Transaction" />;
  return <EditLoader id={id} />;
}

// Loads the row (instantly from a cached list when there is one). The form is
// built once from what was loaded, so a background refetch never wipes an edit.
function EditLoader({ id }: { id: string }) {
  const detail = useTransactionDetail(id);
  if (detail.data) return <EditForm key={detail.data.id} tx={detail.data} />;
  if (isNotFound(detail.error)) return <SheetNotFound title="Edit transaction" what="Transaction" />;
  return (
    <SheetLoading
      title="Edit transaction"
      error={detail.isError ? userMessage(detail.error, "load this transaction") : null}
      onRetry={() => detail.refetch()}
    />
  );
}

function EditForm({ tx }: { tx: Transaction }) {
  const router = useRouter();
  const [original] = useState(tx); // the row as opened: the patch is the difference from this
  const [baseline] = useState<TransactionDraft>(() => draftFromTransaction(tx));
  const [draft, setDraft] = useState<TransactionDraft>(baseline);

  const profile = useQuery(profileQuery);
  const update = useUpdateTransaction(original.id);
  const { allowLeave } = useDiscardGuard(isDirty(draft, baseline));

  const { amount, errors } = validateDraft(draft);
  const patch = amount === null ? {} : editPatch(original, draft, amount);
  const changed = Object.keys(patch).length > 0;

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
      editing
      draft={draft}
      onChange={setDraft}
      currency={original.currency || profile.data?.currency || "INR"}
      // The form starts valid, so any error shown here comes from something the user just changed.
      errors={errors}
      formError={update.isError && !isNotFound(update.error) ? userMessage(update.error, "save your changes") : null}
      primary={{ label: "Save changes", onPress: save, disabled: !changed || update.isPending }}
    />
  );
}
