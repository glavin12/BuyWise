import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, StyleSheet, View } from "react-native";

import { parseDateOnly, toYmd, todayLocal } from "@/lib/dates";
import { formatDate } from "@/lib/format";

import { Button } from "./Button";
import { SelectField } from "./SelectField";
import { Text } from "./Text";
import { theme } from "./theme";

/**
 * A calendar-date field. The value is a "YYYY-MM-DD" string in the device's
 * local calendar, in and out (the picker's Date is read with local getters only).
 * Android opens the system dialog, iOS shows the compact native control, and the
 * web build (where the native library has no implementation) uses the browser's
 * own date input.
 *
 * Passing `onClear` makes the date optional: `value` may then be null (nothing
 * chosen yet), and while a date is set a "Remove" link calls `onClear`.
 */
export function DateField({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value: string | null;
  onChange: (ymd: string) => void;
  onClear?: () => void;
}) {
  const date = (value ? parseDateOnly(value) : null) ?? new Date();
  const remove = value !== null && onClear ? <Button title="Remove date" variant="link" onPress={onClear} /> : null;

  if (Platform.OS === "android") {
    return (
      <View style={styles.wrap}>
        <SelectField
          label={label}
          value={value ? formatDate(value, "medium") : null}
          placeholder={onClear ? "No date" : "Choose a date"}
          icon="calendar-outline"
          onPress={() =>
            DateTimePickerAndroid.open({
              value: date,
              mode: "date",
              onValueChange: (_event, picked) => onChange(toYmd(picked)),
            })
          }
        />
        {remove}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {value === null && Platform.OS === "ios" ? (
        // The compact native control always shows a date, so an unset optional date
        // is a plain field; tapping it sets today and reveals the control.
        <SelectField
          label={label}
          placeholder="No date"
          icon="calendar-outline"
          onPress={() => onChange(todayLocal())}
        />
      ) : (
        <>
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
              value={value ?? ""}
              aria-label={label}
              onChange={(event) => {
                if (event.target.value) onChange(event.target.value);
                else onClear?.(); // "" is the browser's clear button (or the user is mid-edit, which an optional field can treat as empty)
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
        </>
      )}
      {remove}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.xs },
  native: { alignItems: "flex-start", minHeight: theme.minHit, justifyContent: "center" },
});
