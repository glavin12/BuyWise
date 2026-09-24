import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";

import { formatCurrency, formatDate } from "@/lib/format";
import { METHOD_LABEL, TYPE_LABEL } from "@/lib/labels";
import type { Transaction } from "@/lib/types";

import { Amount } from "./Amount";
import { Row, Stack } from "./Layout";
import { Text } from "./Text";
import { theme } from "./theme";

/**
 * One ledger line: payee (or a dash), category and method, the amount with its
 * sign, and the description clamped to two lines. Memoised: long lists re-render
 * often and a row only changes when its own transaction does.
 */
export const TransactionRow = memo(function TransactionRow({
  tx,
  onPress,
  fallbackCurrency = "INR",
}: {
  tx: Transaction;
  onPress?: (id: string) => void;
  fallbackCurrency?: string;
}) {
  const startingBalance = tx.transaction_type === "starting_balance";
  const title = startingBalance ? TYPE_LABEL.starting_balance : tx.payee || "—";
  const subtitle = [tx.category, tx.payment_method ? METHOD_LABEL[tx.payment_method] : null].filter(Boolean).join(" · ");
  const currency = tx.currency || fallbackCurrency;
  // Expenses are negative and income positive: shown with a sign as well as colour.
  const value = tx.transaction_type === "expense" ? -tx.display_amount : tx.display_amount;
  const spoken = `${title}, ${subtitle || "no category"}, ${TYPE_LABEL[tx.transaction_type]} ${formatCurrency(tx.display_amount, currency)}, ${formatDate(tx.transaction_date, "medium")}`;

  return (
    <Pressable
      onPress={onPress ? () => onPress(tx.id) : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={spoken}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Row justify="between" align="start" gap="md">
        <Stack gap="xs" grow>
          <Text numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {tx.description ? (
            <Text variant="caption" tone="muted" numberOfLines={2}>
              {tx.description}
            </Text>
          ) : null}
        </Stack>
        <Amount value={value} currency={currency} signed={!startingBalance} />
      </Row>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: theme.minHit, justifyContent: "center", paddingVertical: theme.space.sm },
  pressed: { opacity: 0.6 },
});
