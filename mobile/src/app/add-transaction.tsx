import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";

import { userMessage } from "@/lib/api";
import { todayLocal } from "@/lib/dates";
import { formatMinor } from "@/lib/format";
import { wholeIfRound } from "@/lib/home";
import { useCreateTransaction } from "@/lib/mutations";
import { profileQuery, recentTransactionsQuery } from "@/lib/queries";
import {
  afterSaveAndAddAnother,
  defaultMethod,
  emptyDraft,
  isDirty,
  toCreatePayload,
  validateDraft,
  type TransactionDraft,
} from "@/lib/transactionForm";
import { hapticSuccess, showToast, TransactionEditor, useDiscardGuard } from "@/ui";

// Quick add (design/screens/04-quick-add-sheet.png, values from design/reference-html/QuickAdd.html),
// opened by holding the centre tab. The sheet itself is `TransactionEditor`, which Edit renders too.

export default function AddTransactionModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const amountRef = useRef<TextInput>(null);
  // Starts on the newest transaction's method (read from the cache Home filled; UPI with none).
  const [baseline, setBaseline] = useState<TransactionDraft>(() =>
    emptyDraft(todayLocal(), defaultMethod(queryClient.getQueryData(recentTransactionsQuery.queryKey)?.transactions[0])),
  );
  const [draft, setDraft] = useState<TransactionDraft>(baseline);
  const [attempted, setAttempted] = useState(false);

  const profile = useQuery(profileQuery);
  const create = useCreateTransaction();
  const { allowLeave } = useDiscardGuard(isDirty(draft, baseline));

  const currency = profile.data?.currency ?? "INR";
  const { amount, errors } = validateDraft(draft);

  const save = async (another: boolean) => {
    setAttempted(true);
    if (amount === null || errors.category) return;
    try {
      await create.mutateAsync(toCreatePayload(draft, amount, profile.data?.currency));
    } catch {
      return; // the failure is shown by the error banner
    }
    hapticSuccess();
    const amountText = formatMinor(amount, currency);
    const categoryName = draft.category?.name ?? "";
    showToast(draft.type === "income" ? `${amountText} income added to ${categoryName}` : `${amountText} added to ${categoryName}`);
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
      draft={draft}
      onChange={setDraft}
      currency={currency}
      amountRef={amountRef}
      errors={attempted ? errors : {}}
      formError={create.isError ? userMessage(create.error, "save this transaction") : null}
      primary={{ label: amount !== null ? `Save ${wholeIfRound(formatMinor(amount, currency))}` : "Save", onPress: () => save(false), disabled: create.isPending }}
      secondary={{ label: "Save & add another", onPress: () => save(true), disabled: create.isPending }}
    />
  );
}
