import { TYPE_LABEL } from "@/lib/labels";
import { PAYEE_NAME_MAX, type PayeeDraft, type PayeeErrors } from "@/lib/settings";

import { Banner } from "./Banner";
import { Button } from "./Button";
import { Input } from "./Input";
import { Stack } from "./Layout";
import { Screen } from "./Screen";
import { Segmented } from "./Controls";
import { Text } from "./Text";

const TYPE_OPTIONS = [
  { label: TYPE_LABEL.expense, value: "expense" as const },
  { label: TYPE_LABEL.income, value: "income" as const },
];

/**
 * The payee form shared by New and Edit: name and type. The API's PayeeUpdate
 * only takes a name, so the type picker locks once the payee exists.
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
  primary: { label: string; onPress: () => Promise<unknown>; disabled?: boolean };
  /** Edit only: the Delete action, rendered below Save. */
  danger?: { label: string; onPress: () => Promise<unknown>; disabled?: boolean };
}) {
  return (
    <Screen title={title} back keyboard>
      {formError ? <Banner tone="error" message={formError} /> : null}

      <Input
        label="Name"
        value={draft.name}
        onChangeText={(name) => onChange({ ...draft, name })}
        maxLength={PAYEE_NAME_MAX}
        autoFocus={autoFocusName}
        returnKeyType="done"
        error={errors.name}
      />

      <Stack gap="xs">
        <Text variant="caption" tone="muted">
          Type
        </Text>
        {editing ? (
          <Text>{TYPE_LABEL[draft.type]}</Text>
        ) : (
          <Segmented options={TYPE_OPTIONS} value={draft.type} onChange={(type) => onChange({ ...draft, type })} />
        )}
      </Stack>

      <Button title={primary.label} onPress={primary.onPress} disabled={primary.disabled} requiresNetwork />
      {danger ? <Button title={danger.label} variant="danger" onPress={danger.onPress} disabled={danger.disabled} requiresNetwork /> : null}
    </Screen>
  );
}
