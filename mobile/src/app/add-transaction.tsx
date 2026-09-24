import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";

import { userMessage } from "@/lib/api";
import { todayLocal } from "@/lib/dates";
import { useCreateCategory, useCreateTransaction } from "@/lib/mutations";
import { categoriesQuery, payeesQuery, profileQuery, useSuggestCategory } from "@/lib/queries";
import {
  afterSaveAndAddAnother,
  emptyDraft,
  isDirty,
  toCreatePayload,
  validateDraft,
  type PickedCategory,
  type PickedPayee,
  type TransactionDraft,
} from "@/lib/transactionForm";
import { hapticSuccess, showToast, TransactionEditor, useDiscardGuard } from "@/ui";

// Quick add. Opens as a modal from the centre tab button and the empty states.
export default function AddTransactionModal() {
  const router = useRouter();
  const amountRef = useRef<TextInput>(null);
  const [baseline, setBaseline] = useState<TransactionDraft>(() => emptyDraft(todayLocal()));
  const [draft, setDraft] = useState<TransactionDraft>(baseline);
  const [attempted, setAttempted] = useState(false);

  const kind = draft.type === "income" ? "income" : "expense";
  const profile = useQuery(profileQuery);
  const categories = useQuery(categoriesQuery(kind));
  const payees = useQuery(payeesQuery(kind));
  const create = useCreateTransaction();
  const createCategory = useCreateCategory();
  const suggestCategory = useSuggestCategory();
  const { allowLeave } = useDiscardGuard(isDirty(draft, baseline));

  const { amount, errors } = validateDraft(draft);

  // The payee's usual category is offered, but never over one the user chose.
  const pickPayee = (payee: PickedPayee) => {
    const typeAtPick = draft.type;
    setDraft((d) => ({ ...d, payee }));
    if (!payee.id || draft.category) return;
    void suggestCategory(payee.id, categories.data?.categories ?? [], typeAtPick).then((category) => {
      if (category) setDraft((d) => (d.category || d.type !== typeAtPick ? d : { ...d, category }));
    });
  };

  const save = async (another: boolean) => {
    setAttempted(true);
    if (amount === null || errors.category) return;
    try {
      await create.mutateAsync(toCreatePayload(draft, amount, profile.data?.currency));
    } catch {
      return; // the failure is shown by the error banner
    }
    hapticSuccess();
    showToast(`${draft.type === "income" ? "Income" : "Expense"} added`);
    if (another) {
      const next = afterSaveAndAddAnother(draft);
      setDraft(next);
      setBaseline(next); // what is left (type, category, method, date) is not "unsaved work"
      setAttempted(false);
      amountRef.current?.focus();
    } else {
      allowLeave();
      router.back();
    }
  };

  return (
    <TransactionEditor
      title="Add transaction"
      draft={draft}
      onChange={setDraft}
      currency={profile.data?.currency ?? "INR"}
      autoFocusAmount
      amountRef={amountRef}
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
      // A new payee is created by name when the transaction saves, so backing out leaves no orphan.
      onCreatePayee={(name) => Promise.resolve({ name })}
      errors={attempted ? errors : {}}
      formError={create.isError ? userMessage(create.error, "save this transaction") : null}
      primary={{ label: "Save", onPress: () => save(false), disabled: create.isPending }}
      secondary={{ label: "Save & add another", onPress: () => save(true), disabled: create.isPending }}
    />
  );
}
