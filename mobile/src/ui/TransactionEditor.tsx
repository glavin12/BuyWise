import { useQuery } from "@tanstack/react-query";
import { Check, LayoutGrid, PenLine, Sparkle, TextAlignStart, User } from "lucide-react-native";
import { useState, type Dispatch, type Ref, type SetStateAction } from "react";
import type { TextInput } from "react-native";

import { currentMonth, isOverAYearAgo, todayLocal } from "@/lib/dates";
import { userMessage } from "@/lib/errors";
import { currencySymbol } from "@/lib/home";
import { METHOD_CHIP, QUICK_METHODS } from "@/lib/labels";
import { useCreateCategory, useCreatePayee } from "@/lib/mutations";
import { categoriesQuery, categorySpendingQuery, payeesQuery, useSuggestCategory } from "@/lib/queries";
import {
  DESCRIPTION_MAX,
  NOTES_MAX,
  quickCategories,
  switchType,
  type DraftErrors,
  type PickedCategory,
  type PickedPayee,
  type TransactionDraft,
} from "@/lib/transactionForm";

import { EntryAmount } from "./AmountInput";
import { Banner } from "./Banner";
import { Note, SectionLabel } from "./Blocks";
import { PrimaryButton, SecondaryButton } from "./Buttons";
import { CategoryChoice, DashedChoice } from "./CategoryTile";
import { Chip, Toggle } from "./Chips";
import { DateChip } from "./DateChip";
import { FieldButton, FieldInput } from "./Field";
import { Row, Stack } from "./Layout";
import { Overlaid, PickerList, type PickerItem } from "./PickerList";
import { SheetScreen } from "./SheetScreen";

/** What GoalEditor's category chooser is given: the choices and how loading them is going. */
export type ChoiceList<T> = { items: readonly T[]; loading: boolean; error: string | null; onRetry: () => void };
type Action = { label: string; onPress: () => Promise<unknown>; disabled?: boolean };

const TYPES = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
] as const;

type Picker = "category" | "payee";

/**
 * The transaction form both Add (Quick Add) and Edit render, as a cream sheet (design/screens/04-quick-add-sheet.png,
 * values from design/reference-html/QuickAdd.html): type, amount, category tiles with a "More" chooser, payee, note,
 * method and date. Beyond the design, on the owner's call: the note field, "Other" and "More". The caller owns the
 * draft and every write; this owns what it fetches to fill the choices (categories, payees, this month's spending).
 *
 * `editing`: an existing row. The title says Edit, the amount does not grab the keyboard, a "Details" field for the long
 * `notes` appears, and a new payee is created before it is picked (a PATCH cannot create one by name). A starting
 * balance (Edit only) has no type, category, payee, note or method: just amount, date and details.
 */
export function TransactionEditor({
  draft,
  onChange,
  currency,
  editing = false,
  amountRef,
  errors,
  formError,
  primary,
  secondary,
}: {
  draft: TransactionDraft;
  onChange: Dispatch<SetStateAction<TransactionDraft>>;
  currency: string;
  editing?: boolean;
  amountRef?: Ref<TextInput>;
  /** What to show under the fields: the caller decides when (Add waits for the first save attempt). */
  errors: DraftErrors;
  formError: string | null;
  primary: Action;
  secondary?: Action;
}) {
  const [picker, setPicker] = useState<Picker | null>(null);
  // "Swiggy → Food & Dining, like last time": shown while that payee and the category it suggested are still chosen.
  const [suggested, setSuggested] = useState<{ payee: string; categoryId: string; category: string } | null>(null);

  const startingBalance = draft.type === "starting_balance";
  const kind = draft.type === "income" ? "income" : "expense";
  const categories = useQuery({ ...categoriesQuery(kind), enabled: !startingBalance });
  const payees = useQuery({ ...payeesQuery(kind), enabled: !startingBalance });
  // This month's spending per category ranks the tiles (expenses only: income keeps the list's order).
  const spending = useQuery({ ...categorySpendingQuery(currentMonth()), enabled: !startingBalance });
  const createCategory = useCreateCategory();
  const createPayee = useCreatePayee();
  const suggestCategory = useSuggestCategory();

  const list = categories.data?.categories.filter((c) => c.is_active) ?? [];
  const chosen = draft.category;
  // Editing: the row's own category may have been archived since, so it is missing from the list and still shows, chosen.
  const pool = chosen && !list.some((c) => c.id === chosen.id) ? [{ ...chosen, color: null }, ...list] : list;
  const usage = new Map(kind === "expense" ? (spending.data ?? []).map((row) => [row.category_id, row.transaction_count]) : []);
  const tiles = quickCategories(pool, usage, chosen?.id ?? null);
  const hint = suggested && suggested.categoryId === chosen?.id && suggested.payee === draft.payee?.name ? suggested : null;

  const chooseCategory = (category: PickedCategory) => onChange((d) => ({ ...d, category }));

  // The payee's usual category is offered, but never over one the user chose.
  const pickPayee = (payee: PickedPayee) => {
    const typeAtPick = draft.type;
    onChange((d) => ({ ...d, payee }));
    if (!payee.id || draft.category) return;
    void suggestCategory(payee.id, list, typeAtPick).then((category) => {
      if (!category) return;
      onChange((d) => (d.category || d.type !== typeAtPick ? d : { ...d, category }));
      setSuggested({ payee: payee.name, categoryId: category.id, category: category.name });
    });
  };

  const overlay =
    picker === "category" ? (
      <PickerList
        title="Category"
        searchLabel="Search or add a category"
        noun="category"
        emptyMessage="No categories yet."
        items={list.map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon }))}
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
        // Adding: a new payee is created by name when the transaction saves, so backing out leaves no orphan.
        // Editing: a PATCH cannot create a payee by name, so it is created (idempotently) first.
        onCreate={async (name) => {
          if (editing) {
            const payee = await createPayee.mutateAsync({ name, type: kind });
            pickPayee({ id: payee.id, name: payee.name });
          } else {
            pickPayee({ name });
          }
          setPicker(null);
        }}
      />
    ) : null;

  return (
    <Overlaid overlay={overlay}>
      <SheetScreen title={`${editing ? "Edit" : "Add"} ${startingBalance ? "starting balance" : kind}`}>
        {formError ? <Banner tone="error" surface="cream" message={formError} /> : null}

        {startingBalance ? null : <Toggle options={TYPES} value={kind} onChange={(type) => onChange(switchType(draft, type))} />}

        <Stack gap="xs">
          <EntryAmount ref={amountRef} value={draft.amount} onChange={(text) => onChange({ ...draft, amount: text })} symbol={currencySymbol(currency)} autoFocus={!editing} />
          {errors.amount ? <Note tone="error">{errors.amount}</Note> : null}
          {hint ? (
            <Row justify="center">
              <Chip variant="mint" icon={Sparkle} label={`${hint.payee} → ${hint.category}, like last time`} />
            </Row>
          ) : null}
        </Stack>

        {startingBalance ? null : (
          <>
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
                      selected={c.id === chosen?.id}
                      onPress={() => chooseCategory({ id: c.id, name: c.name, icon: c.icon })}
                    />
                  ))}
                  <DashedChoice label="More" icon={LayoutGrid} a11y="All categories, or add a new one" onPress={() => setPicker("category")} />
                </Row>
              )}
              {errors.category ? <Note tone="error">{errors.category}</Note> : null}
            </Stack>

            <FieldButton
              icon={User}
              label="Payee"
              value={draft.payee?.name ?? null}
              placeholder="Add a payee"
              hint="payee"
              onPress={() => setPicker("payee")}
              onClear={() => onChange({ ...draft, payee: null })}
            />
            <FieldInput
              icon={PenLine}
              accessibilityLabel="Note (optional)"
              placeholder="Add a note"
              value={draft.description}
              onChangeText={(description) => onChange({ ...draft, description })}
              maxLength={DESCRIPTION_MAX}
              returnKeyType="done"
            />
          </>
        )}

        <Row gap="xs" wrap>
          {startingBalance
            ? null
            : QUICK_METHODS.map((method) => {
                const on = draft.method === method;
                return (
                  <Chip
                    key={method}
                    label={METHOD_CHIP[method]}
                    variant={on ? "ink" : "outlined"}
                    selected={on}
                    // Tapping the chosen method again clears it: the method is optional.
                    onPress={() => onChange({ ...draft, method: on ? null : method })}
                  />
                );
              })}
          <DateChip value={draft.date} onChange={(date) => onChange({ ...draft, date })} />
        </Row>
        {isOverAYearAgo(draft.date, todayLocal()) ? <Note tone="cream">That date is more than a year ago. Check that it is right.</Note> : null}

        {editing ? (
          <FieldInput
            grow
            icon={TextAlignStart}
            accessibilityLabel="Details (optional)"
            placeholder="Add more details"
            value={draft.notes}
            onChangeText={(notes) => onChange({ ...draft, notes })}
            maxLength={NOTES_MAX}
          />
        ) : null}

        <PrimaryButton label={primary.label} icon={Check} onPress={primary.onPress} disabled={primary.disabled} requiresNetwork />
        {secondary ? <SecondaryButton label={secondary.label} onPress={secondary.onPress} disabled={secondary.disabled} requiresNetwork /> : null}
      </SheetScreen>
    </Overlaid>
  );
}
