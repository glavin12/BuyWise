import { View, type ViewProps } from "react-native";

// The gap scale of Row and Stack (`gap="md"`). Not tokens.space, whose keys stand for other values.
const GAP = { xs: 4, sm: 8, md: 12, lg: 16 } as const;

type Gap = keyof typeof GAP;
type LayoutProps = Omit<ViewProps, "style"> & {
  gap?: Gap;
  /** Fill the remaining space in a Row/Stack (flex: 1, allowed to shrink so text can truncate). */
  grow?: boolean;
};

export function Stack({ gap = "md", grow, ...rest }: LayoutProps) {
  return <View style={[{ gap: GAP[gap] }, grow && { flex: 1, minWidth: 0 }]} {...rest} />;
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
          gap: GAP[gap],
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
