import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { TYPE_LABEL } from "@/lib/labels";
import { payeesQuery } from "@/lib/queries";
import type { CategoryType } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import { Banner, Button, Card, EmptyState, ErrorState, Input, Row, Screen, Segmented, Skeleton, Stack, Text } from "@/ui";

const TYPES = [
  { label: "Expense", value: "expense" as CategoryType },
  { label: "Income", value: "income" as CategoryType },
];

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
    <Screen title="Payees" back onRefresh={refresh} refreshing={refreshing}>
      <Segmented options={TYPES} value={type} onChange={setType} />
      <Input label="Search payees" value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />

      <Button
        title="New payee"
        variant="secondary"
        onPress={() => router.push({ pathname: "/settings/payee/new", params: { type } })}
      />

      {all && payees.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known payees." /> : null}

      {!all ? (
        payees.isError ? (
          <ErrorState message={userMessage(payees.error, "load your payees")} onRetry={() => payees.refetch()} />
        ) : (
          <Stack>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={44} />
            ))}
          </Stack>
        )
      ) : items && items.length === 0 ? (
        <EmptyState title={needle ? "No matching payees" : "No payees yet"} message={needle ? undefined : `Create your first ${type} payee.`} />
      ) : (
        items?.map((payee) => (
          <Card key={payee.id} onPress={() => router.push(`/settings/payee/${payee.id}`)} accessibilityLabel={`${payee.name}. Tap to edit.`}>
            <Row justify="between">
              <Text numberOfLines={1}>{payee.name}</Text>
              <Text variant="caption" tone="muted">
                {TYPE_LABEL[payee.type]}
              </Text>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
