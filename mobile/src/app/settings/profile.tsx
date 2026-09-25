import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useUpdateProfile } from "@/lib/mutations";
import { profileQuery } from "@/lib/queries";
import {
  CURRENCY_OPTIONS,
  profileDraftFromProfile,
  profileDraftKey,
  profileEditPatch,
  timezoneOptions,
  validateProfileDraft,
  type ProfileDraft,
} from "@/lib/settings";
import type { UserProfile } from "@/lib/types";
import {
  Banner,
  Button,
  ErrorState,
  hapticSuccess,
  Input,
  PickerList,
  Screen,
  SelectField,
  showToast,
  Skeleton,
  Stack,
  Text,
  useDiscardGuard,
} from "@/ui";

type PickerKind = "currency" | "timezone" | null;

export default function ProfileSettingsScreen() {
  const profile = useQuery(profileQuery);

  if (profile.data) return <ProfileForm profile={profile.data} />;
  return (
    <Screen title="Profile" back>
      {profile.isError ? (
        <ErrorState message={userMessage(profile.error, "load your profile")} onRetry={() => profile.refetch()} />
      ) : (
        <Skeleton height={220} />
      )}
    </Screen>
  );
}

function ProfileForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const [baseline] = useState(() => profileDraftFromProfile(profile));
  const [draft, setDraft] = useState<ProfileDraft>(baseline);
  const [failure, setFailure] = useState<string | null>(null);
  // Choosing currency or timezone swaps the form for a full-screen PickerList; the
  // component itself stays mounted, so `draft` survives the round trip.
  const [picker, setPicker] = useState<PickerKind>(null);
  const update = useUpdateProfile();
  const { allowLeave } = useDiscardGuard(profileDraftKey(draft) !== profileDraftKey(baseline));

  const { name, errors } = validateProfileDraft(draft);
  const patch = profileEditPatch(profile, draft, name);
  const changed = Object.keys(patch).length > 0;

  const currencyLabel = CURRENCY_OPTIONS.find((c) => c.value === draft.currency)?.label ?? draft.currency;
  const timezones = timezoneOptions(draft.timezone);
  const timezoneLabel = timezones.find((z) => z.value === draft.timezone)?.label ?? draft.timezone;

  const save = async () => {
    if (errors.name || !changed) return;
    setFailure(null);
    try {
      await update.mutateAsync(patch);
    } catch (err) {
      setFailure(userMessage(err, "save your profile"));
      return;
    }
    hapticSuccess();
    showToast("Profile saved");
    allowLeave();
    router.back();
  };

  if (picker) {
    const options = picker === "currency" ? CURRENCY_OPTIONS : timezones;
    return (
      <PickerList
        title={picker === "currency" ? "Currency" : "Time zone"}
        searchLabel="Search"
        noun={picker === "currency" ? "currency" : "time zone"}
        emptyMessage="No options."
        items={options.map((o) => ({ id: o.value, label: o.label }))}
        loading={false}
        error={null}
        onRetry={() => {}}
        onSelect={(item) => {
          setDraft((d) => (picker === "currency" ? { ...d, currency: item.id } : { ...d, timezone: item.id }));
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    );
  }

  return (
    <Screen title="Profile" back keyboard>
      {failure ? <Banner tone="error" message={failure} /> : null}

      <Input label="Name" value={draft.name} onChangeText={(text) => setDraft({ ...draft, name: text })} error={errors.name} returnKeyType="done" />

      <SelectField label="Currency" value={currencyLabel} placeholder="Choose a currency" onPress={() => setPicker("currency")} />
      <SelectField label="Time zone" value={timezoneLabel} placeholder="Choose a time zone" onPress={() => setPicker("timezone")} />

      <Stack gap="xs">
        <Text variant="caption" tone="muted">
          Joined
        </Text>
        <Text>{formatDate(profile.created_at, "medium")}</Text>
      </Stack>

      <Button title="Save" onPress={save} disabled={!changed || !!errors.name || update.isPending} requiresNetwork />
    </Screen>
  );
}
