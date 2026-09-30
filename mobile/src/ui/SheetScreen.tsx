import { SearchX, X } from "lucide-react-native";
import type { ReactNode } from "react";

import { Title } from "./Blocks";
import { CircleButton } from "./Buttons";
import { Row, Stack } from "./Layout";
import { SheetHandle } from "./OptionSheet";
import { goBack, Screen } from "./Screen";
import { Skeleton } from "./Skeleton";
import { EmptyState, ErrorState } from "./States";

/**
 * A form on a cream sheet, in the QuickAdd look (design/screens/04-quick-add-sheet.png): the design's
 * handle, an uppercase title with a close button, then the form. Every form route opens as a native
 * sheet (`quickAddSheetOptions`); this is what it draws, and what its loading and "not found" states sit in.
 * `onClose` (the ✕) leaves the route unless a chooser laid over the form passes its own; `scroll={false}`
 * is for a chooser that hosts its own list.
 */
export function SheetScreen({ title, onClose = goBack, scroll, children }: { title: string; onClose?: () => void; scroll?: boolean; children: ReactNode }) {
  return (
    <Screen surface="cream" keyboard scroll={scroll}>
      <SheetHandle />
      <Row justify="between">
        <Stack grow>
          <Title tone="ink">{title}</Title>
        </Stack>
        <CircleButton icon={X} variant="line" size={38} label="Close" onPress={onClose} />
      </Row>
      {children}
    </Screen>
  );
}

/** A sheet still waiting for what it edits: placeholders while it loads, or the failure with a retry. */
export function SheetLoading({ title, error, onRetry }: { title: string; error?: string | null; onRetry: () => void | Promise<unknown> }) {
  return (
    <SheetScreen title={title}>
      {error ? (
        <ErrorState surface="cream" message={error} onRetry={onRetry} />
      ) : (
        <>
          <Skeleton tone="sheet" height={58} round="row" />
          <Skeleton tone="sheet" height={120} round="card" />
          <Skeleton tone="sheet" height={60} round="pill" />
        </>
      )}
    </SheetScreen>
  );
}

/** A sheet whose subject is gone (a malformed id in the link, or a row deleted elsewhere). */
export function SheetNotFound({ title, what }: { title: string; what: string }) {
  return (
    <SheetScreen title={title}>
      <EmptyState surface="cream" icon={SearchX} title={`${what} not found`} message="It may have been deleted." actionLabel="Go back" onAction={goBack} />
    </SheetScreen>
  );
}
