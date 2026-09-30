import MarkdownDisplay, { type ASTNode, type MarkdownStyleMap, type RenderRules } from "@ronradtke/react-native-markdown-display";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text as RNText, View, type TextProps, type TextStyle } from "react-native";

import { prosePieces, type ProsePiece, type ProseRun } from "@/lib/chat";
import { currencySymbol } from "@/lib/home";

import { InlineChip } from "./Chips";
import { colors, extra, fonts, space, type } from "./tokens";

// The only file that imports the markdown library: if it breaks, only this file changes.
// The library's defaults already open links with Linking.openURL. The look is Chat.html's: mono
// prose (12 / 21), a bordered table with a muted header row, and amounts and percentages drawn as
// inline chips (lib/chat.ts `prosePieces` finds them, so old conversations get them too).

/** Long-press selects and copies (native, no clipboard dependency). */
function SelectableText(props: TextProps) {
  return <RNText selectable {...props} />;
}

const TABLE_RADIUS = 12; // Chat.html

const body = { color: extra.proseOnBubble, ...type.body };
// One style per mark: the library draws these, and so do the figure rows below.
const strong = { fontFamily: fonts.monoBold, fontWeight: "normal" } as const; // the bold file, not a faked weight on the regular one
const em = { fontStyle: "italic" } as const;
const strike = { textDecorationLine: "line-through" } as const;
const code = { fontFamily: fonts.monoMedium, color: colors.text, backgroundColor: extra.inlineDark } as const;
const MARK: Record<string, TextStyle> = { bold: strong, italic: em, strike, code };
const MARK_OF: Record<string, string | undefined> = { strong: "bold", em: "italic", s: "strike" };

const heading = { ...type.rowTitle, color: colors.text, marginBottom: space.xs };
const codeText = { fontFamily: fonts.mono, fontSize: 11, lineHeight: 17, color: colors.text };
// Fixed-basis cells keep the columns aligned; a table wider than the bubble scrolls sideways.
const cell = { flexGrow: 1, flexShrink: 0, flexBasis: 96, paddingHorizontal: space.md, paddingVertical: space.xs, ...codeText, lineHeight: 16 };

const style: MarkdownStyleMap = {
  body,
  paragraph: { marginTop: 0, marginBottom: space.sm },
  heading1: heading,
  heading2: heading,
  heading3: heading,
  strong,
  em,
  s: strike,
  link: { color: colors.sky, textDecorationLine: "underline" },
  code_inline: { ...code, borderWidth: 0, padding: 0 },
  code_block: { ...codeText, backgroundColor: extra.inlineDark, borderColor: colors.line, borderRadius: TABLE_RADIUS, padding: space.md, marginBottom: space.sm },
  fence: { borderColor: colors.line, borderRadius: TABLE_RADIUS, marginBottom: space.sm },
  fence_header: { backgroundColor: colors.card2, borderBottomColor: colors.line },
  fence_language_label: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
  fence_code: { backgroundColor: extra.inlineDark, padding: space.md },
  fence_token: codeText,
  blockquote: { backgroundColor: extra.inlineDark, borderColor: colors.line, borderLeftWidth: 3, marginLeft: 0, paddingHorizontal: space.md, marginBottom: space.sm },
  hr: { backgroundColor: colors.line, height: 1, marginBottom: space.sm },
  bullet_list_icon: { marginLeft: space.xxs, marginRight: space.sm, color: colors.muted },
  ordered_list_icon: { marginLeft: space.xxs, marginRight: space.sm, color: colors.muted },
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: TABLE_RADIUS, overflow: "hidden", marginBottom: space.sm },
  thead: { backgroundColor: extra.tableHead },
  tr: { borderBottomWidth: 0 },
  th: { ...cell, color: colors.muted },
  td: cell,
};

const styles = StyleSheet.create({
  // The last block's bottom margin would add to the bubble's own padding.
  trim: { marginBottom: -space.sm },
  scroll: { flexGrow: 1 },
  prose: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", width: "100%" },
  chipCell: { flexDirection: "row", alignItems: "center", height: type.body.lineHeight },
  lineBreak: { width: "100%", height: 0 },
});

/**
 * A paragraph with figure chips: a wrapping row of words and chips, laid out like RichText (React
 * Native cannot pad or round text nested in text).
 */
// ponytail: a row of single words selects word by word, not across the paragraph, and a group with a
// link or an image is left to the library (no chips there). A copy button (expo-clipboard) if
// copying a whole reply matters.
function Prose({ pieces }: { pieces: readonly ProsePiece[] }) {
  // Read as one sentence, not word by word.
  const spoken = pieces
    .map((p) => {
      if (p.kind === "break") return " ";
      return (p.kind === "word" ? p.text : `${p.lead}${p.text}${p.trail}`) + (p.space ? " " : "");
    })
    .join("")
    .trim();

  return (
    <View style={styles.prose} accessible accessibilityLabel={spoken}>
      {pieces.map((p, i) => {
        if (p.kind === "break") return <View key={i} style={styles.lineBreak} />;
        if (p.kind === "word") {
          return (
            <SelectableText key={i} style={[body, ...p.marks.map((m) => MARK[m])]}>
              {p.space ? `${p.text} ` : p.text}
            </SelectableText>
          );
        }
        const after = `${p.trail}${p.space ? " " : ""}`;
        return (
          <View key={i} style={styles.chipCell}>
            {p.lead ? <RNText style={body}>{p.lead}</RNText> : null}
            <InlineChip kind={p.chip} text={p.text} />
            {after ? <RNText style={body}>{after}</RNText> : null}
          </View>
        );
      })}
    </View>
  );
}

/** A text group's formatted runs, or null when it holds something else (a link, an image): the library keeps such a group. */
function runsOf(nodes: readonly ASTNode[], marks: readonly string[] = []): ProseRun[] | null {
  const runs: ProseRun[] = [];
  for (const node of nodes) {
    const mark = MARK_OF[node.type];
    if (node.type === "text") {
      runs.push({ text: node.content, marks });
    } else if (node.type === "softbreak" || node.type === "hardbreak") {
      runs.push({ text: "\n" });
    } else if (node.type === "code_inline") {
      runs.push({ text: node.content, marks: [...marks, "code"], plain: true }); // code is never chipped
    } else if (mark) {
      const inner = runsOf(node.children, [...marks, mark]);
      if (!inner) return null;
      runs.push(...inner);
    } else {
      return null;
    }
  }
  return runs;
}

const baseRules: RenderRules = {
  // The border stays put while a wide table scrolls inside it.
  table: (node, children, _parent, tableStyles) => (
    <View key={node.key} style={tableStyles._VIEW_SAFE_table}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.scroll}>{children}</View>
      </ScrollView>
    </View>
  ),
  // A line between the body's rows; the header row has the table's own border above it.
  tr: (node, children, parent, rowStyles) => (
    <View key={node.key} style={[rowStyles._VIEW_SAFE_tr, parent[0]?.type === "tbody" && { borderTopWidth: 1, borderColor: colors.line }]}>
      {children}
    </View>
  ),
};

function makeRules(symbols: readonly string[]): RenderRules {
  return {
    ...baseRules,
    textgroup: (node, children, parent, groupStyles) => {
      // Only prose gets chips: headings and table cells keep the library's own text, like code does.
      const host = parent[0]?.type;
      const runs = host === "paragraph" || host === "list_item" ? runsOf(node.children) : null;
      const pieces = runs && prosePieces(runs, symbols);
      if (!pieces) {
        return (
          <SelectableText key={node.key} style={groupStyles.textgroup}>
            {children}
          </SelectableText>
        );
      }
      return <Prose key={node.key} pieces={pieces} />;
    },
  };
}

/** An AI reply. Amounts in ₹ or the user's `currency`, and percentages, become inline chips (not in tables or code). */
export function Markdown({ children, currency = "INR" }: { children: string; currency?: string }) {
  // ₹ is what the AI falls back to, so it always chips, and so does the user's own symbol.
  const rules = useMemo(() => makeRules(["₹", currencySymbol(currency)]), [currency]);
  return (
    <View style={styles.trim}>
      <MarkdownDisplay style={style} rules={rules} textcomponent={SelectableText} colorScheme="dark">
        {children}
      </MarkdownDisplay>
    </View>
  );
}
