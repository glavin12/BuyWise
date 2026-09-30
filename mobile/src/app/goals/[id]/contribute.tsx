import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Plus, Sparkle } from "lucide-react-native";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { formatCurrency, formatMinor } from "@/lib/format";
import { contributionPreview, justAchieved, percentOf } from "@/lib/goals";
import { currencySymbol, wholeIfRound } from "@/lib/home";
import { isUuid } from "@/lib/ids";
import { parsePositiveAmount } from "@/lib/money";
import { useUpdateGoal } from "@/lib/mutations";
import { profileQuery, useOpenedGoal } from "@/lib/queries";
import type { Goal } from "@/lib/types";
import {
  Banner,
  Celebration,
  Chip,
  EntryAmount,
  hapticSuccess,
  Meter,
  Note,
  PrimaryButton,
  Row,
  SheetLoading,
  SheetNotFound,
  SheetScreen,
  showToast,
  Stack,
  Title,
  useDiscardGuard,
} from "@/ui";

// Contribute: a cream sheet over the Goals screen. Reaching the target shows the celebration.

export default function ContributeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!isUuid(id)) return <SheetNotFound title="Contribute" what="Goal" />;
  return <ContributeLoader id={id} />;
}

function ContributeLoader({ id }: { id: string }) {
  const lookup = useOpenedGoal(id);
  if (lookup.goal) return <ContributeForm goal={lookup.goal} />;
  if (lookup.missing) return <SheetNotFound title="Contribute" what="Goal" />;
  return <SheetLoading title="Contribute" error={lookup.error ? userMessage(lookup.error, "load this goal") : null} onRetry={lookup.refetch} />;
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
  const money = (display: number) => wholeIfRound(formatCurrency(display, currency));
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
      message={reached ? `You've saved ${money(reached.display_target_amount)} for "${reached.title}".` : ""}
      onDone={() => router.back()}
    >
      <SheetScreen title="Contribute">
        {failure ? <Banner tone="error" surface="cream" message={failure} /> : null}

        <Stack gap="sm">
          <Title size="cardTitle" tone="ink">
            {goal.title}
          </Title>
          <Note tone="cream">{`${money(goal.display_current_amount)} of ${money(goal.display_target_amount)} saved`}</Note>
          <Meter percent={percentOf(goal.current_amount, goal.target_amount)} label={`${goal.title} progress`} />
        </Stack>

        <Stack gap="xs">
          <EntryAmount value={text} onChange={setText} symbol={currencySymbol(currency)} label="Amount to add" autoFocus />
          {attempted && error ? <Note tone="error">{error}</Note> : null}
          {preview ? (
            <Row justify="center" gap="xs" wrap>
              <Chip variant="outlined" label={`New total ${wholeIfRound(formatMinor(preview.total, currency))} · ${preview.percent}%`} />
              {preview.achieves ? <Chip variant="mint" icon={Sparkle} label="This reaches your goal!" /> : null}
            </Row>
          ) : null}
        </Stack>

        <PrimaryButton label="Contribute" icon={Plus} onPress={save} disabled={update.isPending} requiresNetwork />
      </SheetScreen>
    </Celebration>
  );
}
