import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { ApiError, api } from "@/lib/api"
import type { AdminsResponse } from "@/types/api"

export type AdminsQuery = {
  offset: number
  limit: number
  /** Fuzzy match over the admin username. */
  username?: string
  /** `standard` | `reseller` | `sudo` | `full_access`. */
  role?: string
  /** `active` | `disabled`. */
  status?: string
  /** `field` ascending, `-field` descending — the API's own convention. */
  sort?: string | null
}

export const adminsKeys = {
  all: ["admins"] as const,
  list: (query: AdminsQuery) => [...adminsKeys.all, "list", query] as const,
}

export function useAdmins(query: AdminsQuery) {
  return useQuery({
    queryKey: adminsKeys.list(query),
    queryFn: ({ signal }) =>
      api.get<AdminsResponse>("/admins", {
        signal,
        params: {
          offset: query.offset,
          limit: query.limit,
          username: query.username,
          role: query.role,
          status: query.status,
          sort: query.sort ?? undefined,
        },
      }),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    // A 403 is a stable permission outcome, not a transient failure: surface it
    // immediately so the page can render its friendly no-permission state.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 403) && failureCount < 2,
  })
}

/** True when the list failed because the signed-in admin may not view admins. */
export function isAdminsForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403
}
