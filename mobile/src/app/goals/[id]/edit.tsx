import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { isNotFound, userMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { goalDraftFromGoal, goalDraftKey, goalEditPatch, justAchieved, validateGoalDraft } from "@/lib/goals";
import { wholeIfRound } from "@/lib/home";
import { isUuid } from "@/lib/ids";
import { useUpdateGoal } from "@/lib/mutations";
import { categoriesQuery, profileQuery, useOpenedGoal } from "@/lib/queries";
import type { Goal } from "@/lib/types";
import { Celebration, confirm, goBack, GoalEditor, hapticSuccess, SheetLoading, SheetNotFound, showToast, useDiscardGuard } from "@/ui";

// Edit goal: a cream sheet over the Goals screen. Archiving lives here (goals have no DELETE), and
// lowering the target below what is saved can complete the goal, which shows the celebration.

export default function EditGoalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!isUuid(id)) return <SheetNotFound title="Edit goal" what="Goal" />;
  return <EditLoader id={id} />;
}

// The form is built once from the goal as it was opened, so a background refetch
// never wipes an edit, and the patch is the difference from that goal.
function EditLoader({ id }: { id: string }) {
  const lookup = useOpenedGoal(id);
  if (lookup.goal) return <EditForm goal={lookup.goal} />;
  if (lookup.missing) return <SheetNotFound title="Edit goal" what="Goal" />;
  return <SheetLoading title="Edit goal" error={lookup.error ? userMessage(lookup.error, "load this goal") : null} onRetry={lookup.refetch} />;
}

function EditForm({ goal }: { goal: Goal }) {
  const router = useRouter();
  const [baseline] = useState(() => goalDraftFromGoal(goal));
  const [draft, setDraft] = useState(baseline);
  const [reached, setReached] = useState<Goal | null>(null); // the goal, once this save completed it
  const [failure, setFailure] = useState<string | null>(null);
  const profile = useQuery(profileQuery);
  const categories = useQuery(categoriesQuery("expense"));
  const update = useUpdateGoal();
  const { allowLeave } = useDiscardGuard(goalDraftKey(draft) !== goalDraftKey(baseline));

  const currency = profile.data?.currency ?? "INR";
  const { target, saved, errors } = validateGoalDraft(draft);
  // Only what changed is sent: lowering the target can complete the goal, and the server says so.
  const patch = target === null || saved === null ? {} : goalEditPatch(goal, draft, target, saved);
  const changed = Object.keys(patch).length > 0;

  const save = async () => {
    if (errors.title || target === null || saved === null || !changed) return;
    setFailure(null);
    let updated: Goal;
    try {
      updated = await update.mutateAsync({ id: goal.id, patch });
    } catch (err) {
      setFailure(userMessage(err, "save your changes"));
      return;
    }
    hapticSuccess();
    allowLeave();
    // Celebrate only when this very response moved the goal from active to completed.
    if (justAchieved(goal, updated)) {
      setReached(updated);
      return;
    }
    showToast("Changes saved");
    router.back();
  };

  // There is no DELETE for goals: archiving is the only way to remove one.
  const archive = async () => {
    const yes = await confirm(`Archive "${goal.title}"?`, "It will be removed from your goals. You can't undo this here.", "Archive", true);
    if (!yes) return;
    setFailure(null);
    try {
      await update.mutateAsync({ id: goal.id, patch: { status: "archived" } });
    } catch (err) {
      if (!isNotFound(err)) {
        setFailure(userMessage(err, "archive this goal"));
        return;
      }
      // Already gone elsewhere: the goal is met, so carry on as a success.
    }
    hapticSuccess();
    showToast("Goal archived");
    allowLeave();
    goBack();
  };

  return (
    <Celebration
      show={reached !== null}
      title="Goal reached!"
      message={reached ? `"${reached.title}" is complete: ${wholeIfRound(formatCurrency(reached.display_target_amount, currency))} saved.` : ""}
      onDone={() => router.back()}
    >
      <GoalEditor
        title="Edit goal"
        draft={draft}
        onChange={setDraft}
        currency={currency}
        savedLabel="Saved so far"
        categories={{
          items: categories.data?.categories ?? [],
          loading: categories.isPending,
          error: categories.isError ? userMessage(categories.error, "load your categories") : null,
          onRetry: () => void categories.refetch(),
        }}
        categoryFallback={goal.category_id ? { id: goal.category_id, name: goal.category ?? "Category" } : null}
        // The form starts valid, so any error shown here comes from something the user just changed.
        errors={errors}
        formError={failure}
        primary={{ label: "Save changes", onPress: save, disabled: !changed || update.isPending }}
        danger={{ label: "Archive goal", onPress: archive }}
      />
    </Celebration>
  );
}
