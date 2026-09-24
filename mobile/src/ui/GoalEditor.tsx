import { GOAL_DESCRIPTION_MAX, GOAL_TITLE_MAX, type GoalDraft, type GoalErrors } from "@/lib/goals";
import { GOAL_TYPE_LABEL, GOAL_TYPES, PRIORITY_LABEL } from "@/lib/labels";
import type { GoalPriority } from "@/lib/types";

import { AmountInput } from "./AmountInput";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Chips } from "./Controls";
import { DateField } from "./DateField";
import { Input } from "./Input";
import { Screen } from "./Screen";

const TYPE_OPTIONS = GOAL_TYPES.map((type) => ({ label: GOAL_TYPE_LABEL[type], value: type }));
const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABEL) as GoalPriority[]).map((priority) => ({
  label: PRIORITY_LABEL[priority],
  value: priority,
}));

/**
 * The goal form shared by New and Edit: name, type, priority, target, amount
 * already saved, optional target date and description. The caller owns the draft
 * and every network call, like TransactionEditor.
 */
export function GoalEditor({
  title,
  draft,
  onChange,
  currency,
  savedLabel,
  autoFocusTitle = false,
  errors,
  formError,
  primary,
}: {
  title: string;
  draft: GoalDraft;
  onChange: (next: GoalDraft) => void;
  currency: string;
  /** "Starting amount" when creating, "Saved so far" when editing. */
  savedLabel: string;
  autoFocusTitle?: boolean;
  errors: GoalErrors;
  formError: string | null;
  primary: { label: string; onPress: () => Promise<unknown>; disabled?: boolean };
}) {
  return (
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
    </Screen>
  );
}
