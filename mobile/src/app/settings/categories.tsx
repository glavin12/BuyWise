import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { categoriesQuery } from "@/lib/queries";
import type { CategoryType } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import { Banner, CategoryTile, Chip, CircleButton, EmptyState, ErrorState, Fab, goBack, Row, Screen, SettingsRow, Skeleton, Stack, Title } from "@/ui";

// Categories, in the Activity look: back and title, Expense / Income chips, one row per category (its
// tile in its colour and icon, its name) and the marigold + for a new one. Tapping a row edits it.

const TYPES = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
] as const;

export default function CategoriesSettingsScreen() {
  const router = useRouter();
  const [type, setType] = useState<CategoryType>("expense");
  const [refreshing, setRefreshing] = useState(false);
  const categories = useQuery(categoriesQuery(type));
  useRefetchStaleOnFocus();

  const items = categories.data?.categories;
  const add = () => router.push({ pathname: "/settings/category/new", params: { type } });

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await categories.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen surface="screen" onRefresh={refresh} refreshing={refreshing} fab={<Fab label="New category" onPress={add} />}>
      <Row>
        <CircleButton icon={ArrowLeft} label="Go back" onPress={goBack} />
        <Title>Categories</Title>
      </Row>

      <Row gap="xs">
        {TYPES.map((t) => (
          <Chip key={t.value} label={t.label} variant={type === t.value ? "cream" : "card"} selected={type === t.value} onPress={() => setType(t.value)} />
        ))}
      </Row>

      {items && categories.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known categories." /> : null}

      {!items ? (
        categories.isError ? (
          <ErrorState message={userMessage(categories.error, "load your categories")} onRetry={() => categories.refetch()} />
        ) : (
          <Stack gap="sm">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} tone="dark" height={68} round="row" />
            ))}
          </Stack>
        )
      ) : items.length === 0 ? (
        <EmptyState title="No categories yet" message={`Create your first ${type} category.`} actionLabel="New category" onAction={add} />
      ) : (
        <Stack gap="sm">
          {items.map((category) => (
            <SettingsRow
              key={category.id}
              tile={<CategoryTile name={category.name} color={category.color} icon={category.icon} />}
              title={category.name}
              onPress={() => router.push(`/settings/category/${category.id}`)}
            />
          ))}
        </Stack>
      )}
    </Screen>
  );
}
