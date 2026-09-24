import { useEffect, useState, type Ref } from "react";
import { BackHandler, StyleSheet, View, type TextInput } from "react-native";

import { isOverAYearAgo, todayLocal } from "@/lib/dates";
import { METHOD_LABEL, PAYMENT_METHODS } from "@/lib/labels";
import {
  DESCRIPTION_MAX,
  NOTES_MAX,
  switchType,
  type DraftErrors,
  type PickedCategory,
  type PickedPayee,
  type TransactionDraft,
} from "@/lib/transactionForm";

import { AmountInput } from "./AmountInput";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Chips, Segmented } from "./Controls";
import { DateField } from "./DateField";
import { Input } from "./Input";
import { PickerList, type PickerItem } from "./PickerList";
import { Screen } from "./Screen";
import { SelectField } from "./SelectField";
import { Text } from "./Text";

export type ChoiceList<T> = { items: readonly T[]; loading: boolean; error: string | null; onRetry: () => void };
type Action = { label: string; onPress: () => Promise<unknown>; disabled?: boolean };

const TYPE_OPTIONS = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
] as const;

const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ label: METHOD_LABEL[method], value: method }));

type PickerKind = "category" | "payee";

/**
 * The transaction form shared by Add and Edit: type, amount, category, payee,
 * payment method, date and description, with the category and payee choosers as
 * a panel over the same screen. The form underneath stays mounted, so nothing
 * typed is lost and the keyboard does not re-open when a chooser closes. The
 * caller owns the draft and every network call.
 */
export function TransactionEditor({
  title,
  draft,
  onChange,
  currency,
  editing = false,
  autoFocusAmount = false,
  amountRef,
  categories,
  payees,
  onPickPayee,
  onCreateCategory,
  onCreatePayee,
  errors,
  formError,
  primary,
  secondary,
}: {
  title: string;
  draft: TransactionDraft;
  onChange: (next: TransactionDraft) => void;
  currency: string;
  /** Editing an existing row: notes appear, and a starting balance shows only amount, date and notes. */
  editing?: boolean;
  autoFocusAmount?: boolean;
  amountRef?: Ref<TextInput>;
  categories: ChoiceList<PickedCategory>;
  payees: ChoiceList<{ id: string; name: string }>;
  onPickPayee: (payee: PickedPayee) => void;
  onCreateCategory: (name: string) => Promise<PickedCategory>;
  onCreatePayee: (name: string) => Promise<PickedPayee>;
  errors: DraftErrors;
  formError: string | null;
  primary: Action;
  secondary?: Action;
}) {
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const startingBalance = draft.type === "starting_balance";

  // Android back closes the open chooser first instead of leaving the screen.
  useEffect(() => {
    if (!picker) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setPicker(null);
      return true;
    });
    return () => subscription.remove();
  }, [picker]);

  const chooseCategory = (item: PickerItem) => {
    const category = categories.items.find((c) => c.id === item.id);
    if (category) onChange({ ...draft, category });
    setPicker(null);
  };

  const choosePayee = (item: PickerItem) => {
    onPickPayee({ id: item.id, name: item.label });
    setPicker(null);
  };

  return (
    <View style={styles.fill}>
      <View
        style={styles.fill}
        importantForAccessibility={picker ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={picker !== null}
      >
        <Screen title={title} back keyboard>
          {formError ? <Banner tone="error" message={formError} /> : null}

          {startingBalance ? (
            <Text tone="muted">Starting balance</Text>
          ) : (
            <Segmented
              options={TYPE_OPTIONS}
              value={draft.type === "income" ? "income" : "expense"}
              onChange={(type) => onChange(switchType(draft, type))}
            />
          )}

          <AmountInput
            ref={amountRef}
            value={draft.amount}
            onChange={(amount) => onChange({ ...draft, amount })}
            currency={currency}
            error={errors.amount}
            autoFocus={autoFocusAmount}
          />

          {startingBalance ? null : (
            <>
              <SelectField
                label="Category"
                value={draft.category?.name}
                placeholder="Choose a category"
                onPress={() => setPicker("category")}
                error={errors.category}
              />
              <SelectField
                label="Payee (optional)"
                value={draft.payee?.name}
                placeholder="Choose or add a payee"
                onPress={() => setPicker("payee")}
              />
              {draft.payee ? (
                <Button title="Remove payee" variant="link" onPress={() => onChange({ ...draft, payee: null })} />
              ) : null}
              <Chips
                label="Payment method (optional)"
                options={METHOD_OPTIONS}
                value={draft.method}
                onChange={(method) => onChange({ ...draft, method })}
              />
            </>
          )}

          <DateField label="Date" value={draft.date} onChange={(date) => onChange({ ...draft, date })} />
          {isOverAYearAgo(draft.date, todayLocal()) ? (
            <Text variant="caption" tone="muted">
              That date is more than a year ago. Check that it is right.
            </Text>
          ) : null}

          {startingBalance ? null : (
            <Input
              label="Description (optional)"
              value={draft.description}
              onChangeText={(description) => onChange({ ...draft, description })}
              maxLength={DESCRIPTION_MAX}
              returnKeyType="done"
            />
          )}
          {editing ? (
            <Input
              label="Notes (optional)"
              value={draft.notes}
              onChangeText={(notes) => onChange({ ...draft, notes })}
              maxLength={NOTES_MAX}
              multiline
            />
          ) : null}

          <Button title={primary.label} onPress={primary.onPress} disabled={primary.disabled} requiresNetwork />
          {secondary ? (
            <Button
              title={secondary.label}
              variant="secondary"
              onPress={secondary.onPress}
              disabled={secondary.disabled}
              requiresNetwork
            />
          ) : null}
        </Screen>
      </View>

      {picker ? (
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          {picker === "category" ? (
            <PickerList
              title="Category"
              searchLabel="Search or add a category"
              noun="category"
              emptyMessage="No categories yet."
              items={categories.items.map((c) => ({ id: c.id, label: c.name }))}
              loading={categories.loading}
              error={categories.error}
              onRetry={categories.onRetry}
              onSelect={chooseCategory}
              onClose={() => setPicker(null)}
              onCreate={async (name) => {
                const category = await onCreateCategory(name);
                onChange({ ...draft, category });
                setPicker(null);
              }}
            />
          ) : (
            <PickerList
              title="Payee"
              searchLabel="Search or add a payee"
              noun="payee"
              emptyMessage="No payees yet."
              items={payees.items.map((p) => ({ id: p.id, label: p.name }))}
              loading={payees.loading}
              error={payees.error}
              onRetry={payees.onRetry}
              onSelect={choosePayee}
              onClose={() => setPicker(null)}
              onCreate={async (name) => {
                onPickPayee(await onCreatePayee(name));
                setPicker(null);
              }}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
