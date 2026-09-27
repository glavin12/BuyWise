import { theme } from "./theme";
import { radius } from "./tokens";

// Navigator styling lives here so the route layouts stay free of visual values.

export const stackScreenOptions = {
  headerShown: false, // screens draw their own header via <Screen title back>
  contentStyle: { backgroundColor: theme.color.background },
};

/** Forms and pickers open over the screen that launched them (slide up, swipe or back to close). */
export const sheetScreenOptions = { presentation: "modal" } as const;

/**
 * QuickAdd (the add-transaction route, opened by holding the centre tab): a native sheet
 * with the design's 34 top radius (DESIGN.md §3 `Sheet`). The grabber is iOS-only.
 */
export const quickAddSheetOptions = {
  presentation: "formSheet" as const,
  sheetAllowedDetents: [0.92],
  sheetCornerRadius: radius.sheet,
  sheetGrabberVisible: true,
};
