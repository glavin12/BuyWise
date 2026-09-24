import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { emptyGoalDraft, goalDraftKey, toGoalCreate, validateGoalDraft } from "@/lib/goals";
import { useCreateGoal } from "@/lib/mutations";
import { profileQuery } from "@/lib/queries";
import { GoalEditor, hapticSuccess, showToast, useDiscardGuard } from "@/ui";

export default function NewGoalSheet() {
  const router = useRouter();
  const [baseline] = useState(emptyGoalDraft);
  const [draft, setDraft] = useState(baseline);
  const [attempted, setAttempted] = useState(false);
  const profile = useQuery(profileQuery);
  const create = useCreateGoal();
  const { allowLeave } = useDiscardGuard(goalDraftKey(draft) !== goalDraftKey(baseline));

  const { target, saved, errors } = validateGoalDraft(draft);

  const save = async () => {
    setAttempted(true);
    if (target === null || saved === null || errors.title) return;
    const goal = await create.mutateAsync(toGoalCreate(draft, target, saved)).catch(() => null);
    if (!goal) return; // the failure is shown by the error banner
    hapticSuccess();
    allowLeave();
    if (goal.status === "completed") {
      // Started at or past its target, so it is already reached: take the user to where it is.
      showToast("Goal created, and it's already reached");
      router.dismissTo({ pathname: "/goals", params: { status: "completed" } });
    } else {
      showToast("Goal created");
      router.back();
    }
  };

  return (
    <GoalEditor
      title="New goal"
      draft={draft}
      onChange={setDraft}
      currency={profile.data?.currency ?? "INR"}
      savedLabel="Starting amount"
      autoFocusTitle
      errors={attempted ? errors : {}}
      formError={create.isError ? userMessage(create.error, "create this goal") : null}
      primary={{ label: "Create goal", onPress: save, disabled: create.isPending }}
    />
  );
}
