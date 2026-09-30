import { Check, Flag, PenLine, PiggyBank, Tag } from "lucide-react-native";
import { useState } from "react";

import { currencySymbol } from "@/lib/home";
import { GOAL_DESCRIPTION_MAX, GOAL_TITLE_MAX, type GoalDraft, type GoalErrors } from "@/lib/goals";
import { GOAL_TYPE_LABEL, GOAL_TYPES, PRIORITY_LABEL } from "@/lib/labels";
import { sanitizeAmountInput } from "@/lib/money";
import type { Category, GoalPriority } from "@/lib/types";

import { EntryAmount } from "./AmountInput";
import { Banner } from "./Banner";
import { Note, SectionLabel } from "./Blocks";
import { PrimaryButton, SecondaryButton } from "./Buttons";
import { Chip } from "./Chips";
import { DateChip } from "./DateChip";
import { FieldButton, FieldInput } from "./Field";
import { Row, Stack } from "./Layout";
import { Overlaid, PickerList, type PickerItem } from "./PickerList";
import { SheetScreen } from "./SheetScreen";
import type { ChoiceList } from "./TransactionEditor";

const PRIORITIES = Object.keys(PRIORITY_LABEL) as GoalPriority[];

/**
 * The goal form shared by New and Edit, as a cream sheet in the QuickAdd look: name, target amount, amount
 * already saved, optional expense category, type, priority, optional target date and description. The caller
 * owns the draft and every network call, like TransactionEditor.
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
  categories: ChoiceList<Pick<Category, "id" | "name" | "color" | "icon">>;
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

  const overlay = pickingCategory ? (
    <PickerList
      title="Category"
      searchLabel="Search categories"
      noun="category"
      emptyMessage="No expense categories yet."
      items={categories.items.map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon }))}
      loading={categories.loading}
      error={categories.error}
      onRetry={categories.onRetry}
      onSelect={chooseCategory}
      onClose={() => setPickingCategory(false)}
    />
  ) : null;

  return (
    <Overlaid overlay={overlay}>
      <SheetScreen title={title}>
        {formError ? <Banner tone="error" surface="cream" message={formError} /> : null}

        <Stack gap="xs">
          <FieldInput
            icon={Flag}
            accessibilityLabel="Goal name"
            placeholder="Name your goal"
            value={draft.title}
            onChangeText={(text) => onChange({ ...draft, title: text })}
            maxLength={GOAL_TITLE_MAX}
            autoFocus={autoFocusTitle}
            returnKeyType="next"
          />
          {errors.title ? <Note tone="error">{errors.title}</Note> : null}
        </Stack>

        <Stack gap="xs">
          <SectionLabel label="Target amount" light />
          <EntryAmount value={draft.target} onChange={(target) => onChange({ ...draft, target })} symbol={currencySymbol(currency)} label="Target amount" />
          {errors.target ? <Note tone="error">{errors.target}</Note> : null}
        </Stack>

        <Stack gap="xs">
          <FieldInput
            icon={PiggyBank}
            accessibilityLabel={`${savedLabel} (optional)`}
            placeholder={`${savedLabel} (optional)`}
            value={draft.saved}
            onChangeText={(saved) => onChange({ ...draft, saved: sanitizeAmountInput(saved) })}
            keyboardType="decimal-pad"
            autoCorrect={false}
          />
          {errors.saved ? <Note tone="error">{errors.saved}</Note> : null}
        </Stack>

        <FieldButton
          icon={Tag}
          label="Category"
          value={categoryName}
          placeholder="Add a category (optional)"
          hint="category"
          onPress={() => setPickingCategory(true)}
          onClear={() => onChange({ ...draft, categoryId: null })}
        />

        <Stack gap="sm">
          <SectionLabel label="Type (optional)" light />
          <Row gap="xs" wrap>
            {GOAL_TYPES.map((type) => {
              const on = draft.type === type;
              // Tapping the chosen type again clears it: the type is optional.
              return <Chip key={type} label={GOAL_TYPE_LABEL[type]} variant={on ? "ink" : "outlined"} selected={on} onPress={() => onChange({ ...draft, type: on ? null : type })} />;
            })}
          </Row>
        </Stack>

        <Stack gap="sm">
          <SectionLabel label="Priority" light />
          <Row gap="xs" wrap>
            {PRIORITIES.map((priority) => {
              const on = draft.priority === priority;
              return <Chip key={priority} label={PRIORITY_LABEL[priority]} variant={on ? "ink" : "outlined"} selected={on} onPress={() => onChange({ ...draft, priority: on ? null : priority })} />;
            })}
          </Row>
        </Stack>

        <Stack gap="sm">
          <SectionLabel label="Target date (optional)" light />
          <Row gap="xs" wrap>
            <DateChip value={draft.date} emptyLabel="Pick a date" withYear onChange={(date) => onChange({ ...draft, date })} onClear={() => onChange({ ...draft, date: null })} />
          </Row>
        </Stack>

        <FieldInput
          grow
          icon={PenLine}
          accessibilityLabel="Description (optional)"
          placeholder="Add a description"
          value={draft.description}
          onChangeText={(description) => onChange({ ...draft, description })}
          maxLength={GOAL_DESCRIPTION_MAX}
        />

        <PrimaryButton label={primary.label} icon={Check} onPress={primary.onPress} disabled={primary.disabled} requiresNetwork />
        {danger ? <SecondaryButton label={danger.label} danger onPress={danger.onPress} requiresNetwork /> : null}
      </SheetScreen>
    </Overlaid>
  );
}
