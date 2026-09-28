import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";
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
 */
export function DateChip({ value, onChange }: { value: string; onChange: (ymd: string) => void }) {
  const [open, setOpen] = useState(false);
  const date = parseDateOnly(value) ?? new Date();
  const label = relativeDayLabel(value, todayLocal()) ?? formatDate(value);

  const pick = () =>
    Platform.OS === "android"
      ? DateTimePickerAndroid.open({ value: date, mode: "date", onValueChange: (_event, picked) => onChange(toYmd(picked)) })
      : setOpen(true);

  return (
    <>
      <Chip label={label} icon={Calendar} variant="outlined" onPress={pick} accessibilityLabel={`Date: ${label}. Tap to change`} />
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
              value={value}
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
