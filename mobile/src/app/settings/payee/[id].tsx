import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { isNotFound, userMessage } from "@/lib/api";
import { isUuid } from "@/lib/ids";
import { useDeletePayee, useUpdatePayee } from "@/lib/mutations";
import { usePayee } from "@/lib/queries";
import { payeeDraftFromPayee, payeeDraftKey, validatePayeeDraft } from "@/lib/settings";
import type { Payee } from "@/lib/types";
import { confirm, hapticSuccess, PayeeEditor, SheetLoading, SheetNotFound, showToast, useDiscardGuard } from "@/ui";

export default function EditPayeeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!isUuid(id)) return <SheetNotFound title="Edit payee" what="Payee" />;
  return <EditLoader id={id} />;
}

function EditLoader({ id }: { id: string }) {
  const payee = usePayee(id);
  if (payee.data) return <EditForm payee={payee.data} />;
  if (isNotFound(payee.error)) return <SheetNotFound title="Edit payee" what="Payee" />;
  return (
    <SheetLoading
      title="Edit payee"
      error={payee.isError ? userMessage(payee.error, "load this payee") : null}
      onRetry={() => payee.refetch()}
    />
  );
}

function EditForm({ payee }: { payee: Payee }) {
  const router = useRouter();
  const [original] = useState(payee); // the row as opened
  const [baseline] = useState(() => payeeDraftFromPayee(payee));
  const [draft, setDraft] = useState(baseline);
  const [failure, setFailure] = useState<string | null>(null);
  const update = useUpdatePayee();
  const remove = useDeletePayee();
  const { allowLeave } = useDiscardGuard(payeeDraftKey(draft) !== payeeDraftKey(baseline));

  const { name, errors } = validatePayeeDraft(draft);
  const changed = !errors.name && name !== original.name; // PayeeUpdate only takes a name

  const save = async () => {
    if (errors.name || !changed) return;
    setFailure(null);
    try {
      await update.mutateAsync({ id: original.id, name });
    } catch (err) {
      if (!isNotFound(err)) {
        setFailure(userMessage(err, "save your changes"));
        return;
      }
      showToast("This payee no longer exists");
      allowLeave();
      router.back();
      return;
    }
    hapticSuccess();
    showToast("Changes saved");
    allowLeave();
    router.back();
  };

  const onDelete = async () => {
    const yes = await confirm(
      `Delete ${original.name}?`,
      "Transactions keep their amounts but lose this payee. This can't be undone.",
      "Delete",
      true
    );
    if (!yes) return;
    setFailure(null);
    try {
      await remove.mutateAsync(original.id);
    } catch (err) {
      if (!isNotFound(err)) {
        setFailure(userMessage(err, "delete this payee"));
        return;
      }
      // Already gone: the goal is met.
    }
    hapticSuccess();
    allowLeave();
    showToast("Payee deleted");
    router.back();
  };

  return (
    <PayeeEditor
      title="Edit payee"
      draft={draft}
      onChange={setDraft}
      editing
      errors={errors}
      formError={failure}
      primary={{ onPress: save, disabled: !changed || update.isPending }}
      danger={{ label: "Delete payee", onPress: onDelete, disabled: remove.isPending }}
    />
  );
}
