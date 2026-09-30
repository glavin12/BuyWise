import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { payeesQuery } from "@/lib/queries";
import { payeeInitial } from "@/lib/settings";
import type { CategoryType } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import {
  Banner,
  categoryTone,
  Chip,
  CircleButton,
  EmptyState,
  ErrorState,
  Fab,
  goBack,
  IconTile,
  Row,
  Screen,
  SearchField,
  SettingsRow,
  showToast,
  Skeleton,
  Stack,
  Title,
} from "@/ui";

// Payees, in the Activity look: back and title, search, Expense / Income chips, one row per payee (a tile
// with its initial, its name) and the marigold + for a new one. Tapping a row renames or deletes it.

const TYPES = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
] as const;

export default function PayeesSettingsScreen() {
  const router = useRouter();
  const [type, setType] = useState<CategoryType>("expense");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const payees = useQuery(payeesQuery(type));
  useRefetchStaleOnFocus();

  const all = payees.data?.payees;
  const needle = query.trim().toLowerCase();
  const items = needle ? all?.filter((p) => p.name.toLowerCase().includes(needle)) : all;
  const add = () => router.push({ pathname: "/settings/payee/new", params: { type } });

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await payees.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen surface="screen" onRefresh={refresh} refreshing={refreshing} fab={<Fab label="New payee" onPress={add} />}>
      <Row>
        <CircleButton icon={ArrowLeft} label="Go back" onPress={goBack} />
        <Title>Payees</Title>
      </Row>

      <SearchField value={query} onChangeText={setQuery} placeholder="Search payees" label="Search payees" onVoice={() => showToast("Voice search — coming soon")} />

      <Row gap="xs">
        {TYPES.map((t) => (
          <Chip key={t.value} label={t.label} variant={type === t.value ? "cream" : "card"} selected={type === t.value} onPress={() => setType(t.value)} />
        ))}
      </Row>

      {all && payees.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known payees." /> : null}

      {!all ? (
        payees.isError ? (
          <ErrorState message={userMessage(payees.error, "load your payees")} onRetry={() => payees.refetch()} />
        ) : (
          <Stack gap="sm">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} tone="dark" height={68} round="row" />
            ))}
          </Stack>
        )
      ) : items && items.length === 0 ? (
        <EmptyState title={needle ? "No matching payees" : "No payees yet"} message={needle ? undefined : `Create your first ${type} payee.`} />
      ) : (
        // ponytail: every payee is drawn at once (fine for a few hundred); move to a virtualised list (SectionedList) if a user reaches thousands.
        <Stack gap="sm">
          {items?.map((payee) => (
            <SettingsRow
              key={payee.id}
              // Payees have no colour of their own: the name gives a steady one, as an uncoloured category does.
              tile={<IconTile icon={payeeInitial(payee.name)} color={categoryTone(payee.name)} />}
              title={payee.name}
              onPress={() => router.push(`/settings/payee/${payee.id}`)}
            />
          ))}
        </Stack>
      )}
    </Screen>
  );
}
