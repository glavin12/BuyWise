import { StatusBar } from "expo-status-bar";
import { Eye, EyeOff, type LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { heroFit, MAX_WIDTH, OVERLAP, WORDMARK } from "@/lib/authLayout";
import { useOnline } from "@/lib/network";

import { RichText } from "./Chips";
import { Illustration } from "./Illustration";
import { LegalLinks } from "./LegalLinks";
import { PressableScale } from "./PressableScale";
import { colors, fonts, radius, type } from "./tokens";

// The signed-out frame (design/screens/01-login.png, values from design/reference-html/Main.html):
// a sage top with the wordmark and the login_hero illustration, then a charcoal sheet with the
// headline, a mono line, the fields, the button and a link to the other screen. Log in, sign up
// and "Check your email" all use it.

const CORNER = 46; // sage kept behind the sheet's rounded corners (the design's 480 - 434)

export function AuthLayout({
  title,
  intro,
  action,
  footer,
  children,
}: {
  /** The uppercase headline; "\n" breaks the line. */
  title: string;
  /** The mono line under it, a RichText template. */
  intro: string;
  /** The button (a `PrimaryButton`). */
  action: ReactNode;
  /** "New here? Create an account": the prompt and the underlined link. */
  footer?: { prompt: string; link: string; onPress: () => void };
  /** Banners and `AuthField`s, between the intro and the button. */
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const size = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const contentHeight = useRef(0);

  // F1: on a short phone the keyboard covers the sheet; scroll to its bottom so the fields and the button stay in view.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const shown = Keyboard.addListener("keyboardDidShow", () => {
      // Android fires this in the same tick that KeyboardAvoidingView shrinks the scroll view: wait for it, or the end we scroll to is the old one.
      timer = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => {
      shown.remove();
      clearTimeout(timer);
    };
  }, []);

  // While offline, the banner above the app already covers the status bar.
  const top = online ? Math.max(insets.top, 20) : 12;
  const bottom = Math.max(20, insets.bottom + 8);
  // The wordmark's row gives way first (it then sits over the hero's empty top-left corner), then the hero's sky.
  const { width, lead, height: heroHeight } = heroFit(size.width, size.height, top, bottom);

  return (
    // F1: on Android with edge-to-edge, "padding" is the behaviour that works (as in Screen).
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <StatusBar style="dark" />
      <ScrollView
        ref={scroll}
        bounces={false}
        keyboardShouldPersistTaps="handled" // F2: a tap outside the field dismisses the keyboard
        contentContainerStyle={styles.scroll}
        onContentSizeChange={(_, height) => {
          // An error banner grew the form while the keyboard is up: keep its bottom (the button) in view.
          if (contentHeight.current && height > contentHeight.current && Keyboard.isVisible()) scroll.current?.scrollToEnd({ animated: true });
          contentHeight.current = height;
        }}
      >
        <View style={styles.column}>
          <View style={[styles.top, { paddingTop: top + lead }]}>
            <View style={[styles.hero, { height: heroHeight }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {/* Anchored to the bottom, so a short phone crops the sky, not the hill. */}
              <View style={styles.art}>
                <Illustration name="login_hero" width={width} />
              </View>
            </View>
            <RNText accessibilityLabel="BuyWise" style={[styles.wordmark, { top }]}>
              BUYWISE
            </RNText>
          </View>

          <View style={[styles.sheet, { paddingBottom: bottom }]}>
            <RNText accessibilityRole="header" style={styles.title}>
              {title}
            </RNText>
            <View style={styles.intro}>
              <RichText tone="muted">{intro}</RichText>
            </View>
            {children ? <View style={styles.fields}>{children}</View> : null}
            <View style={styles.action}>{action}</View>
            {footer ? (
              <View style={styles.footer}>
                <RNText style={styles.footerText}>{footer.prompt}</RNText>
                <PressableScale onPress={footer.onPress} accessibilityRole="link" hitSlop={12} style={styles.link}>
                  <RNText style={styles.linkText}>{footer.link}</RNText>
                </PressableScale>
              </View>
            ) : null}
            <LegalLinks />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A field on the charcoal sheet: card fill, radius 17, a leading icon. `secure` is a password field with a show / hide eye. */
export function AuthField({
  icon: Icon,
  label,
  secure,
  ref,
  ...input
}: Omit<TextInputProps, "style" | "secureTextEntry"> & {
  icon: LucideIcon;
  /** Screen-reader name, and the placeholder unless one is given. */
  label: string;
  secure?: boolean;
  ref?: Ref<TextInput>;
}) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={[styles.field, secure && styles.fieldSecure]}>
      <Icon size={18} color={colors.muted} strokeWidth={2.1} />
      <TextInput
        ref={ref}
        placeholder={label}
        {...input}
        accessibilityLabel={label}
        secureTextEntry={secure && hidden}
        placeholderTextColor={colors.muted}
        selectionColor={colors.tomato}
        cursorColor={colors.tomato}
        style={styles.input}
      />
      {secure ? (
        <PressableScale
          onPress={() => setHidden((h) => !h)}
          accessibilityLabel={hidden ? "Show password" : "Hide password"}
          hitSlop={4}
          style={styles.eye}
        >
          {hidden ? <Eye size={18} color={colors.muted} strokeWidth={2.3} /> : <EyeOff size={18} color={colors.muted} strokeWidth={2.3} />}
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  scroll: { flexGrow: 1, alignItems: "center" },
  column: { flexGrow: 1, width: "100%", maxWidth: MAX_WIDTH },
  top: { backgroundColor: colors.sage, paddingBottom: CORNER - OVERLAP },
  wordmark: {
    position: "absolute",
    left: 22,
    fontFamily: fonts.display,
    fontSize: WORDMARK,
    lineHeight: WORDMARK,
    letterSpacing: 0.3,
    color: colors.ink,
  },
  hero: { overflow: "hidden" },
  art: { position: "absolute", bottom: 0, left: 0 },
  sheet: {
    flexGrow: 1,
    marginTop: -CORNER,
    paddingHorizontal: 22,
    paddingTop: 22,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.screen,
  },
  title: { ...type.title, fontSize: 34, lineHeight: 31, color: colors.text },
  intro: { marginTop: 10, maxWidth: 300 },
  fields: { marginTop: 18, gap: 10 },
  action: { marginTop: 16 },
  footer: { marginTop: "auto", paddingTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  footerText: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  link: { borderBottomWidth: 1.5, borderBottomColor: colors.tomato },
  linkText: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.text },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.field,
    backgroundColor: colors.card,
  },
  fieldSecure: { paddingRight: 8 },
  input: { flex: 1, minWidth: 0, height: "100%", padding: 0, fontFamily: fonts.mono, fontSize: 13.5, color: colors.text },
  eye: { width: 38, height: 38, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
