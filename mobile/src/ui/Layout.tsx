import { View, type ViewProps } from "react-native";

import { theme } from "./theme";

type Gap = keyof typeof theme.space;
type LayoutProps = Omit<ViewProps, "style"> & {
  gap?: Gap;
  /** Fill the remaining space in a Row/Stack (flex: 1, allowed to shrink so text can truncate). */
  grow?: boolean;
};

export function Stack({ gap = "md", grow, ...rest }: LayoutProps) {
  return <View style={[{ gap: theme.space[gap] }, grow && { flex: 1, minWidth: 0 }]} {...rest} />;
}

const JUSTIFY = {
  start: "flex-start",
  between: "space-between",
  center: "center",
  end: "flex-end",
} as const;

const ALIGN = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" } as const;

export function Row({
  gap = "md",
  grow,
  justify = "start",
  align = "center",
  wrap,
  ...rest
}: LayoutProps & { justify?: keyof typeof JUSTIFY; align?: keyof typeof ALIGN; /** Wrap onto more lines (chip rows). */ wrap?: boolean }) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          gap: theme.space[gap],
          justifyContent: JUSTIFY[justify],
          alignItems: ALIGN[align],
        },
        grow && { flex: 1, minWidth: 0 },
        wrap && { flexWrap: "wrap" },
      ]}
      {...rest}
    />
  );
}
