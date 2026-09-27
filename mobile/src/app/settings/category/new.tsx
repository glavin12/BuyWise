import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { useCreateCategory } from "@/lib/mutations";
import { categoriesQuery } from "@/lib/queries";
import { categoryDraftKey, emptyCategoryDraft, findByName, toCategoryCreate, validateCategoryDraft } from "@/lib/settings";
import type { CategoryType } from "@/lib/types";
import { CategoryEditor, hapticSuccess, showToast, useDiscardGuard } from "@/ui";

const asType = (value: string | undefined): CategoryType => (value === "income" ? "income" : "expense");

export default function NewCategorySheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [baseline] = useState(() => emptyCategoryDraft(asType(params.type)));
  const [draft, setDraft] = useState(baseline);
  const [attempted, setAttempted] = useState(false);
  const create = useCreateCategory();
  // To tell "created" from "that name already existed" (POST is idempotent by name+type).
  const existing = useQuery(categoriesQuery(draft.type));
  const { allowLeave } = useDiscardGuard(categoryDraftKey(draft) !== categoryDraftKey(baseline));

  const { name, errors } = validateCategoryDraft(draft);

  const save = async () => {
    setAttempted(true);
    if (errors.name) return;
    const before = findByName(existing.data?.categories ?? [], name);
    let category;
    try {
      category = await create.mutateAsync(toCategoryCreate(draft, name));
    } catch {
      return; // shown by the error banner
    }
    hapticSuccess();
    allowLeave();
    showToast(before && before.id === category.id ? "That category already exists" : "Category created");
    router.back();
  };

  return (
    <CategoryEditor
      title="New category"
      draft={draft}
      onChange={setDraft}
      autoFocusName
      errors={attempted ? errors : {}}
      formError={create.isError ? userMessage(create.error, "create this category") : null}
      primary={{ label: "Create category", onPress: save, disabled: create.isPending }}
    />
  );
}
