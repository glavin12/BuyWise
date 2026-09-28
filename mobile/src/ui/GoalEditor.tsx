import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { GOAL_DESCRIPTION_MAX, GOAL_TITLE_MAX, type GoalDraft, type GoalErrors } from "@/lib/goals";
import { GOAL_TYPE_LABEL, GOAL_TYPES, PRIORITY_LABEL } from "@/lib/labels";
import type { GoalPriority } from "@/lib/types";

import { AmountInput } from "./AmountInput";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Chips } from "./Controls";
import { DateField } from "./DateField";
import { Input } from "./Input";
import { PickerList, type PickerItem } from "./PickerList";
import { Screen } from "./Screen";
import { SelectField } from "./SelectField";
import type { ChoiceList } from "./TransactionEditor";

const TYPE_OPTIONS = GOAL_TYPES.map((type) => ({ label: GOAL_TYPE_LABEL[type], value: type }));
const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABEL) as GoalPriority[]).map((priority) => ({
  label: PRIORITY_LABEL[priority],
  value: priority,
}));

/**
 * The goal form shared by New and Edit: name, type, priority, target, amount
 * already saved, optional expense category, optional target date and
 * description. The caller owns the draft and every network call, like
 * TransactionEditor.
 */
export function GoalEditor({
  title,
  draft,
  onChange,
  currency,
  savedLabel,
  autoFocusTitle = false,
  categories,
  categoryFallback = null,
  errors,
  formError,
  primary,
  danger,
}: {
  title: string;
  draft: GoalDraft;
  onChange: (next: GoalDraft) => void;
  currency: string;
  /** "Starting amount" when creating, "Saved so far" when editing. */
  savedLabel: string;
  autoFocusTitle?: boolean;
  categories: ChoiceList<{ id: string; name: string }>;
  /** The goal's saved category, kept only for its name in case it has since been archived (dropped from `categories`). */
  categoryFallback?: { id: string; name: string } | null;
  errors: GoalErrors;
  formError: string | null;
  primary: { label: string; onPress: () => Promise<unknown>; disabled?: boolean };
  /** A destructive action under the save button (Edit: "Archive goal"). */
  danger?: { label: string; onPress: () => Promise<unknown> };
}) {
  const [pickingCategory, setPickingCategory] = useState(false);
  const categoryName =
    draft.categoryId === null
      ? null
      : (categories.items.find((c) => c.id === draft.categoryId) ??
          (categoryFallback?.id === draft.categoryId ? categoryFallback : null))?.name ?? null;

  const chooseCategory = (item: PickerItem) => {
    onChange({ ...draft, categoryId: item.id });
    setPickingCategory(false);
  };

  return (
    <View style={styles.fill}>
      <View
        style={styles.fill}
        importantForAccessibility={pickingCategory ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={pickingCategory}
      >
        <Screen title={title} back keyboard>
          {formError ? <Banner tone="error" message={formError} /> : null}

          <Input
            label="Goal name"
            value={draft.title}
            onChangeText={(text) => onChange({ ...draft, title: text })}
            maxLength={GOAL_TITLE_MAX}
            autoFocus={autoFocusTitle}
            returnKeyType="next"
            error={errors.title}
          />

          <AmountInput
            label={`Target amount (${currency})`}
            value={draft.target}
            onChange={(target) => onChange({ ...draft, target })}
            currency={currency}
            error={errors.target}
          />

          <AmountInput
            label={`${savedLabel} (${currency}, optional)`}
            value={draft.saved}
            onChange={(saved) => onChange({ ...draft, saved })}
            currency={currency}
            error={errors.saved}
          />

          <SelectField
            label="Category (optional)"
            value={categoryName}
            placeholder="Choose a category"
            onPress={() => setPickingCategory(true)}
          />
          {draft.categoryId ? (
            <Button title="Remove category" variant="link" onPress={() => onChange({ ...draft, categoryId: null })} />
          ) : null}

          <Chips
            label="Type (optional)"
            options={TYPE_OPTIONS}
            value={draft.type}
            onChange={(type) => onChange({ ...draft, type })}
          />

          <Chips
            label="Priority"
            options={PRIORITY_OPTIONS}
            value={draft.priority}
            onChange={(priority) => onChange({ ...draft, priority })}
          />

          <DateField
            label="Target date (optional)"
            value={draft.date}
            onChange={(date) => onChange({ ...draft, date })}
            onClear={() => onChange({ ...draft, date: null })}
          />

          <Input
            label="Description (optional)"
            value={draft.description}
            onChangeText={(description) => onChange({ ...draft, description })}
            maxLength={GOAL_DESCRIPTION_MAX}
            multiline
          />

          <Button title={primary.label} onPress={primary.onPress} disabled={primary.disabled} requiresNetwork />
          {danger ? <Button title={danger.label} variant="danger" onPress={danger.onPress} requiresNetwork /> : null}
        </Screen>
      </View>

      {pickingCategory ? (
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          <PickerList
            title="Category"
            searchLabel="Search categories"
            noun="category"
            emptyMessage="No expense categories yet."
            items={categories.items.map((c) => ({ id: c.id, label: c.name }))}
            loading={categories.loading}
            error={categories.error}
            onRetry={categories.onRetry}
            onSelect={chooseCategory}
            onClose={() => setPickingCategory(false)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
