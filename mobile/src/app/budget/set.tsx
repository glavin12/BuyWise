import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { isNotFound, userMessage } from "@/lib/api";
import { parseMonthYear, type MonthYear } from "@/lib/dates";
import { formatMonth } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { minorToAmountText, parsePositiveAmount } from "@/lib/money";
import { useDeleteBudget, useSetBudget, useUpdateBudget } from "@/lib/mutations";
import { categoriesQuery, monthBudgetsQuery, profileQuery } from "@/lib/queries";
import type { Budget } from "@/lib/types";
import {
  AmountInput,
  Banner,
  Button,
  confirm,
  ErrorState,
  hapticSuccess,
  NotFoundScreen,
  Screen,
  showToast,
  Skeleton,
  Stack,
  Text,
  useDiscardGuard,
} from "@/ui";

// Opens from the Budget tab with ?categoryId=…&month=…&year=…: set a budget for
// that category and month, or edit / delete the one that is there.
export default function BudgetSetRoute() {
  const params = useLocalSearchParams<{ categoryId?: string; month?: string; year?: string }>();
  const period = parseMonthYear(params.month, params.year);
  // These come from a URL, so anything malformed is "not found".
  if (!isUuid(params.categoryId) || !period) return <NotFoundScreen title="Budget" what="Budget" />;
  return <BudgetSetLoader categoryId={params.categoryId} period={period} />;
}

function BudgetSetLoader({ categoryId, period }: { categoryId: string; period: MonthYear }) {
  const budgets = useQuery(monthBudgetsQuery(period));
  const categories = useQuery(categoriesQuery("expense"));
  const existing = budgets.data?.budgets.find((b) => b.category_id === categoryId);
  const category = categories.data?.categories.find((c) => c.id === categoryId);

  if (budgets.data) {
    // An existing budget can always be edited or deleted, even if its category has since been archived.
    if (existing) return <BudgetForm categoryId={categoryId} name={existing.category ?? "Category"} existing={existing} period={period} />;
    if (category) return <BudgetForm categoryId={categoryId} name={category.name} period={period} />;
    // Not in the active expense categories, so it cannot take a new budget.
    if (categories.data) return <NotFoundScreen title="Set budget" what="Category" />;
  }

  const failed = budgets.isError ? budgets : categories.isError ? categories : null;
  return (
    <Screen title="Set budget" back>
      {failed ? (
        <ErrorState message={userMessage(failed.error, "load this budget")} onRetry={() => failed.refetch()} />
      ) : (
        <Skeleton height={160} />
      )}
    </Screen>
  );
}

function BudgetForm({
  categoryId,
  name,
  existing,
  period,
}: {
  categoryId: string;
  name: string;
  existing?: Budget;
  period: MonthYear;
}) {
  const router = useRouter();
  const [initial] = useState(() => (existing ? minorToAmountText(existing.budgeted_amount) : ""));
  const [text, setText] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const profile = useQuery(profileQuery);
  const set = useSetBudget();
  const update = useUpdateBudget();
  const remove = useDeleteBudget();
  const { allowLeave } = useDiscardGuard(text.trim() !== initial);

  const currency = profile.data?.currency ?? "INR";
  const monthLabel = formatMonth(period.month, period.year);
  const { minor, error } = parsePositiveAmount(text);
  const unchanged = existing !== undefined && minor === existing.budgeted_amount;
  const busy = set.isPending || update.isPending || remove.isPending;

  const finish = (message: string) => {
    hapticSuccess();
    showToast(message);
    allowLeave();
    router.back();
  };

  const save = async () => {
    setAttempted(true);
    setFailure(null);
    if (minor === null || unchanged) return;
    try {
      if (existing) await update.mutateAsync({ id: existing.id, budgeted_amount: minor });
      else await set.mutateAsync({ category_id: categoryId, month: period.month, year: period.year, budgeted_amount: minor });
    } catch (err) {
      setFailure(userMessage(err, "save this budget"));
      return;
    }
    finish("Budget saved");
  };

  const onDelete = async () => {
    if (!existing) return;
    const yes = await confirm(`Delete the ${name} budget?`, `${monthLabel}. This can't be undone.`, "Delete", true);
    if (!yes) return;
    setFailure(null);
    try {
      await remove.mutateAsync(existing.id);
    } catch (err) {
      if (!isNotFound(err)) {
        setFailure(userMessage(err, "delete this budget"));
        return;
      }
      // Already deleted elsewhere: the goal is met, so carry on as a success.
    }
    finish("Budget deleted");
  };

  return (
    <Screen title={existing ? "Edit budget" : "Set budget"} back keyboard>
      {failure ? <Banner tone="error" message={failure} /> : null}

      <Stack gap="xs">
        <Text variant="heading">{name}</Text>
        <Text tone="muted">{monthLabel}</Text>
      </Stack>

      <AmountInput
        label={`Budget for ${monthLabel} (${currency})`}
        value={text}
        onChange={setText}
        currency={currency}
        error={attempted || text !== initial ? error : null}
        autoFocus
      />

      <Button title="Save" onPress={save} disabled={busy || unchanged} requiresNetwork />
      {existing ? <Button title="Delete budget" variant="danger" onPress={onDelete} disabled={busy} requiresNetwork /> : null}
    </Screen>
  );
}
