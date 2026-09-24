import { Redirect } from "expo-router";

// The centre tab button opens the quick-add modal itself (see (tabs)/_layout).
// This route only exists so the tab has a slot; landing on it by any other
// path (e.g. a deep link) is forwarded to the modal.
export default function AddTab() {
  return <Redirect href="/add-transaction" />;
}
