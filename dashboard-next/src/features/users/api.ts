import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { UserStatus, UsersResponse } from "@/types/api"

export type SortField = "username" | "used_traffic" | "data_limit" | "expire" | "created_at"

export type UsersQuery = {
  offset: number
  limit: number
  search?: string
  status?: string
  /** `field` ascending, `-field` descending — the API's own convention. */
  sort?: string | null
  admin?: string[]
}

export const usersKeys = {
  all: ["users"] as const,
  list: (query: UsersQuery) => [...usersKeys.all, "list", query] as const,
}

export function useUsers(query: UsersQuery) {
  return useQuery({
    queryKey: usersKeys.list(query),
    queryFn: ({ signal }) =>
      api.get<UsersResponse>("/users", {
        signal,
        params: {
          offset: query.offset,
          limit: query.limit,
          search: query.search,
          status: query.status,
          sort: query.sort ?? undefined,
          admin: query.admin,
        },
      }),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}

export function useResetUserUsage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (username: string) => api.post<void>(`/user/${encodeURIComponent(username)}/reset`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
  })
}

export function useSetUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ username, status }: { username: string; status: "active" | "disabled" }) =>
      api.put<void>(`/user/${encodeURIComponent(username)}`, { status }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (username: string) => api.delete<void>(`/user/${encodeURIComponent(username)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
  })
}

/** Human label for a wire status, translated by the caller. */
export function statusLabelKey(status: UserStatus | string): string {
  switch (status) {
    case "active":
    case "connected":
    case "connecting":
      return "status.active"
    case "disabled":
      return "status.disabled"
    case "expired":
      return "status.expired"
    case "limited":
      return "status.limited"
    case "on_hold":
      return "status.on_hold"
    default:
      return "status.unknown"
  }
}
