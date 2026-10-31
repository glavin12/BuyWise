import { useMemo, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Note, Title } from "./Blocks";
import { CircleButton } from "./Buttons";
import { CategoryTile } from "./CategoryTile";
import { FieldInput } from "./Field";
import { Check, Search, X } from "./icons";
import { Row, Stack } from "./Layout";
import { PressableScale } from "./PressableScale";
import { colors, extra, fonts, radius, space, type } from "./tokens";

// `Sheet` is a cream bottom sheet (DESIGN.md §3: radius 34, 46×5 handle). `OptionSheet` is what a
// dropdown Pill opens: the choices, the current one ticked. The design draws only the pills, so
// the sheet borrows the QuickAdd sheet's cream and radius.

/** The 46×5 grabber at the top of a cream sheet. */
export function SheetHandle() {
  return <View style={styles.handle} />;
}

export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    // N3: Android back (onRequestClose) closes the sheet, not the screen under it.
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardAvoid}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]} accessibilityViewIsModal>
            <SheetHandle />
            <Row justify="between" align="center">
              <Stack grow>
                <Title size="cardTitle" tone="ink">
                  {title}
                </Title>
              </Stack>
              <CircleButton icon={X} variant="line" size={38} label="Close" onPress={onClose} />
            </Row>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export type OptionItem = {
  value: string;
  label: string;
  icon?: string | null;
  color?: string | null;
  tile?: ReactNode;
};

export type OptionGroup = {
  title?: string;
  options: OptionItem[];
};

export function OptionSheet({
  visible,
  title,
  groups,
  value,
  onSelect,
  onClose,
  searchable = false,
  searchPlaceholder = "Search...",
}: {
  visible: boolean;
  title: string;
  groups: OptionGroup[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handleSelect = (val: string) => {
    setQuery("");
    onSelect(val);
  };

  const q = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((opt) => opt.label.toLowerCase().includes(q)),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, q]);

  const hasAnyOptions = filteredGroups.some((g) => g.options.length > 0);

  return (
    <Sheet visible={visible} title={title} onClose={handleClose}>
      {searchable ? (
        <FieldInput
          icon={Search}
          accessibilityLabel={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
      ) : null}

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!hasAnyOptions ? (
          <View style={styles.empty}>
            <Note tone="cream">{q ? `Nothing matches "${query.trim()}".` : "No options available."}</Note>
          </View>
        ) : (
          filteredGroups.map((group, i) => (
            <View key={group.title ?? i} style={styles.groupContainer}>
              {group.title ? <RNText style={styles.group}>{group.title}</RNText> : null}
              {group.options.map((option) => {
                const selected = option.value === value;
                const hasTile = option.tile !== undefined || option.icon !== undefined || option.color !== undefined;
                return (
                  <PressableScale
                    key={option.value}
                    onPress={() => handleSelect(option.value)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected }}
                    style={[styles.option, selected && styles.optionOn]}
                  >
                    {option.tile ? (
                      option.tile
                    ) : option.icon !== undefined || option.color !== undefined ? (
                      <CategoryTile name={option.label} color={option.color} icon={option.icon} size={44} />
                    ) : null}
                    <RNText
                      style={[
                        styles.label,
                        hasTile && styles.labelWithTile,
                        selected && styles.labelSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </RNText>
                    {selected ? (
                      <View style={styles.badge}>
                        <Check size={13} color={colors.cream} strokeWidth={3} />
                      </View>
                    ) : null}
                  </PressableScale>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: extra.scrim },
  keyboardAvoid: { width: "100%", justifyContent: "flex-end" },
  sheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: space.contentMax, // centred in the readable column on a tablet instead of spanning it
    maxHeight: "82%",
    gap: 12,
    paddingTop: 12,
    paddingHorizontal: 18,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.cream,
  },
  handle: { alignSelf: "center", width: 46, height: 5, borderRadius: radius.pill, backgroundColor: extra.handle, marginBottom: 4 },
  list: { flexGrow: 0 },
  groupContainer: { marginBottom: 4 },
  group: { ...type.label, color: extra.mutedOnCream, marginTop: 8, marginBottom: 6, marginLeft: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.field,
    marginBottom: 4,
  },
  optionOn: { backgroundColor: colors.creamField },
  label: { flex: 1, fontFamily: fonts.monoMedium, fontSize: 14, color: colors.ink },
  labelWithTile: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 0.2, textTransform: "uppercase" },
  labelSelected: { color: colors.ink },
  badge: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { paddingVertical: 24, alignItems: "center" },
});
