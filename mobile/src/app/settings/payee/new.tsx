import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { useCreatePayee } from "@/lib/mutations";
import { payeesQuery } from "@/lib/queries";
import { emptyPayeeDraft, findByName, payeeDraftKey, validatePayeeDraft } from "@/lib/settings";
import type { CategoryType } from "@/lib/types";
import { hapticSuccess, PayeeEditor, showToast, useDiscardGuard } from "@/ui";

const asType = (value: string | undefined): CategoryType => (value === "income" ? "income" : "expense");

export default function NewPayeeSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [baseline] = useState(() => emptyPayeeDraft(asType(params.type)));
  const [draft, setDraft] = useState(baseline);
  const [attempted, setAttempted] = useState(false);
  const create = useCreatePayee();
  // To tell "created" from "that name already existed" (POST is idempotent by name+type).
  const existing = useQuery(payeesQuery(draft.type));
  const { allowLeave } = useDiscardGuard(payeeDraftKey(draft) !== payeeDraftKey(baseline));

  const { name, errors } = validatePayeeDraft(draft);

  const save = async () => {
    setAttempted(true);
    if (errors.name) return;
    const before = findByName(existing.data?.payees ?? [], name);
    let payee;
    try {
      payee = await create.mutateAsync({ name, type: draft.type });
    } catch {
      return; // shown by the error banner
    }
    hapticSuccess();
    allowLeave();
    showToast(before && before.id === payee.id ? "That payee already exists" : "Payee created");
    router.back();
  };

  return (
    <PayeeEditor
      title="New payee"
      draft={draft}
      onChange={setDraft}
      autoFocusName
      errors={attempted ? errors : {}}
      formError={create.isError ? userMessage(create.error, "create this payee") : null}
      primary={{ label: "Create payee", onPress: save, disabled: create.isPending }}
    />
  );
}
