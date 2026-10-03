import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChartColumn,
  ChartPie,
  ChevronDown,
  ChevronUp,
  History,
  Lightbulb,
  List,
  PenLine,
  Sparkles,
  Target,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FlatList, ScrollView, StyleSheet, Text as RNText, TextInput, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { isNotFound, userMessage } from "@/lib/api";
import { clockTime, firstSuggestionOverride, greeting, newIdempotencyKey, toolSummary, visibleMessages } from "@/lib/chat";
import { FLAGS, readFlag, writeFlag } from "@/lib/flags";
import { usePendingChatIds, useSendMessage, type SendVars } from "@/lib/mutations";
import { useOnline } from "@/lib/network";
import { dashboardQuery, messagesQuery, profileQuery, recentTransactionsQuery } from "@/lib/queries";
import { escapeRich } from "@/lib/richText";
import type { ChatResponse, Message, ToolCall } from "@/lib/types";

import { AiConsent } from "./AiConsent";
import { Banner } from "./Banner";
import { Note, Panel, Title } from "./Blocks";
import { CircleButton } from "./Buttons";
import { ChatInput } from "./ChatInput";
import { Chip, RichText } from "./Chips";
import { Illustration } from "./Illustration";
import { Row, Stack } from "./Layout";
import { Markdown } from "./Markdown";
import { PressableScale } from "./PressableScale";
import { Screen } from "./Screen";
import { Skeleton } from "./Skeleton";
import { ErrorState, NotFoundScreen } from "./States";
import { colors, extra, fonts, motion, radius, space, type } from "./tokens";

// AI chat (design/screens/07-ai-chat.png, values from design/reference-html/Chat.html): back, the
// two-line "MONEY BUDDY" title and History; AI replies in card bubbles with the coin buddy, the
// user's messages as mint pills, a tool pill that opens to the raw call, composing dots, and the
// composer. A new chat opens on a phone-side greeting (never saved or sent to the AI) with today's
// suggestions as quick-reply pills. Tool pills and "view reasoning" show only on the reply that
// just arrived: history does not store them.

const SUGGESTIONS: { text: string; icon: LucideIcon }[] = [
  { text: "What's my current balance?", icon: Wallet },
  { text: "Show my recent transactions", icon: List },
  { text: "How much did I spend on Food this month?", icon: Utensils },
  { text: "How are my goals tracking?", icon: Target },
];

// #21: pinned above the composer of a new chat. A tap fills the draft; it never sends.
const PREFILL_CHIPS: { label: string; icon: LucideIcon; text: string }[] = [
  { label: "Log expense", icon: PenLine, text: "Log an expense: " },
  { label: "Compare months", icon: ChartColumn, text: "Compare this month with last month" },
  { label: "Fund a goal", icon: Target, text: "Add money to my goal: " },
  { label: "Spending by category", icon: ChartPie, text: "Show my spending by category this month" },
];

/**
 * A chat thread: the new chat on the Chat tab (no id until the first reply) or an existing
 * conversation. `onNew` is the + beside the input.
 */
export function ChatThread({
  conversationId,
  tab = false,
  onBack,
  onHistory,
  onNew,
}: {
  conversationId?: string;
  /** The Chat tab: content clears the floating tab bar. A stack screen keeps the bottom inset instead. */
  tab?: boolean;
  onBack: () => void;
  /** Opens History. Left out on a thread opened from History, whose back already goes there. */
  onHistory?: () => void;
  onNew: () => void;
}) {
  const [startedId, setStartedId] = useState<string>();
  const id = conversationId ?? startedId;
  const history = useQuery({ ...messagesQuery(id ?? ""), enabled: !!id });
  const profile = useQuery(profileQuery);
  const send = useSendMessage();
  const pendingElsewhere = usePendingChatIds().includes(id ?? ""); // sent from this thread before the user left and came back
  const online = useOnline();
  const [draft, setDraft] = useState("");
  // A message waiting on the first-use AI consent sheet; it is sent when the user agrees.
  const [consentFor, setConsentFor] = useState<string | null>(null);
  const list = useRef<FlatList<Message>>(null);
  const input = useRef<TextInput>(null);

  // #8: cache-only reads (enabled: false), so this never fires a network call of its own.
  const recent = useQuery({ ...recentTransactionsQuery, enabled: false });
  const dashboard = useQuery({ ...dashboardQuery("this_month"), enabled: false });
  const firstSuggestion = firstSuggestionOverride(
    recent.data && recent.data.transactions.length > 0,
    dashboard.data?.has_budget
  );
  const suggestions = firstSuggestion ? [{ text: firstSuggestion, icon: Sparkles }, ...SUGGESTIONS.slice(1)] : SUGGESTIONS;

  if (id && isNotFound(history.error)) return <NotFoundScreen title="Chat" what="Conversation" />;

  const currency = profile.data?.currency ?? "INR";
  const busy = send.isPending || pendingElsewhere;
  const vars = send.variables;
  const rows = visibleMessages(history.data?.messages ?? []);
  // A new chat has no cache until its first reply, so that message is drawn here meanwhile.
  const unsent = vars && !vars.conversationId && !send.isSuccess ? vars.message : null;
  const last = rows[rows.length - 1];
  const liveId = send.isSuccess && last?.role === "assistant" ? last.id : undefined;
  const loading = !!id && history.isPending;
  const failed = history.isError && !history.data;
  // A new, empty chat: the greeting, the quick replies and the prefill chips.
  const fresh = rows.length === 0 && !unsent && !loading && !failed;

  // The same key on retry: the server replays a finished send and reruns a failed one.
  const run = (next: SendVars) => send.mutate(next, { onSuccess: (response) => setStartedId(response.conversation_id) });

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || busy || !online) return false;
    if (!readFlag(FLAGS.aiConsent)) {
      setConsentFor(message); // false keeps typed text in the box until the user has agreed
      return false;
    }
    run({ message, conversationId: id, idempotencyKey: newIdempotencyKey() });
    return true;
  };

  const agree = () => {
    writeFlag(FLAGS.aiConsent);
    const message = consentFor;
    setConsentFor(null);
    if (message && submit(message)) setDraft((current) => (current.trim() === message ? "" : current));
  };

  const empty = loading ? (
    <View style={styles.stack}>
      <Skeleton tone="dark" height={92} round="card" />
      <Row justify="end">
        <Skeleton tone="dark" width="55%" height={38} round="pill" />
      </Row>
      <Skeleton tone="dark" height={132} round="card" />
    </View>
  ) : failed ? (
    <View>
      <ErrorState message={userMessage(history.error, "load this conversation")} onRetry={() => history.refetch()} />
    </View>
  ) : fresh ? (
    <View style={styles.welcome}>
      <AiBubble time={clockTime(new Date())}>
        <RichText tone="card">{escapeRich(greeting(profile.data?.full_name))}</RichText>
      </AiBubble>
      <View style={styles.quickReplies}>
        {suggestions.map((s, i) => (
          <QuickReply key={s.text} text={s.text} icon={s.icon} tone={i % 2 === 0 ? "mint" : "forest"} disabled={busy || !online} onPress={() => submit(s.text)} />
        ))}
      </View>
    </View>
  ) : null;

  const footer = (
    <View style={styles.footer}>
      {unsent ? <UserPill text={unsent} /> : null}
      {busy ? <Composing /> : null}
      {send.isError && vars ? (
        <PressableScale onPress={() => run(vars)} disabled={!online} style={styles.retry}>
          <RNText style={styles.retryText}>{`${userMessage(send.error, "send this message")} Tap to retry.`}</RNText>
        </PressableScale>
      ) : null}
      <RNText style={styles.disclaimer}>BuyWise AI can make mistakes. Verify important financial information.</RNText>
    </View>
  );

  return (
    <>
      <Screen surface="screen" keyboard scroll={false} tabBar={tab}>
        <Row align="start">
          <CircleButton icon={ArrowLeft} label="Go back" onPress={onBack} />
          <Stack grow>
            <Title>{"Money\nBuddy"}</Title>
          </Stack>
          {onHistory ? <CircleButton icon={History} label="Past conversations" onPress={onHistory} /> : null}
        </Row>
        <FlatList
          ref={list}
          style={styles.list}
          contentContainerStyle={styles.content}
          data={rows}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble message={item} live={item.id === liveId ? send.data : undefined} currency={currency} />}
          ListHeaderComponent={
            history.isError && history.data ? <Banner tone="warning" message="Couldn't refresh. Showing what we have." /> : null
          }
          ListEmptyComponent={empty}
          ListFooterComponent={footer}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        />
        {fresh ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled"
          >
            {PREFILL_CHIPS.map((chip) => (
              <Chip
                key={chip.label}
                label={chip.label}
                icon={chip.icon}
                variant="outlinedDark"
                onPress={() => {
                  setDraft(chip.text);
                  input.current?.focus();
                }}
              />
            ))}
          </ScrollView>
        ) : null}
        <ChatInput
          inputRef={input}
          value={draft}
          onChangeText={setDraft}
          onSend={() => {
            if (submit(draft)) setDraft("");
          }}
          onNew={onNew}
          busy={busy}
        />
      </Screen>
      {/* The modal sits outside the Screen, like the other sheets. */}
      <AiConsent visible={consentFor !== null} onAgree={agree} onDecline={() => setConsentFor(null)} />
    </>
  );
}

/** The user's message: a right-aligned mint pill, like the quick replies. Long-press selects and copies. */
function UserPill({ text }: { text: string }) {
  return (
    <View style={styles.user}>
      <RNText selectable style={styles.userText}>
        {text}
      </RNText>
    </View>
  );
}

/** An AI card bubble: the coin buddy and "buddy · 9:41 pm", then the content. */
function AiBubble({ time, failed, children }: { time: string; failed?: boolean; children: ReactNode }) {
  return (
    <Panel style={failed ? styles.failed : undefined}>
      <Stack gap="sm">
        <Row gap="sm">
          <Illustration name="avatar_ai" width={30} />
          <Note>{time ? `buddy · ${time}` : "buddy"}</Note>
        </Row>
        {children}
      </Stack>
    </Panel>
  );
}

function Bubble({ message, live, currency }: { message: Message; live?: ChatResponse; currency: string }) {
  if (message.role === "user") return <UserPill text={message.content} />;
  return (
    <View style={styles.reply}>
      {live?.tool_calls.map((call, i) => <ToolPill key={`${call.tool_name}-${i}`} call={call} currency={currency} />)}
      <AiBubble time={clockTime(message.created_at)} failed={message.status === "failed"}>
        <Markdown currency={currency}>{message.content}</Markdown>
        {live?.reasoning ? <Reasoning text={live.reasoning} /> : null}
      </AiBubble>
    </View>
  );
}

/** The design's filled four-point spark (Chat.html). */
function Spark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4L3.5 11l6.4-2.1z" fill={color} />
    </Svg>
  );
}

/** The tool pill: a mint spark, the summary ("Checked Food · 14 orders") and a chevron. It opens to the tool's raw input and output. */
function ToolPill({ call, currency }: { call: ToolCall; currency: string }) {
  const [open, setOpen] = useState(false);
  const summary = toolSummary(call, currency);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View style={styles.tool}>
      <PressableScale
        onPress={() => setOpen((o) => !o)}
        accessibilityLabel={summary}
        accessibilityHint="Shows what the tool was asked and what it returned"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={styles.toolPill}
      >
        <Spark size={13} color={colors.mint} />
        <RNText style={styles.toolText}>{summary}</RNText>
        <Chevron size={13} color={colors.muted} strokeWidth={2.4} />
      </PressableScale>
      {open ? (
        <View style={styles.raw}>
          <RNText selectable style={styles.rawText}>
            {`Input\n${JSON.stringify(call.tool_input, null, 2)}\n\nOutput\n${call.tool_output}`}
          </RNText>
        </View>
      ) : null}
    </View>
  );
}

/** "view reasoning" with a chevron, at the foot of the reply that just arrived. */
function Reasoning({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View style={styles.reasoning}>
      <PressableScale
        onPress={() => setOpen((o) => !o)}
        accessibilityLabel="View reasoning"
        accessibilityState={{ expanded: open }}
        hitSlop={12}
        style={styles.reasoningToggle}
      >
        <Lightbulb size={14} color={colors.muted} strokeWidth={2} />
        <RNText style={styles.reasoningLabel}>view reasoning</RNText>
        <Chevron size={12} color={colors.muted} strokeWidth={2.4} />
      </PressableScale>
      {open ? (
        <RNText selectable style={styles.reasoningText}>
          {text}
        </RNText>
      ) : null}
    </View>
  );
}

/** A right-aligned quick reply: mint or forest, with a small leading icon. Sends when tapped. */
function QuickReply({
  text,
  icon: Icon,
  tone,
  disabled,
  onPress,
}: {
  text: string;
  icon: LucideIcon;
  tone: "mint" | "forest";
  disabled: boolean;
  onPress: () => void;
}) {
  const fg = tone === "mint" ? colors.ink : colors.cream;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={text}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={[styles.quick, { backgroundColor: colors[tone] }, disabled && styles.inactive]}
    >
      <Icon size={14} color={fg} strokeWidth={2.2} />
      <RNText style={[styles.quickText, { color: fg }]}>{text}</RNText>
    </PressableScale>
  );
}

const DOT_STEP = 160; // ms between one dot's rise and the next

/** The reply is on its way: three dots rising in turn (DESIGN.md §6.3), or still under reduce motion. */
function Composing() {
  const still = useReducedMotion();
  return (
    <Panel style={styles.composing}>
      <View accessible accessibilityLabel="BuyWise AI is replying" accessibilityLiveRegion="polite" style={styles.composingRow}>
        <Illustration name="avatar_ai" width={30} />
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <Dot key={i} index={i} still={still} />
          ))}
        </View>
      </View>
    </Panel>
  );
}

function Dot({ index, still }: { index: number; still: boolean }) {
  const lift = useSharedValue(0);
  useEffect(() => {
    if (!still) {
      const rise = withTiming(1, { duration: motion.dur.enter });
      const fall = withTiming(0, { duration: motion.dur.enter });
      lift.set(withDelay(index * DOT_STEP, withRepeat(withSequence(rise, fall), -1)));
    }
    return () => cancelAnimation(lift);
  }, [index, lift, still]);
  const animated = useAnimatedStyle(() => ({ opacity: 0.4 + 0.6 * lift.get(), transform: [{ translateY: -4 * lift.get() }] }));
  return <Animated.View style={[styles.dot, still ? styles.dotStill : animated]} />;
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { flexGrow: 1, gap: space.md, paddingBottom: space.sm },
  stack: { gap: space.sm },
  welcome: { flexGrow: 1, gap: space.md },
  quickReplies: { alignItems: "flex-end", gap: 7 },
  quick: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill },
  quickText: { fontFamily: fonts.mono, fontSize: 11.5 },
  inactive: { opacity: 0.5 },
  chipsScroll: { flexGrow: 0 },
  chips: { flexDirection: "row", gap: space.sm },
  footer: { gap: space.md },
  user: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.row,
    backgroundColor: colors.mint,
  },
  userText: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 17, color: colors.ink },
  reply: { gap: space.md },
  failed: { borderWidth: 1.4, borderColor: colors.tomato },
  tool: { gap: space.sm },
  toolPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.4,
    borderColor: colors.line,
  },
  toolText: { flexShrink: 1, fontFamily: fonts.mono, fontSize: 10.5, color: extra.proseOnCard },
  raw: { padding: space.lg, borderRadius: radius.tile, backgroundColor: colors.card },
  rawText: { ...type.meta, color: colors.muted },
  reasoning: { gap: space.sm },
  reasoningToggle: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6 },
  reasoningLabel: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.muted },
  reasoningText: { ...type.meta, color: colors.muted },
  composing: { alignSelf: "flex-start" },
  composingRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dots: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6 },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.muted },
  dotStill: { opacity: 0.8 },
  retry: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center" },
  retryText: { ...type.meta, color: colors.tomato, textAlign: "right" },
  disclaimer: { ...type.meta, fontSize: 10, textAlign: "center", color: colors.muted },
});
