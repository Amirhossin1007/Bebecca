import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { ServicesResponse } from "@/types/api"

export type ServicesQuery = {
  offset: number
  limit: number
  /** Case-insensitive substring match on the service name. */
  name?: string
}

export const servicesKeys = {
  all: ["services"] as const,
  list: (query: ServicesQuery) => [...servicesKeys.all, "list", query] as const,
}

export function useServices(query: ServicesQuery) {
  return useQuery({
    queryKey: servicesKeys.list(query),
    queryFn: ({ signal }) =>
      // `GET /api/v2/services` — there is no `/api/services` (§6.1 of the contract).
      api.get<ServicesResponse>("/v2/services", {
        signal,
        params: {
          offset: query.offset,
          limit: query.limit,
          name: query.name,
        },
      }),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}
