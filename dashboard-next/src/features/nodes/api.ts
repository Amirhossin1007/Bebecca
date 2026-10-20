import { useQuery } from "@tanstack/react-query"

import { api, ApiError } from "@/lib/api"
import type { Node } from "@/types/api"

export const nodesKeys = {
  all: ["nodes"] as const,
  list: () => [...nodesKeys.all, "list"] as const,
}

/** 403 (and 401) are settled answers, not transient failures: never retry them. */
export function isForbidden(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 403 || error.status === 401)
  )
}

/**
 * `GET /api/nodes` returns a bare array — no envelope, filters, sorting or
 * pagination — so health is polled on a short interval instead.
 */
export function useNodes() {
  return useQuery({
    queryKey: nodesKeys.list(),
    queryFn: ({ signal }) => api.get<Node[]>("/nodes", { signal }),
    refetchInterval: (query) =>
      isForbidden(query.state.error) ? false : 15_000,
    staleTime: 10_000,
    retry: (failureCount, error) => !isForbidden(error) && failureCount < 2,
  })
}
