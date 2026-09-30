import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { isNotFound, userMessage } from "@/lib/api";
import { isUuid } from "@/lib/ids";
import { useArchiveCategory, useUpdateCategory } from "@/lib/mutations";
import { useCategory } from "@/lib/queries";
import { categoryDraftFromCategory, categoryDraftKey, categoryEditPatch, validateCategoryDraft } from "@/lib/settings";
import type { Category } from "@/lib/types";
import { CategoryEditor, confirm, hapticSuccess, SheetLoading, SheetNotFound, showToast, useDiscardGuard } from "@/ui";

export default function EditCategoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!isUuid(id)) return <SheetNotFound title="Edit category" what="Category" />;
  return <EditLoader id={id} />;
}

function EditLoader({ id }: { id: string }) {
  const category = useCategory(id);
  if (category.data) return <EditForm category={category.data} />;
  if (isNotFound(category.error)) return <SheetNotFound title="Edit category" what="Category" />;
  return (
    <SheetLoading
      title="Edit category"
      error={category.isError ? userMessage(category.error, "load this category") : null}
      onRetry={() => category.refetch()}
    />
  );
}

function EditForm({ category }: { category: Category }) {
  const router = useRouter();
  const [original] = useState(category); // the row as opened: the patch is the difference from this
  const [baseline] = useState(() => categoryDraftFromCategory(category));
  const [draft, setDraft] = useState(baseline);
  const [failure, setFailure] = useState<string | null>(null);
  const update = useUpdateCategory();
  const archive = useArchiveCategory();
  const { allowLeave } = useDiscardGuard(categoryDraftKey(draft) !== categoryDraftKey(baseline));

  const { name, errors } = validateCategoryDraft(draft);
  const patch = errors.name ? {} : categoryEditPatch(original, draft, name);
  const changed = Object.keys(patch).length > 0;

  const save = async () => {
    if (errors.name || !changed) return;
    setFailure(null);
    try {
      await update.mutateAsync({ id: original.id, patch });
    } catch (err) {
      if (!isNotFound(err)) {
        setFailure(userMessage(err, "save your changes"));
        return;
      }
      showToast("This category no longer exists");
      allowLeave();
      router.back();
      return;
    }
    hapticSuccess();
    showToast("Changes saved");
    allowLeave();
    router.back();
  };

  const onArchive = async () => {
    const yes = await confirm(
      `Archive ${original.name}?`,
      "Old transactions and budgets keep the name, and it drops out of every list and picker. This can't be undone from the app.",
      "Archive",
      true
    );
    if (!yes) return;
    setFailure(null);
    try {
      await archive.mutateAsync(original.id);
    } catch (err) {
      if (!isNotFound(err)) {
        setFailure(userMessage(err, "archive this category"));
        return;
      }
      // Already gone (archived elsewhere): the goal is met.
    }
    hapticSuccess();
    allowLeave();
    showToast("Category archived");
    router.back();
  };

  return (
    <CategoryEditor
      title="Edit category"
      draft={draft}
      onChange={setDraft}
      editing
      // The form starts valid, so any error shown here comes from something the user just changed.
      errors={errors}
      formError={failure}
      primary={{ onPress: save, disabled: !changed || update.isPending }}
      danger={{ label: "Archive category", onPress: onArchive, disabled: archive.isPending }}
    />
  );
}
