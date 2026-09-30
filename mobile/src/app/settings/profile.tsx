import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Check, Globe, User } from "lucide-react-native";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useUpdateProfile } from "@/lib/mutations";
import { profileQuery } from "@/lib/queries";
import {
  currencyOptions,
  currencyTag,
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
  Chip,
  FieldButton,
  FieldInput,
  hapticSuccess,
  Note,
  OptionSheet,
  PrimaryButton,
  Row,
  SectionLabel,
  SheetLoading,
  SheetScreen,
  showToast,
  Stack,
  useDiscardGuard,
} from "@/ui";

// Edit profile, on the same cream sheet as QuickAdd: name, currency (chips), time zone (a field that opens
// the list), and the join date. Opened by the Profile card's pencil and by the Region ticket.

export default function ProfileSettingsScreen() {
  const profile = useQuery(profileQuery);

  if (profile.data) return <ProfileForm profile={profile.data} />;
  return (
    <SheetLoading
      title="Edit profile"
      error={profile.isError ? userMessage(profile.error, "load your profile") : null}
      onRetry={() => profile.refetch()}
    />
  );
}

function ProfileForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const [baseline] = useState(() => profileDraftFromProfile(profile));
  const [draft, setDraft] = useState<ProfileDraft>(baseline);
  const [failure, setFailure] = useState<string | null>(null);
  const [zoneOpen, setZoneOpen] = useState(false);
  const update = useUpdateProfile();
  const { allowLeave } = useDiscardGuard(profileDraftKey(draft) !== profileDraftKey(baseline));

  const { name, errors } = validateProfileDraft(draft);
  const patch = profileEditPatch(profile, draft, name);
  const changed = Object.keys(patch).length > 0;

  // The saved values stay on offer, so a change can be undone before saving.
  const currencies = currencyOptions(profile.currency);
  const zones = timezoneOptions(profile.timezone);
  const zoneLabel = zones.find((z) => z.value === draft.timezone)?.label ?? draft.timezone;

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

  return (
    <SheetScreen title="Edit profile">
      {failure ? <Banner tone="error" surface="cream" message={failure} /> : null}

      <Stack gap="sm">
        <SectionLabel label="Name" light />
        <FieldInput
          icon={User}
          accessibilityLabel="Name"
          placeholder="Your name"
          value={draft.name}
          onChangeText={(text) => setDraft({ ...draft, name: text })}
          returnKeyType="done"
        />
        {errors.name ? <Note tone="error">{errors.name}</Note> : null}
      </Stack>

      <Stack gap="sm">
        <SectionLabel label="Currency" light />
        <Row gap="xs" wrap>
          {currencies.map((c) => {
            const on = c.value === draft.currency;
            return (
              <Chip
                key={c.value}
                label={currencyTag(c.value)}
                accessibilityLabel={c.label}
                variant={on ? "ink" : "outlined"}
                selected={on}
                onPress={() => setDraft({ ...draft, currency: c.value })}
              />
            );
          })}
        </Row>
      </Stack>

      <Stack gap="sm">
        <SectionLabel label="Time zone" light />
        <FieldButton icon={Globe} label="Time zone" value={zoneLabel} placeholder="Choose a time zone" onPress={() => setZoneOpen(true)} />
      </Stack>

      <Note tone="cream">{`Joined ${formatDate(profile.created_at, "medium")}`}</Note>

      <PrimaryButton label="Save" icon={Check} onPress={save} disabled={!changed || !!errors.name || update.isPending} requiresNetwork />

      <OptionSheet
        visible={zoneOpen}
        title="Time zone"
        groups={[{ options: zones.map((z) => ({ value: z.value, label: z.label })) }]}
        value={draft.timezone}
        onSelect={(timezone) => {
          setDraft({ ...draft, timezone });
          setZoneOpen(false);
        }}
        onClose={() => setZoneOpen(false)}
      />
    </SheetScreen>
  );
}
