import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Flag,
  GraduationCap,
  Pencil,
  Plane,
  Plus,
  ShieldCheck,
  ShoppingBag,
  TreePalm,
  TrendingUp,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { todayLocal } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { countdown, featuredGoal, percentOf } from "@/lib/goals";
import { compactMoney, wholeIfRound } from "@/lib/home";
import { goalsQuery, profileQuery, type GoalList } from "@/lib/queries";
import { escapeRich } from "@/lib/richText";
import type { Goal } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import {
  Banner,
  Chip,
  CircleButton,
  Dial,
  Fab,
  goBack,
  GoalTile,
  Panel,
  PrimaryButton,
  RichText,
  Row,
  Screen,
  Skeleton,
  Stack,
  Title,
  Toggle,
  type Hue,
} from "@/ui";

// Goals (design/screens/06-goals.png, values from design/reference-html/Goals.html): back, title and
// Active / Achieved, the dial for one goal (the highest priority at first; tapping a tile below puts
// that one on the dial), its countdown and monthly chips, Contribute and edit, the other goals as
// tiles, and the marigold + for a new goal. Archiving is on the Edit screen.

const VIEWS = [
  { label: "Active", value: "active" },
  { label: "Achieved", value: "completed" },
] as const;

const GLYPH: Record<string, LucideIcon> = {
  emergency_fund: ShieldCheck,
  purchase: ShoppingBag,
  vacation: Plane,
  investment: TrendingUp,
  debt_repayment: CreditCard,
  education: GraduationCap,
  retirement: TreePalm,
};

const TILE_COLOURS: readonly Hue[] = ["mint", "sky", "lavender", "marigold"];

export default function GoalsScreen() {
  const router = useRouter();
  // The Active / Achieved choice lives in the URL so that a screen that opens over this
  // one (a goal created already reached) can send the user to the right list.
  const { status } = useLocalSearchParams<{ status?: string }>();
  const view: GoalList = status === "completed" ? "completed" : "active";
  const [picked, setPicked] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const goals = useQuery(goalsQuery(view));
  const profile = useQuery(profileQuery);
  useRefetchStaleOnFocus();

  const currency = profile.data?.currency ?? "INR";
  const money = (display: number) => wholeIfRound(formatCurrency(display, currency));
  const list = goals.data?.goals;
  const goal = list ? (list.find((g) => g.id === picked) ?? featuredGoal(list)) : undefined;
  const others = list?.filter((g) => g !== goal) ?? [];
  const pairs = Array.from({ length: Math.ceil(others.length / 2) }, (_, i) => others.slice(i * 2, i * 2 + 2));

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await goals.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const newGoal = () => router.push("/goals/new");

  return (
    <Screen surface="sage" onRefresh={refresh} refreshing={refreshing} fab={<Fab label="New goal" onPress={newGoal} />}>
      <Row>
        <CircleButton icon={ArrowLeft} variant="sage" label="Go back" onPress={goBack} />
        <Stack grow>
          <Title tone="ink">Goals</Title>
        </Stack>
        <Toggle look="sage" options={VIEWS} value={view} onChange={(next) => router.setParams({ status: next })} />
      </Row>

      {list && goals.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known goals." /> : null}

      {!list ? (
        goals.isError ? (
          <Panel color="cream">
            <Stack>
              <Title size="cardTitle" tone="ink">{"Can't load\ngoals"}</Title>
              <RichText tone="ink">{escapeRich(userMessage(goals.error, "load your goals"))}</RichText>
              <PrimaryButton label="Try again" onPress={() => goals.refetch()} />
            </Stack>
          </Panel>
        ) : (
          <>
            <Row justify="center">
              <Skeleton width={310} height={310} round="pill" />
            </Row>
            <Skeleton height={58} round="pill" />
            <Skeleton height={150} round="card" />
          </>
        )
      ) : !goal ? (
        <Panel color="cream">
          <Stack>
            <Title size="cardTitle" tone="ink">{view === "active" ? "No active\ngoals" : "Nothing\nachieved yet"}</Title>
            <RichText tone="ink">
              {view === "active" ? "Set a target and watch the dial fill as you save towards it." : "Goals you reach show up here."}
            </RichText>
            {view === "active" ? <PrimaryButton label="New goal" icon={Plus} onPress={newGoal} /> : null}
          </Stack>
        </Panel>
      ) : (
        <GoalFocus goal={goal} money={money} onContribute={() => router.push(`/goals/${goal.id}/contribute`)} onEdit={() => router.push(`/goals/${goal.id}/edit`)} />
      )}

      {pairs.map((pair, row) => (
        <Row key={pair[0].id} align="stretch">
          {pair.map((g, i) => (
            <GoalTile
              key={g.id}
              icon={GLYPH[g.goal_type ?? ""] ?? Flag}
              color={TILE_COLOURS[(row * 2 + i) % TILE_COLOURS.length]}
              title={g.title}
              amounts={`${compactMoney(g.current_amount, currency)} of ${compactMoney(g.target_amount, currency)}`}
              percent={percentOf(g.current_amount, g.target_amount)}
              onPress={() => setPicked(g.id)}
            />
          ))}
          {pair.length === 1 ? <Stack grow /> : null}
        </Row>
      ))}
    </Screen>
  );
}

/** The goal on the dial: the dial, "92 days left" and "₹8,700 / month", then Contribute and edit. */
function GoalFocus({
  goal,
  money,
  onContribute,
  onEdit,
}: {
  goal: Goal;
  money: (display: number) => string;
  onContribute: () => void;
  onEdit: () => void;
}) {
  const achieved = goal.status === "completed";
  const percent = percentOf(goal.current_amount, goal.target_amount);
  const due = achieved ? null : countdown(goal.target_date, todayLocal());
  const monthly = achieved ? null : goal.display_monthly_needed_to_hit_target;
  const saved = money(goal.display_current_amount);
  const target = money(goal.display_target_amount);

  return (
    <>
      <Row justify="center">
        <Dial
          percent={percent}
          title={goal.title}
          amount={saved}
          sub={`of ${target} · ${percent}%`}
          label={`${goal.title}: ${saved} of ${target} saved, ${percent}%${achieved ? ", achieved" : ""}`}
        />
      </Row>
      {due || monthly !== null ? (
        <Row justify="between">
          {due ? <Chip variant="creamLine" icon={Calendar} label={due.label} /> : <Stack />}
          {monthly !== null ? <Chip variant="creamLine" label={`${money(monthly)} / month`} accessibilityLabel={`Save ${money(monthly)} a month to get there`} /> : null}
        </Row>
      ) : null}
      {achieved ? (
        <PrimaryButton label="Edit goal" icon={Pencil} onPress={onEdit} />
      ) : (
        <Row gap="sm">
          <Stack grow>
            <PrimaryButton label="Contribute" icon={Plus} onPress={onContribute} />
          </Stack>
          <CircleButton icon={Pencil} variant="line" size={58} label="Edit goal" onPress={onEdit} />
        </Row>
      )}
    </>
  );
}
