import { Search } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { BackHandler, FlatList, StyleSheet, Text as RNText, View } from "react-native";

import { userMessage } from "@/lib/errors";
import { payeeInitial } from "@/lib/settings";

import { Banner } from "./Banner";
import { IconTile, Note } from "./Blocks";
import { SecondaryButton } from "./Buttons";
import { CategoryTile, categoryTone } from "./CategoryTile";
import { FieldInput } from "./Field";
import { PressableScale } from "./PressableScale";
import { SheetScreen } from "./SheetScreen";
import { Skeleton } from "./Skeleton";
import { ErrorState } from "./States";
import { colors, fonts, radius } from "./tokens";

/** `color` and `icon` are a category's own, for its tile. */
export type PickerItem = { id: string; label: string; color?: string | null; icon?: string | null };

/**
 * A form (a SheetScreen) with a chooser (a PickerList) opened over it. The form underneath stays mounted, so
 * nothing typed is lost and the keyboard does not re-open when the chooser closes; it is hidden
 * from screen readers while the chooser is up.
 */
export function Overlaid({ overlay, children }: { overlay: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.list}>
      <View style={styles.list} importantForAccessibility={overlay ? "no-hide-descendants" : "auto"} accessibilityElementsHidden={!!overlay}>
        {children}
      </View>
      {overlay ? (
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          {overlay}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A "choose one" list with search, drawn as a cream sheet over the form that opened it. Virtualised
 * (FlatList), so a long payee list stays cheap. With `onCreate`, a name that matches nothing exactly
 * offers to be created and chosen.
 */
export function PickerList({
  title,
  searchLabel,
  items,
  loading,
  error,
  onRetry,
  onSelect,
  onClose,
  noun,
  emptyMessage,
  onCreate,
}: {
  title: string;
  searchLabel: string;
  items: readonly PickerItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
  /** What is chosen: names the messages ("create this category") and picks the row's tile. */
  noun: "category" | "payee";
  emptyMessage: string;
  onCreate?: (name: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // N3: Android back closes the chooser first instead of leaving the screen under it.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  const name = query.trim();
  const needle = name.toLowerCase();
  const matches = needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items;
  const exists = items.some((item) => item.label.toLowerCase() === needle);
  const canCreate = !!onCreate && needle !== "" && !exists;

  const create = async () => {
    setCreateError(null);
    try {
      await onCreate?.(name);
    } catch (err) {
      setCreateError(userMessage(err, `create this ${noun}`));
    }
  };

  return (
    <SheetScreen title={title} onClose={onClose} scroll={false}>
      <FieldInput
        icon={Search}
        accessibilityLabel={searchLabel}
        placeholder={searchLabel}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
      />
      {createError ? <Banner tone="error" surface="cream" message={createError} /> : null}
      {canCreate ? <SecondaryButton label={`Create "${name}"`} requiresNetwork onPress={create} /> : null}

      {loading ? (
        [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} tone="sheet" height={56} round="row" />)
      ) : error ? (
        <ErrorState surface="cream" message={error} onRetry={onRetry} />
      ) : (
        <FlatList
          style={styles.list}
          data={matches}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <PressableScale onPress={() => onSelect(item)} accessibilityLabel={item.label} style={styles.row}>
              {noun === "category" ? (
                <CategoryTile name={item.label} color={item.color} icon={item.icon} />
              ) : (
                <IconTile icon={payeeInitial(item.label)} color={categoryTone(item.label)} />
              )}
              <RNText style={styles.label} numberOfLines={1}>
                {item.label}
              </RNText>
            </PressableScale>
          )}
          ListEmptyComponent={<Note tone="cream">{needle ? `Nothing matches "${name}".` : emptyMessage}</Note>}
        />
      )}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 6, borderRadius: radius.field },
  label: { flex: 1, fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.ink },
});
