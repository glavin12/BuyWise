import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { formatCurrency, formatMinor } from "@/lib/format";
import { contributionPreview, justAchieved } from "@/lib/goals";
import { isUuid } from "@/lib/ids";
import { parsePositiveAmount } from "@/lib/money";
import { useUpdateGoal } from "@/lib/mutations";
import { profileQuery, useOpenedGoal } from "@/lib/queries";
import type { Goal } from "@/lib/types";
import {
  AmountInput,
  Banner,
  Button,
  Card,
  Celebration,
  ErrorState,
  hapticSuccess,
  NotFoundScreen,
  Screen,
  showToast,
  Skeleton,
  Text,
  useDiscardGuard,
} from "@/ui";

export default function ContributeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!isUuid(id)) return <NotFoundScreen title="Contribute" what="Goal" />;
  return <ContributeLoader id={id} />;
}

function ContributeLoader({ id }: { id: string }) {
  const lookup = useOpenedGoal(id);
  if (lookup.goal) return <ContributeForm goal={lookup.goal} />;
  if (lookup.missing) return <NotFoundScreen title="Contribute" what="Goal" />;
  return (
    <Screen title="Contribute" back>
      {lookup.error ? (
        <ErrorState message={userMessage(lookup.error, "load this goal")} onRetry={lookup.refetch} />
      ) : (
        <Skeleton height={160} />
      )}
    </Screen>
  );
}

function ContributeForm({ goal }: { goal: Goal }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [reached, setReached] = useState<Goal | null>(null); // the goal, once this contribution completed it
  const [failure, setFailure] = useState<string | null>(null);
  const profile = useQuery(profileQuery);
  const update = useUpdateGoal();
  const { allowLeave } = useDiscardGuard(text.trim() !== "");

  const currency = profile.data?.currency ?? "INR";
  const { minor, error } = parsePositiveAmount(text);
  const preview = minor === null ? null : contributionPreview(goal.current_amount, goal.target_amount, minor);

  const save = async () => {
    setAttempted(true);
    setFailure(null);
    if (minor === null) return;
    let saved: Goal;
    try {
      // ponytail: the new total is the cached total plus this amount (integers), so two
      // devices contributing at the same moment lose one of the two. If that ever matters,
      // add an atomic POST /goals/{id}/contribute on the API and call that instead.
      saved = await update.mutateAsync({ id: goal.id, patch: { current_amount: goal.current_amount + minor } });
    } catch (err) {
      setFailure(userMessage(err, "add this amount"));
      return;
    }
    hapticSuccess();
    allowLeave();
    // Celebrate only when this very response moved the goal from active to completed.
    if (justAchieved(goal, saved)) {
      setReached(saved);
      return;
    }
    showToast("Added to your goal");
    router.back();
  };

  return (
    <Celebration
      show={reached !== null}
      title="Goal reached!"
      message={reached ? `You've saved ${formatCurrency(reached.display_target_amount, currency)} for "${reached.title}".` : ""}
      onDone={() => router.back()}
    >
      <Screen title="Contribute" back keyboard>
        {failure ? <Banner tone="error" message={failure} /> : null}

        <Card>
          <Text variant="heading">{goal.title}</Text>
          <Text tone="muted">{`${formatCurrency(goal.display_current_amount, currency)} of ${formatCurrency(goal.display_target_amount, currency)} saved`}</Text>
        </Card>

        <AmountInput
          label={`Amount to add (${currency})`}
          value={text}
          onChange={setText}
          currency={currency}
          error={attempted ? error : null}
          autoFocus
        />

        {preview ? (
          <Text tone={preview.achieves ? "positive" : "muted"}>
            {preview.achieves
              ? `New total ${formatMinor(preview.total, currency)} · this reaches your goal!`
              : `New total ${formatMinor(preview.total, currency)} · ${preview.percent}%`}
          </Text>
        ) : null}

        <Button title="Add to goal" onPress={save} disabled={update.isPending} requiresNetwork />
      </Screen>
    </Celebration>
  );
}
