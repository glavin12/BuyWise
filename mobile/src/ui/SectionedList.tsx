import type { ReactElement } from "react";
import { SectionList, StyleSheet } from "react-native";

import { theme } from "./theme";

/**
 * A virtualised list grouped into sections, with pull-to-refresh and
 * load-more. Screens with long collections use this (never a ScrollView full
 * of rows). `header` scrolls with the list, so filters live inside it.
 */
export function SectionedList<Section extends { data: readonly unknown[] }>({
  sections,
  keyExtractor,
  renderItem,
  renderSectionHeader,
  header,
  footer,
  empty,
  refreshing,
  onRefresh,
  onEndReached,
}: {
  sections: Section[];
  keyExtractor: (item: Section["data"][number]) => string;
  renderItem: (item: Section["data"][number]) => ReactElement;
  renderSectionHeader: (section: Section) => ReactElement;
  header?: ReactElement;
  footer?: ReactElement | null;
  empty?: ReactElement;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached?: () => void;
}) {
  return (
    <SectionList<Section["data"][number], Section>
      style={styles.list}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => renderItem(item)}
      renderSectionHeader={({ section }) => renderSectionHeader(section)}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={empty}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { flexGrow: 1, gap: theme.space.xs },
});
