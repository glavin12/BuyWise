import { Check, User } from "lucide-react-native";

import { TYPE_LABEL } from "@/lib/labels";
import { PAYEE_NAME_MAX, type PayeeDraft, type PayeeErrors } from "@/lib/settings";

import { Banner } from "./Banner";
import { Note } from "./Blocks";
import { PrimaryButton, SecondaryButton } from "./Buttons";
import { Toggle } from "./Chips";
import { FieldInput } from "./Field";
import { Stack } from "./Layout";
import { SheetScreen } from "./SheetScreen";

const TYPE_OPTIONS = [
  { label: TYPE_LABEL.expense, value: "expense" as const },
  { label: TYPE_LABEL.income, value: "income" as const },
];

/**
 * The payee form shared by New and Edit, on the cream sheet QuickAdd uses: type and name. The API's
 * PayeeUpdate only takes a name, so the type is a line of text once the payee exists.
 */
export function PayeeEditor({
  title,
  draft,
  onChange,
  editing = false,
  autoFocusName = false,
  errors,
  formError,
  primary,
  danger,
}: {
  title: string;
  draft: PayeeDraft;
  onChange: (next: PayeeDraft) => void;
  editing?: boolean;
  autoFocusName?: boolean;
  errors: PayeeErrors;
  formError: string | null;
  primary: { onPress: () => Promise<unknown>; disabled?: boolean };
  /** Edit only: the Delete action, below Save. */
  danger?: { label: string; onPress: () => Promise<unknown>; disabled?: boolean };
}) {
  return (
    <SheetScreen title={title}>
      {formError ? <Banner tone="error" surface="cream" message={formError} /> : null}

      {editing ? (
        <Note tone="cream">{`${TYPE_LABEL[draft.type]} payee. The type can't be changed.`}</Note>
      ) : (
        <Toggle options={TYPE_OPTIONS} value={draft.type} onChange={(type) => onChange({ ...draft, type })} />
      )}

      <Stack gap="xs">
        <FieldInput
          icon={User}
          accessibilityLabel="Name"
          placeholder="Payee name"
          value={draft.name}
          onChangeText={(name) => onChange({ ...draft, name })}
          maxLength={PAYEE_NAME_MAX}
          autoFocus={autoFocusName}
          returnKeyType="done"
        />
        {errors.name ? <Note tone="error">{errors.name}</Note> : null}
      </Stack>

      <PrimaryButton label="Save" icon={Check} onPress={primary.onPress} disabled={primary.disabled} requiresNetwork />
      {danger ? <SecondaryButton label={danger.label} danger onPress={danger.onPress} disabled={danger.disabled} requiresNetwork /> : null}
    </SheetScreen>
  );
}
