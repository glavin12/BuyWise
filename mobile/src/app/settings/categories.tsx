import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { userMessage } from "@/lib/api";
import { categoriesQuery } from "@/lib/queries";
import type { CategoryType } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import { Banner, Button, Card, CategoryIcon, EmptyState, ErrorState, Row, Screen, Segmented, Skeleton, Stack, Text } from "@/ui";

const TYPES = [
  { label: "Expense", value: "expense" as CategoryType },
  { label: "Income", value: "income" as CategoryType },
];

export default function CategoriesSettingsScreen() {
  const router = useRouter();
  const [type, setType] = useState<CategoryType>("expense");
  const [refreshing, setRefreshing] = useState(false);
  const categories = useQuery(categoriesQuery(type));
  useRefetchStaleOnFocus();

  const items = categories.data?.categories;

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
    <Screen title="Categories" back onRefresh={refresh} refreshing={refreshing}>
      <Segmented options={TYPES} value={type} onChange={setType} />

      <Button
        title="New category"
        variant="secondary"
        onPress={() => router.push({ pathname: "/settings/category/new", params: { type } })}
      />

      {items && categories.isError ? <Banner tone="warning" message="Couldn't refresh. Showing your last known categories." /> : null}

      {!items ? (
        categories.isError ? (
          <ErrorState message={userMessage(categories.error, "load your categories")} onRetry={() => categories.refetch()} />
        ) : (
          <Stack>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={60} />
            ))}
          </Stack>
        )
      ) : items.length === 0 ? (
        <EmptyState
          title="No categories yet"
          message={`Create your first ${type} category.`}
          actionLabel="New category"
          onAction={() => router.push({ pathname: "/settings/category/new", params: { type } })}
        />
      ) : (
        items.map((category) => (
          <Card
            key={category.id}
            onPress={() => router.push(`/settings/category/${category.id}`)}
            accessibilityLabel={`${category.name}. Tap to edit.`}
          >
            <Row>
              <CategoryIcon name={category.name} icon={category.icon} color={category.color} />
              <Stack grow gap="xs">
                <Text>{category.name}</Text>
              </Stack>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
