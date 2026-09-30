import { Check, PenLine, type LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { HUES, HUE_NAMES, type Hue as CategoryHue } from "@/lib/categoryStyle";
import { TYPE_LABEL } from "@/lib/labels";
import { CATEGORY_NAME_MAX, pickIcon, type CategoryDraft, type CategoryErrors } from "@/lib/settings";

import { Banner } from "./Banner";
import { IconTile, Note, SectionLabel } from "./Blocks";
import { PrimaryButton, SecondaryButton } from "./Buttons";
import { CATEGORY_GLYPHS, CategoryTile, categoryTone } from "./CategoryTile";
import { Toggle, type Hue } from "./Chips";
import { FieldInput } from "./Field";
import { Row, Stack } from "./Layout";
import { PressableScale } from "./PressableScale";
import { SheetScreen } from "./SheetScreen";
import { colors, radius } from "./tokens";

const TYPE_OPTIONS = [
  { label: TYPE_LABEL.expense, value: "expense" as const },
  { label: TYPE_LABEL.income, value: "income" as const },
];

const HUE_LABEL: Record<CategoryHue, string> = {
  coral: "Coral",
  amber: "Amber",
  mint: "Mint",
  sky: "Sky",
  plum: "Plum",
  pink: "Pink",
  teal: "Teal",
  neutral: "Neutral",
};

const GLYPH_COLUMNS = 6;

/** One of the 8 hues, drawn in the v3 colour a tile of it gets. Chosen: an ink ring and a ✓, so it is never colour alone. */
function Swatch({ hue, selected, onPress }: { hue: CategoryHue; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="radio"
      accessibilityLabel={HUE_LABEL[hue]}
      accessibilityState={{ selected, checked: selected }}
      style={[styles.swatch, { backgroundColor: colors[categoryTone(null, HUES[hue].bar)] }, selected && styles.swatchOn]}
    >
      {selected ? <Check size={16} color={colors.ink} strokeWidth={3} /> : null}
    </PressableScale>
  );
}

/** One glyph of the icon picker, on a tile in the chosen colour. Chosen: an ink ring and a ✓ badge, as QuickAdd's category tiles. */
function GlyphChoice({ name, glyph, tone, selected, onPress }: { name: string; glyph: LucideIcon; tone: Hue; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={name.replace(/-/g, " ")}
      accessibilityState={{ selected, checked: selected }}
      style={styles.cell}
    >
      <View>
        <IconTile icon={glyph} color={tone} size={44} />
        {selected ? (
          <>
            <View style={styles.ring} />
            <View style={styles.badge}>
              <Check size={11} color={colors.cream} strokeWidth={3} />
            </View>
          </>
        ) : null}
      </View>
    </PressableScale>
  );
}

/**
 * The category form shared by New and Edit, on the cream sheet QuickAdd uses: type, name (with the tile
 * as it will look), colour and icon. The caller owns the draft and every network call, like GoalEditor.
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
  /** A category's type is fixed once created: shown as a line of text instead of the toggle. */
  editing?: boolean;
  autoFocusName?: boolean;
  errors: CategoryErrors;
  formError: string | null;
  primary: { onPress: () => Promise<unknown>; disabled?: boolean };
  /** Edit only: the Archive action, below Save. */
  danger?: { label: string; onPress: () => Promise<unknown>; disabled?: boolean };
}) {
  const tone = categoryTone(null, HUES[draft.hue].bar);
  return (
    <SheetScreen title={title}>
      {formError ? <Banner tone="error" surface="cream" message={formError} /> : null}

      {editing ? (
        <Note tone="cream">{`${TYPE_LABEL[draft.type]} category. The type can't be changed.`}</Note>
      ) : (
        <Toggle options={TYPE_OPTIONS} value={draft.type} onChange={(type) => onChange({ ...draft, type })} />
      )}

      <Stack gap="xs">
        <Row>
          <CategoryTile name={draft.name.trim() || "Category"} color={HUES[draft.hue].bar} icon={draft.icon || null} size={58} />
          <Stack grow>
            <FieldInput
              icon={PenLine}
              accessibilityLabel="Name"
              placeholder="Category name"
              value={draft.name}
              onChangeText={(name) => onChange({ ...draft, name })}
              maxLength={CATEGORY_NAME_MAX}
              autoFocus={autoFocusName}
              returnKeyType="done"
            />
          </Stack>
        </Row>
        {errors.name ? <Note tone="error">{errors.name}</Note> : null}
      </Stack>

      <Stack gap="sm">
        <SectionLabel label="Color" light />
        <Row justify="between" accessibilityRole="radiogroup">
          {HUE_NAMES.map((hue) => (
            <Swatch key={hue} hue={hue} selected={hue === draft.hue} onPress={() => onChange({ ...draft, hue })} />
          ))}
        </Row>
      </Stack>

      <Stack gap="sm">
        <SectionLabel label="Icon" light />
        <View style={styles.grid} accessibilityRole="radiogroup">
          {CATEGORY_GLYPHS.map(({ key, glyph }) => (
            <GlyphChoice
              key={key}
              name={key}
              glyph={glyph}
              tone={tone}
              selected={key === draft.icon}
              onPress={() => onChange({ ...draft, icon: pickIcon(draft.icon, key) })}
            />
          ))}
        </View>
      </Stack>

      <PrimaryButton label="Save" icon={Check} onPress={primary.onPress} disabled={primary.disabled} requiresNetwork />
      {danger ? <SecondaryButton label={danger.label} danger onPress={danger.onPress} disabled={danger.disabled} requiresNetwork /> : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 2.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  swatchOn: { borderColor: colors.ink },
  // Six to a row whatever the width: every cell is a sixth, its tile centred in it.
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  cell: { width: `${100 / GLYPH_COLUMNS}%`, alignItems: "center" },
  ring: { ...StyleSheet.absoluteFill, borderRadius: radius.tile, borderWidth: 2.5, borderColor: colors.ink },
  badge: {
    position: "absolute",
    right: -5,
    top: -5,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
