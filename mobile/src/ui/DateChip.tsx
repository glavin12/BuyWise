import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Calendar, X } from "lucide-react-native";
import { useState } from "react";
import { Platform } from "react-native";

import { parseDateOnly, relativeDayLabel, todayLocal, toYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";

import { SecondaryButton } from "./Buttons";
import { Chip } from "./Chips";
import { Sheet } from "./OptionSheet";
import { colors, fonts, radius } from "./tokens";

/**
 * The QuickAdd date chip: shows the date ("Today", "Yesterday", "12 Sep") and picks another.
 * Android opens the system dialog; iOS shows the inline calendar in a cream sheet; the web build
 * (no native picker there) uses the browser's date input in the same sheet. "YYYY-MM-DD" in and out.
 *
 * An optional date (a goal's target): `value` may be null, the chip then reads `emptyLabel`, and while
 * a date is set a "Clear" chip beside it calls `onClear`. `withYear` shows the year ("12 Sep 2027").
 */
export function DateChip({
  value,
  onChange,
  onClear,
  emptyLabel = "Pick a date",
  withYear,
}: {
  value: string | null;
  onChange: (ymd: string) => void;
  onClear?: () => void;
  emptyLabel?: string;
  withYear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const date = (value ? parseDateOnly(value) : null) ?? new Date();
  const label = value ? (relativeDayLabel(value, todayLocal()) ?? formatDate(value, withYear ? "medium" : "short")) : emptyLabel;

  const pick = () =>
    Platform.OS === "android"
      ? DateTimePickerAndroid.open({ value: date, mode: "date", onValueChange: (_event, picked) => onChange(toYmd(picked)) })
      : setOpen(true);

  return (
    <>
      <Chip label={label} icon={Calendar} variant="outlined" onPress={pick} accessibilityLabel={`Date: ${label}. Tap to change`} />
      {value && onClear ? <Chip label="Clear" icon={X} variant="outlined" onPress={onClear} accessibilityLabel="Remove the date" /> : null}
      {Platform.OS === "android" ? null : (
        <Sheet visible={open} title="Date" onClose={() => setOpen(false)}>
          {Platform.OS === "ios" ? (
            <DateTimePicker
              value={date}
              mode="date"
              display="inline"
              themeVariant="light"
              accentColor={colors.tomato}
              onValueChange={(_event, picked) => onChange(toYmd(picked))}
            />
          ) : (
            <input
              type="date"
              value={value ?? ""}
              aria-label="Date"
              onChange={(event) => {
                if (event.target.value) onChange(event.target.value);
              }}
              style={{
                height: 50,
                padding: "0 14px",
                fontFamily: fonts.mono,
                fontSize: 13,
                color: colors.ink,
                backgroundColor: colors.creamField,
                border: "none",
                borderRadius: radius.field,
              }}
            />
          )}
          <SecondaryButton label="Done" onPress={() => setOpen(false)} />
        </Sheet>
      )}
    </>
  );
}
