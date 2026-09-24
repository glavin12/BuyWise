import { useState } from "react";
import { FlatList, Pressable, StyleSheet } from "react-native";

import { userMessage } from "@/lib/errors";

import { Banner } from "./Banner";
import { Button } from "./Button";
import { Input } from "./Input";
import { Stack } from "./Layout";
import { Screen } from "./Screen";
import { Skeleton } from "./Skeleton";
import { ErrorState } from "./States";
import { Text } from "./Text";
import { theme } from "./theme";

export type PickerItem = { id: string; label: string };

/**
 * A full-screen "choose one" list with search. Virtualised (FlatList), so a long
 * payee list stays cheap. With `onCreate`, a name that matches nothing exactly
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
  /** Singular, for messages: "create this category". */
  noun: string;
  emptyMessage: string;
  onCreate?: (name: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

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
    <Screen title={title} back onBack={onClose} scroll={false} keyboard>
      <Input
        label={searchLabel}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
      />
      {createError ? <Banner tone="error" message={createError} /> : null}
      {canCreate ? <Button title={`Create "${name}"`} variant="secondary" requiresNetwork onPress={create} /> : null}

      {loading ? (
        <Stack>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={theme.minHit} />
          ))}
        </Stack>
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <FlatList
          style={styles.list}
          data={matches}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text numberOfLines={1}>{item.label}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text tone="muted" align="center">
              {needle ? `Nothing matches "${name}".` : emptyMessage}
            </Text>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  row: {
    minHeight: theme.minHit,
    justifyContent: "center",
    paddingHorizontal: theme.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  pressed: { opacity: 0.6 },
});
