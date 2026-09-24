import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, StyleSheet, View } from "react-native";

import { parseDateOnly, toYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";

import { SelectField } from "./SelectField";
import { Text } from "./Text";
import { theme } from "./theme";

/**
 * A calendar-date field. The value is a "YYYY-MM-DD" string in the device's
 * local calendar, in and out (the picker's Date is read with local getters only).
 * Android opens the system dialog, iOS shows the compact native control, and the
 * web build (where the native library has no implementation) uses the browser's
 * own date input.
 */
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (ymd: string) => void;
}) {
  const date = parseDateOnly(value) ?? new Date();

  if (Platform.OS === "android") {
    return (
      <SelectField
        label={label}
        value={formatDate(value, "medium")}
        placeholder="Choose a date"
        icon="calendar-outline"
        onPress={() =>
          DateTimePickerAndroid.open({
            value: date,
            mode: "date",
            onValueChange: (_event, picked) => onChange(toYmd(picked)),
          })
        }
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      {Platform.OS === "ios" ? (
        <View style={styles.native}>
          <DateTimePicker
            value={date}
            mode="date"
            display="compact"
            accessibilityLabel={label}
            onValueChange={(_event, picked) => onChange(toYmd(picked))}
          />
        </View>
      ) : (
        <input
          type="date"
          value={value}
          aria-label={label}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value); // "" while the user is mid-edit
          }}
          style={{
            minHeight: theme.minHit,
            padding: theme.space.sm,
            fontSize: theme.type.body.fontSize,
            color: theme.color.text,
            backgroundColor: theme.color.surface,
            border: `1px solid ${theme.color.border}`,
            borderRadius: theme.radius.md,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.xs },
  native: { alignItems: "flex-start", minHeight: theme.minHit, justifyContent: "center" },
});
