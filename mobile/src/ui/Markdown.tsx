import MarkdownDisplay, { type MarkdownStyleMap, type RenderRules } from "@ronradtke/react-native-markdown-display";
import { ScrollView, Text as RNText, View, type TextProps } from "react-native";

import { theme } from "./theme";

// The only file that imports the markdown library: if it breaks, only this file changes.
// The library's defaults already open links with Linking.openURL.

/** Long-press selects and copies (native, no clipboard dependency). */
function SelectableText(props: TextProps) {
  return <RNText selectable {...props} />;
}

const cell = { flexGrow: 1, flexShrink: 0, flexBasis: 128, padding: theme.space.sm };

const style: MarkdownStyleMap = {
  body: { color: theme.color.text, ...theme.type.body },
  paragraph: { marginTop: 0, marginBottom: theme.space.sm },
  heading1: { ...theme.type.heading, marginBottom: theme.space.xs },
  heading2: { ...theme.type.heading, marginBottom: theme.space.xs },
  heading3: { ...theme.type.heading, marginBottom: theme.space.xs },
  link: { color: theme.color.accent },
  code_inline: { fontFamily: theme.font.mono, backgroundColor: theme.color.surfaceMuted, borderWidth: 0, paddingHorizontal: theme.space.xs, paddingVertical: 0 },
  code_block: { fontFamily: theme.font.mono, backgroundColor: theme.color.surfaceMuted, borderColor: theme.color.border },
  fence: { fontFamily: theme.font.mono, borderColor: theme.color.border, marginBottom: theme.space.sm },
  table: { flexGrow: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm },
  tr: { borderColor: theme.color.border },
  th: { ...cell, fontFamily: theme.font.sansSemiBold },
  // Bold comes from the semibold file, not a faked weight on the regular one.
  strong: { fontFamily: theme.font.sansSemiBold, fontWeight: "normal" },
  td: cell,
};

const rules: RenderRules = {
  // Wide tables scroll sideways inside the bubble; fixed-basis cells keep the columns aligned.
  table: (node, children, _parent, styles) => (
    <ScrollView key={node.key} horizontal contentContainerStyle={{ flexGrow: 1, marginBottom: theme.space.sm }}>
      <View style={styles._VIEW_SAFE_table}>{children}</View>
    </ScrollView>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <MarkdownDisplay style={style} rules={rules} textcomponent={SelectableText}>
      {children}
    </MarkdownDisplay>
  );
}
