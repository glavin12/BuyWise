import { colors, radius } from "./tokens";

// Navigator styling lives here so the route layouts stay free of visual values.

export const stackScreenOptions = {
  headerShown: false, // screens draw their own header
  contentStyle: { backgroundColor: colors.screen }, // what shows behind a screen while it slides in
};

/**
 * Forms and the Quick Add sheet (the add-transaction route, opened by holding the centre tab): a native
 * sheet with the design's 34 top radius (DESIGN.md §3 `Sheet`), cream to match the form it holds. The
 * screen draws the design's own handle (the native grabber is iOS-only and a different size).
 */
export const quickAddSheetOptions = {
  presentation: "formSheet" as const,
  sheetAllowedDetents: [0.92],
  sheetCornerRadius: radius.sheet,
  sheetGrabberVisible: false,
  contentStyle: { backgroundColor: colors.cream },
};
