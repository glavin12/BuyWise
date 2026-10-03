import { Check } from "lucide-react-native";
import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Title } from "./Blocks";
import { colors, extra, fonts, radius, space, type } from "./tokens";

// `Sheet` is a cream bottom sheet (DESIGN.md §3: radius 34, 46×5 handle). `OptionSheet` is what a
// dropdown Pill opens: the choices, the current one ticked. The design draws only the pills, so
// the sheet borrows the QuickAdd sheet's cream and radius.

/** The 46×5 grabber at the top of a cream sheet. */
export function SheetHandle() {
  return <View style={styles.handle} />;
}

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    // N3: Android back (onRequestClose) closes the sheet, not the screen under it.
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]} accessibilityViewIsModal>
          <SheetHandle />
          <Title size="cardTitle" tone="ink">
            {title}
          </Title>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export type OptionGroup = { title?: string; options: { value: string; label: string }[] };

export function OptionSheet({
  visible,
  title,
  groups,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  groups: OptionGroup[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <ScrollView style={styles.list}>
        {groups.map((group, i) => (
          <View key={group.title ?? i}>
            {group.title ? <RNText style={styles.group}>{group.title}</RNText> : null}
            {group.options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [styles.option, (selected || pressed) && styles.optionOn]}
                >
                  <RNText style={styles.label} numberOfLines={1}>
                    {option.label}
                  </RNText>
                  {selected && <Check size={16} color={colors.ink} strokeWidth={2.6} />}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: extra.scrim },
  sheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: space.contentMax, // centred in the readable column on a tablet instead of spanning it
    maxHeight: "75%",
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 18,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.cream,
  },
  handle: { alignSelf: "center", width: 46, height: 5, borderRadius: radius.pill, backgroundColor: extra.handle, marginBottom: 6 },
  list: { flexGrow: 0 },
  group: { ...type.label, color: extra.mutedOnCream, marginTop: 10, marginBottom: 4, marginLeft: 14 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.field,
  },
  optionOn: { backgroundColor: colors.creamField },
  label: { flex: 1, fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.ink },
});
