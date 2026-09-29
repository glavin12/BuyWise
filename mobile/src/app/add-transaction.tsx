import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Check, LayoutGrid, PenLine, Sparkle, User, X } from "lucide-react-native";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";

import { userMessage } from "@/lib/api";
import { currentMonth, isOverAYearAgo, todayLocal } from "@/lib/dates";
import { formatMinor } from "@/lib/format";
import { currencySymbol, wholeIfRound } from "@/lib/home";
import { METHOD_CHIP, QUICK_METHODS } from "@/lib/labels";
import { useCreateCategory, useCreateTransaction } from "@/lib/mutations";
import {
  categoriesQuery,
  categorySpendingQuery,
  payeesQuery,
  profileQuery,
  recentTransactionsQuery,
  useSuggestCategory,
} from "@/lib/queries";
import {
  afterSaveAndAddAnother,
  defaultMethod,
  DESCRIPTION_MAX,
  emptyDraft,
  isDirty,
  quickCategories,
  switchType,
  toCreatePayload,
  validateDraft,
  type PickedCategory,
  type PickedPayee,
  type TransactionDraft,
} from "@/lib/transactionForm";
import {
  Banner,
  CategoryChoice,
  Chip,
  CircleButton,
  DashedChoice,
  DateChip,
  EntryAmount,
  FieldButton,
  FieldInput,
  goBack,
  hapticSuccess,
  Note,
  Overlaid,
  PickerList,
  PrimaryButton,
  Row,
  Screen,
  SecondaryButton,
  SectionLabel,
  SheetHandle,
  showToast,
  Stack,
  Title,
  Toggle,
  useDiscardGuard,
  type PickerItem,
} from "@/ui";

// Quick add (design/screens/04-quick-add-sheet.png, values from design/reference-html/QuickAdd.html),
// opened by holding the centre tab. Beyond the design, on the owner's call: a "More" tile opens every
// category, and the note field and the "Other" method stay.

const TYPES = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
] as const;

type Picker = "category" | "payee";

export default function AddTransactionModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const amountRef = useRef<TextInput>(null);
  // Starts on the newest transaction's method (read from the cache Home filled; UPI with none).
  const [baseline, setBaseline] = useState<TransactionDraft>(() =>
    emptyDraft(todayLocal(), defaultMethod(queryClient.getQueryData(recentTransactionsQuery.queryKey)?.transactions[0])),
  );
  const [draft, setDraft] = useState<TransactionDraft>(baseline);
  const [attempted, setAttempted] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);
  // "Swiggy → Food & Dining, like last time": shown while the category the payee suggested is still chosen.
  const [suggested, setSuggested] = useState<{ payee: string; categoryId: string; category: string } | null>(null);

  const kind = draft.type === "income" ? "income" : "expense";
  const profile = useQuery(profileQuery);
  const categories = useQuery(categoriesQuery(kind));
  const payees = useQuery(payeesQuery(kind));
  // This month's spending per category ranks the tiles (expenses only: income keeps the list's order).
  const spending = useQuery(categorySpendingQuery(currentMonth()));
  const create = useCreateTransaction();
  const createCategory = useCreateCategory();
  const suggestCategory = useSuggestCategory();
  const { allowLeave } = useDiscardGuard(isDirty(draft, baseline));

  const currency = profile.data?.currency ?? "INR";
  const { amount, errors } = validateDraft(draft);
  const shownErrors = attempted ? errors : {};
  const list = categories.data?.categories.filter((c) => c.is_active) ?? [];
  const usage = new Map(kind === "expense" ? (spending.data ?? []).map((row) => [row.category_id, row.transaction_count]) : []);
  const tiles = quickCategories(list, usage, draft.category?.id ?? null);
  const hint = suggested && suggested.categoryId === draft.category?.id ? suggested : null;

  const chooseCategory = (category: PickedCategory) => setDraft((d) => ({ ...d, category }));

  // The payee's usual category is offered, but never over one the user chose.
  const pickPayee = (payee: PickedPayee) => {
    const typeAtPick = draft.type;
    setDraft((d) => ({ ...d, payee }));
    if (!payee.id || draft.category) return;
    void suggestCategory(payee.id, list, typeAtPick).then((category) => {
      if (!category) return;
      setDraft((d) => (d.category || d.type !== typeAtPick ? d : { ...d, category }));
      setSuggested({ payee: payee.name, categoryId: category.id, category: category.name });
    });
  };

  const save = async (another: boolean) => {
    setAttempted(true);
    if (amount === null || errors.category) return;
    try {
      await create.mutateAsync(toCreatePayload(draft, amount, profile.data?.currency));
    } catch {
      return; // the failure is shown by the error banner
    }
    hapticSuccess();
    const amountText = formatMinor(amount, currency);
    const categoryName = draft.category?.name ?? "";
    showToast(draft.type === "income" ? `${amountText} income added to ${categoryName}` : `${amountText} added to ${categoryName}`);
    if (another) {
      const next = afterSaveAndAddAnother(draft);
      setDraft(next);
      setBaseline(next); // what is left (type, category, method, date) is not "unsaved work"
      setAttempted(false);
      setSuggested(null);
      amountRef.current?.focus();
    } else {
      allowLeave();
      router.back();
    }
  };

  const title = kind === "income" ? "Add income" : "Add expense";
  const saveLabel = amount !== null ? `Save ${wholeIfRound(formatMinor(amount, currency))}` : "Save";

  const overlay =
    picker === "category" ? (
      <PickerList
        title="Category"
        searchLabel="Search or add a category"
        noun="category"
        emptyMessage="No categories yet."
        items={list.map((c) => ({ id: c.id, label: c.name }))}
        loading={categories.isPending}
        error={categories.isError ? userMessage(categories.error, "load your categories") : null}
        onRetry={() => void categories.refetch()}
        onSelect={(item: PickerItem) => {
          const category = list.find((c) => c.id === item.id);
          if (category) chooseCategory({ id: category.id, name: category.name, icon: category.icon });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
        onCreate={async (name) => {
          const category = await createCategory.mutateAsync({ name, type: kind });
          chooseCategory({ id: category.id, name: category.name, icon: category.icon });
          setPicker(null);
        }}
      />
    ) : picker === "payee" ? (
      <PickerList
        title="Payee"
        searchLabel="Search or add a payee"
        noun="payee"
        emptyMessage="No payees yet."
        items={(payees.data?.payees ?? []).map((p) => ({ id: p.id, label: p.name }))}
        loading={payees.isPending}
        error={payees.isError ? userMessage(payees.error, "load your payees") : null}
        onRetry={() => void payees.refetch()}
        onSelect={(item: PickerItem) => {
          pickPayee({ id: item.id, name: item.label });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
        // A new payee is created by name when the transaction saves, so backing out leaves no orphan.
        onCreate={async (name) => {
          pickPayee({ name });
          setPicker(null);
        }}
      />
    ) : null;

  return (
    <Overlaid overlay={overlay}>
      <Screen surface="cream" keyboard>
        <SheetHandle />
        <Row justify="between">
          <Title tone="ink">{title}</Title>
          <CircleButton icon={X} variant="line" size={38} label="Close" onPress={goBack} />
        </Row>

        {create.isError ? <Banner tone="error" message={userMessage(create.error, "save this transaction")} /> : null}

        <Toggle
          options={TYPES}
          value={kind}
          onChange={(type) => {
            setDraft(switchType(draft, type));
            setSuggested(null);
          }}
        />

        <Stack gap="xs">
          <EntryAmount ref={amountRef} value={draft.amount} onChange={(text) => setDraft({ ...draft, amount: text })} symbol={currencySymbol(currency)} autoFocus />
          {shownErrors.amount ? <Note tone="error">{shownErrors.amount}</Note> : null}
          {hint ? (
            <Row justify="center">
              <Chip variant="mint" icon={Sparkle} label={`${hint.payee} → ${hint.category}, like last time`} />
            </Row>
          ) : null}
        </Stack>

        <Stack gap="sm">
          <SectionLabel label="Category" light />
          {categories.isError && !categories.data ? (
            <Note tone="error">{userMessage(categories.error, "load your categories")}</Note>
          ) : (
            <Row justify="between" align="start">
              {tiles.map((c) => (
                <CategoryChoice
                  key={c.id}
                  name={c.name}
                  color={c.color}
                  icon={c.icon}
                  selected={c.id === draft.category?.id}
                  onPress={() => chooseCategory({ id: c.id, name: c.name, icon: c.icon })}
                />
              ))}
              <DashedChoice label="More" icon={LayoutGrid} a11y="All categories, or add a new one" onPress={() => setPicker("category")} />
            </Row>
          )}
          {shownErrors.category ? <Note tone="error">{shownErrors.category}</Note> : null}
        </Stack>

        <FieldButton
          icon={User}
          label="Payee"
          value={draft.payee?.name ?? null}
          placeholder="Add a payee"
          hint="payee"
          onPress={() => setPicker("payee")}
          onClear={() => {
            setDraft({ ...draft, payee: null });
            setSuggested(null);
          }}
        />
        <FieldInput
          icon={PenLine}
          accessibilityLabel="Note (optional)"
          placeholder="Add a note"
          value={draft.description}
          onChangeText={(description) => setDraft({ ...draft, description })}
          maxLength={DESCRIPTION_MAX}
          returnKeyType="done"
        />

        <Row gap="xs" wrap>
          {QUICK_METHODS.map((method) => {
            const on = draft.method === method;
            return (
              <Chip
                key={method}
                label={METHOD_CHIP[method]}
                variant={on ? "ink" : "outlined"}
                selected={on}
                // Tapping the chosen method again clears it: the method is optional.
                onPress={() => setDraft({ ...draft, method: on ? null : method })}
              />
            );
          })}
          <DateChip value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
        </Row>
        {isOverAYearAgo(draft.date, todayLocal()) ? <Note tone="cream">That date is more than a year ago. Check that it is right.</Note> : null}

        <PrimaryButton label={saveLabel} icon={Check} onPress={() => save(false)} disabled={create.isPending} requiresNetwork />
        <SecondaryButton label="Save & add another" onPress={() => save(true)} disabled={create.isPending} requiresNetwork />
      </Screen>
    </Overlaid>
  );
}
