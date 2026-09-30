import { ArrowLeft, CloudOff, Inbox, SearchX, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";

import { escapeRich } from "@/lib/richText";

import { IconTile, Panel, Title } from "./Blocks";
import { CircleButton, PrimaryButton, SecondaryButton } from "./Buttons";
import { RichText, type Hue } from "./Chips";
import { Row, Stack } from "./Layout";
import { goBack, Screen } from "./Screen";

// The shared empty, error and not-found states, in the look the rebuilt screens draw by hand
// (Home's "Can't reach BuyWise", Activity's "Can't load activity"): a card with an icon tile,
// an uppercase title, a mono message and a button. The card carries its own colour, so it reads
// on charcoal and sage alike. `surface` picks the fill: "dark" (the default) is the charcoal card,
// "cream" the field-coloured one for a cream form sheet.

type Surface = "dark" | "cream";

function StatePanel({
  icon: Icon,
  hue,
  title,
  message,
  surface,
  children,
}: {
  icon: LucideIcon;
  hue: Hue;
  title: string;
  message?: string;
  surface: Surface;
  children?: ReactNode;
}) {
  const cream = surface === "cream";
  return (
    <Panel color={cream ? "creamField" : "card"}>
      <Stack gap="md">
        <Row gap="md">
          <IconTile icon={Icon} color={hue} />
          <Stack grow>
            <Title size="cardTitle" tone={cream ? "ink" : "text"}>
              {title}
            </Title>
          </Stack>
        </Row>
        {message ? <RichText tone={cream ? "ink" : "card"}>{escapeRich(message)}</RichText> : null}
        {children}
      </Stack>
    </Panel>
  );
}

/** Nothing here yet (D1): say so and, where useful, offer the first action. */
export function EmptyState({
  title,
  message,
  icon = Inbox,
  actionLabel,
  onAction,
  surface = "dark",
}: {
  title: string;
  message?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  /** What it sits on: default dark (charcoal screens); "cream" on a form sheet. */
  surface?: Surface;
}) {
  return (
    <StatePanel icon={icon} hue="marigold" title={title} message={message} surface={surface}>
      {actionLabel && onAction ? <SecondaryButton label={actionLabel} onPress={onAction} surface={surface === "cream" ? "light" : "dark"} /> : null}
    </StatePanel>
  );
}

/** A load failed and there is nothing cached to show: explain and offer a retry (C8). */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  surface = "dark",
}: {
  title?: string;
  message: string;
  onRetry: () => void | Promise<unknown>;
  retryLabel?: string;
  /** What it sits on: default dark (charcoal screens); "cream" on a form sheet. */
  surface?: Surface;
}) {
  return (
    <StatePanel icon={CloudOff} hue="tomato" title={title} message={message} surface={surface}>
      <PrimaryButton label={retryLabel} onPress={onRetry} />
    </StatePanel>
  );
}

/** A whole screen for a link that points at nothing: a malformed id, or a row deleted elsewhere. */
export function NotFoundScreen({ title, what }: { title: string; what: string }) {
  return (
    <Screen surface="screen">
      <Row>
        <CircleButton icon={ArrowLeft} label="Go back" onPress={goBack} />
        <Stack grow>
          <Title>{title}</Title>
        </Stack>
      </Row>
      <EmptyState icon={SearchX} title={`${what} not found`} message="It may have been deleted." actionLabel="Go back" onAction={goBack} />
    </Screen>
  );
}
