import { queryOptions } from "@tanstack/react-query";

import { api } from "./api";

// Shared by the Dashboard, Settings and the post-signup provisioning call.
// GET /profile creates the profile on first read and the backend does not guard
// that insert against a race, so every caller must go through this one key:
// React Query then sends a single request and everyone shares the result.
export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: () => api.getProfile(),
  staleTime: 10 * 60_000,
});
