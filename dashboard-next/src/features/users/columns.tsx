import type { ColumnDef } from "@tanstack/react-table"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Checkbox } from "@/components/ui/checkbox"
import { UserStatusBadge } from "@/features/users/user-status-badge"
import { UserRowActions } from "@/features/users/user-row-actions"
import { UsageMeter } from "@/features/users/usage-meter"
import { useFormat } from "@/lib/use-format"
import { cn } from "@/lib/utils"
import type { UserListItem } from "@/types/api"

function initials(username: string): string {
  const clean = username.replace(/[^\p{L}\p{N}]+/gu, " ").trim()
  if (!clean) return "?"
  const parts = clean.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function useUserColumns(): ColumnDef<UserListItem, unknown>[] {
  const { t } = useTranslation()
  const format = useFormat()

  return useMemo<ColumnDef<UserListItem, unknown>[]>(
    () => [
      // Selection lives in TanStack Table's `rowSelection` state, owned by the
      // page. The header toggles every row currently loaded (this page's rows
      // only — the table never holds more than the server page).
      {
        id: "select",
        size: 32,
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
            aria-label={t("next.users.selectAll")}
            className="translate-y-px"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            aria-label={t("next.users.selectRow", { username: row.original.username })}
            className="translate-y-px"
          />
        ),
      },
      {
        id: "username",
        accessorKey: "username",
        header: t("next.users.columnUser"),
        size: 300,
        cell: ({ row }) => {
          const user = row.original
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative shrink-0">
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-md border text-[0.6875rem] font-semibold uppercase",
                    user.is_online
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-border bg-muted/50 text-muted-foreground",
                  )}
                >
                  {initials(user.username)}
                </span>
                {user.is_online ? (
                  <span className="absolute -end-0.5 -bottom-0.5 size-2 rounded-full bg-success ring-2 ring-card" />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[0.8125rem] font-medium leading-tight">{user.username}</span>
                <span className="truncate text-[0.6875rem] leading-tight text-muted-foreground tabular">
                  #{format.number(user.id)}
                  {user.service_name ? <span className="mx-1 opacity-50">·</span> : null}
                  {user.service_name}
                </span>
              </span>
            </div>
          )
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("next.users.columnStatus"),
        size: 110,
        enableSorting: false,
        cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
      },
      {
        id: "used_traffic",
        accessorKey: "used_traffic",
        header: t("next.users.columnUsage"),
        size: 190,
        cell: ({ row }) => (
          <UsageMeter used={row.original.used_traffic} limit={row.original.data_limit} />
        ),
      },
      {
        id: "expire",
        accessorKey: "expire",
        header: t("next.users.columnExpiry"),
        size: 140,
        cell: ({ row }) => {
          const expire = row.original.expire
          const days = format.daysLeft(expire)
          return (
            <div className="flex flex-col leading-tight">
              <span className="text-[0.8125rem] tabular">{format.expiry(expire, t("unlimited"))}</span>
              <span
                className={cn(
                  "text-[0.6875rem] tabular",
                  days !== null && days <= 0
                    ? "text-destructive"
                    : days !== null && days <= 3
                      ? "text-warning"
                      : "text-muted-foreground",
                )}
              >
                {days === null ? t("next.users.noExpiry") : days <= 0 ? t("next.users.expired") : t("next.users.daysLeft", { days: format.number(days) })}
              </span>
            </div>
          )
        },
      },
      {
        id: "service",
        accessorKey: "service_name",
        header: t("next.users.columnService"),
        size: 130,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="truncate text-[0.75rem] text-muted-foreground">
            {row.original.service_name ?? "—"}
          </span>
        ),
      },
      {
        id: "admin",
        accessorKey: "admin_username",
        header: t("next.users.columnOwner"),
        size: 120,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="truncate text-[0.75rem] text-muted-foreground">
            {row.original.admin_username ?? "—"}
          </span>
        ),
      },
      {
        id: "created_at",
        accessorKey: "created_at",
        header: t("next.users.columnCreated"),
        size: 120,
        cell: ({ row }) => (
          <span className="text-[0.75rem] text-muted-foreground tabular">
            {format.date(row.original.created_at, "date")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 44,
        enableSorting: false,
        cell: ({ row }) => <UserRowActions user={row.original} />,
      },
    ],
    [t, format],
  )
}
