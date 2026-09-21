export const TRANSACTION_UPDATED_EVENT = "buywise:transaction-updated";

export function emitTransactionUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TRANSACTION_UPDATED_EVENT));
  }
}
