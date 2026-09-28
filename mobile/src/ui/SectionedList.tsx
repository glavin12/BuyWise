import { useScrollToTop } from "expo-router";
import { useRef, type ReactElement } from "react";
import { RefreshControl, SectionList, StyleSheet } from "react-native";

import { theme } from "./theme";
import { colors, space } from "./tokens";

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
  v3,
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
  /** Design v3: 8 between cells and a light refresh spinner for the charcoal screen. */
  v3?: boolean;
}) {
  const ref = useRef<SectionList<Section["data"][number], Section>>(null);
  useScrollToTop(ref); // N7: tapping the tab you're on scrolls the list back to the top

  return (
    <SectionList<Section["data"][number], Section>
      ref={ref}
      style={styles.list}
      contentContainerStyle={[styles.content, v3 && styles.v3Content]}
      sections={sections}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => renderItem(item)}
      renderSectionHeader={({ section }) => renderSectionHeader(section)}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={empty}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={v3 ? colors.text : undefined}
          colors={v3 ? [colors.ink] : undefined}
          progressBackgroundColor={v3 ? colors.cream : undefined}
        />
      }
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
  v3Content: { gap: space.sm },
});
