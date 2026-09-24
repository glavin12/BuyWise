import MarkdownDisplay, { type MarkdownStyleMap, type RenderRules } from "@ronradtke/react-native-markdown-display";
import { ScrollView, Text as RNText, View, type TextProps } from "react-native";

import { theme } from "./theme";

// The only file that imports the markdown library: if it breaks, only this file changes.
// The library's defaults already open links with Linking.openURL and set code in a monospace font.

/** Long-press selects and copies (native, no clipboard dependency). */
function SelectableText(props: TextProps) {
  return <RNText selectable {...props} />;
}

const cell = { flexGrow: 1, flexShrink: 0, flexBasis: 128, padding: theme.space.sm };

const style: MarkdownStyleMap = {
  body: { color: theme.color.text, fontSize: theme.type.body.fontSize, lineHeight: theme.type.body.lineHeight },
  paragraph: { marginTop: 0, marginBottom: theme.space.sm },
  heading1: { fontSize: theme.type.heading.fontSize, fontWeight: "600", marginBottom: theme.space.xs },
  heading2: { fontSize: theme.type.heading.fontSize, fontWeight: "600", marginBottom: theme.space.xs },
  heading3: { fontSize: theme.type.heading.fontSize, fontWeight: "600", marginBottom: theme.space.xs },
  link: { color: theme.color.accent },
  code_inline: { backgroundColor: theme.color.surfaceMuted, borderWidth: 0, paddingHorizontal: theme.space.xs, paddingVertical: 0 },
  code_block: { backgroundColor: theme.color.surfaceMuted, borderColor: theme.color.border },
  fence: { borderColor: theme.color.border, marginBottom: theme.space.sm },
  table: { flexGrow: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm },
  tr: { borderColor: theme.color.border },
  th: { ...cell, fontWeight: "600" },
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
