import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { TYPE_LABEL } from "@/lib/labels";
import { CATEGORY_ICON_MAX, CATEGORY_NAME_MAX, type CategoryDraft, type CategoryErrors } from "@/lib/settings";
import { HUES, HUE_NAMES, type Hue } from "@/lib/categoryStyle";

import { Banner } from "./Banner";
import { Button } from "./Button";
import { Input } from "./Input";
import { Stack } from "./Layout";
import { Screen } from "./Screen";
import { Segmented } from "./Controls";
import { Text } from "./Text";
import { theme } from "./theme";

const TYPE_OPTIONS = [
  { label: TYPE_LABEL.expense, value: "expense" as const },
  { label: TYPE_LABEL.income, value: "income" as const },
];

const HUE_LABEL: Record<Hue, string> = {
  coral: "Coral",
  amber: "Amber",
  mint: "Mint",
  sky: "Sky",
  plum: "Plum",
  pink: "Pink",
  teal: "Teal",
  neutral: "Neutral",
};

/** Colour picker over the 8 Day-0 hues. Selected state is a border ring plus a
 * checkmark, never colour alone, and each swatch names its hue for a screen reader. */
function ColorSwatches({ value, onChange }: { value: Hue; onChange: (hue: Hue) => void }) {
  return (
    <Stack gap="xs">
      <Text variant="caption" tone="muted">
        Color
      </Text>
      <View style={styles.swatchRow} accessibilityRole="radiogroup">
        {HUE_NAMES.map((hue) => {
          const selected = hue === value;
          return (
            <Pressable
              key={hue}
              onPress={() => onChange(hue)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={HUE_LABEL[hue]}
              style={[styles.swatch, { backgroundColor: HUES[hue].bar }, selected && styles.swatchSelected]}
            >
              {selected ? <Ionicons name="checkmark" size={18} color={HUES[hue].fg} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Stack>
  );
}

/**
 * The category form shared by New and Edit: name, optional emoji icon, colour
 * and type. The caller owns the draft and every network call, like GoalEditor.
 */
export function CategoryEditor({
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
  draft: CategoryDraft;
  onChange: (next: CategoryDraft) => void;
  /** A category's type is fixed once created: shown as plain text instead of the picker. */
  editing?: boolean;
  autoFocusName?: boolean;
  errors: CategoryErrors;
  formError: string | null;
  primary: { label: string; onPress: () => Promise<unknown>; disabled?: boolean };
  /** Edit only: the Archive action, rendered below Save. */
  danger?: { label: string; onPress: () => Promise<unknown>; disabled?: boolean };
}) {
  return (
    <Screen title={title} back keyboard>
      {formError ? <Banner tone="error" message={formError} /> : null}

      <Input
        label="Name"
        value={draft.name}
        onChangeText={(name) => onChange({ ...draft, name })}
        maxLength={CATEGORY_NAME_MAX}
        autoFocus={autoFocusName}
        returnKeyType="done"
        error={errors.name}
      />

      <Input
        label="Icon (emoji, optional)"
        value={draft.icon}
        onChangeText={(icon) => onChange({ ...draft, icon })}
        maxLength={CATEGORY_ICON_MAX}
      />

      <ColorSwatches value={draft.hue} onChange={(hue) => onChange({ ...draft, hue })} />

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

const styles = StyleSheet.create({
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  swatch: {
    width: theme.minHit,
    height: theme.minHit,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchSelected: { borderColor: theme.color.text },
});
