import type { ColumnDef } from "@tanstack/react-table"
import { Copy, MoreHorizontal } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ColumnHeader } from "@/components/data-table/column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { useFormat } from "@/lib/use-format"
import type { Service } from "@/types/api"

/** Only a safe, read-only action is offered here: copying the service name. */
function ServiceRowActions({ service }: { service: Service }) {
  const { t } = useTranslation()

  const copyName = async () => {
    try {
      await navigator.clipboard.writeText(service.name)
      toast.success(t("next.toast.copied"))
    } catch {
      toast.error(t("next.toast.copyFailed"))
    }
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground opacity-60 transition-opacity group-hover/row:opacity-100 data-[state=open]:opacity-100"
            aria-label={t("actions")}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => void copyName()}>
            <Copy className="size-4" />
            {t("copy")}
            <span className="ms-auto max-w-28 truncate text-[0.6875rem] text-muted-foreground">{service.name}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function useServiceColumns(): ColumnDef<Service, unknown>[] {
  const { t } = useTranslation()
  const format = useFormat()

  return useMemo<ColumnDef<Service, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => (
          <ColumnHeader column={column} title={t("next.services.columnService")} />
        ),
        size: 340,
        // Services have a fixed server-side order (`created_at DESC, id DESC`).
        enableSorting: false,
        cell: ({ row }) => {
          const service = row.original
          return (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="max-w-[20rem] truncate text-[0.8125rem] font-medium">{service.name}</span>
              {service.description ? (
                <span className="max-w-[20rem] truncate text-[0.6875rem] text-muted-foreground" title={service.description}>
                  {service.description}
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        id: "host_count",
        accessorKey: "host_count",
        header: ({ column }) => (
          <ColumnHeader column={column} title={t("next.services.columnHosts")} />
        ),
        size: 110,
        enableSorting: false,
        cell: ({ row }) => {
          const hosts = row.original.host_count
          if (hosts === 0) {
            return (
              <Badge
                variant="outline"
                className="border-warning/35 bg-warning/10 px-2 py-0.5 text-[0.6875rem] font-medium text-warning"
              >
                {t("services.broken")}
              </Badge>
            )
          }
          return <span className="text-[0.8125rem] font-medium tabular">{format.number(hosts)}</span>
        },
      },
      {
        id: "user_count",
        accessorKey: "user_count",
        header: ({ column }) => (
          <ColumnHeader column={column} title={t("next.services.columnUsers")} />
        ),
        size: 110,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-[0.8125rem] font-medium tabular">{format.number(row.original.user_count)}</span>
        ),
      },
      {
        id: "used_traffic",
        accessorKey: "used_traffic",
        header: ({ column }) => (
          <ColumnHeader column={column} title={t("next.services.columnUsage")} />
        ),
        size: 200,
        enableSorting: false,
        cell: ({ row }) => {
          const used = row.original.used_traffic
          const lifetime = row.original.lifetime_used_traffic
          const ratio = format.ratio(used, lifetime)
          return (
            <div className="flex w-full max-w-[11rem] flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 leading-none">
                <span className="text-[0.8125rem] font-medium tabular">{format.bytes(used)}</span>
                {lifetime > 0 ? (
                  <span className="text-[0.6875rem] text-muted-foreground tabular">{format.bytes(lifetime)}</span>
                ) : null}
              </div>
              {ratio !== null ? <Progress value={ratio * 100} className="h-1.5 bg-muted" /> : null}
            </div>
          )
        },
      },
      {
        id: "usage_coefficient",
        accessorKey: "usage_coefficient",
        header: ({ column }) => (
          <ColumnHeader column={column} title={t("next.services.columnCoefficient")} />
        ),
        size: 110,
        enableSorting: false,
        cell: ({ row }) => {
          const coefficient = row.original.usage_coefficient
          if (coefficient === 1) {
            return <span className="text-[0.75rem] text-muted-foreground">—</span>
          }
          return (
            <span className="inline-flex items-baseline gap-0.5 text-[0.75rem] font-medium tabular">
              <span className="text-muted-foreground">×</span>
              {format.number(coefficient, { maximumFractionDigits: 2 })}
            </span>
          )
        },
      },
      {
        id: "actions",
        header: "",
        size: 44,
        enableSorting: false,
        cell: ({ row }) => <ServiceRowActions service={row.original} />,
      },
    ],
    [t, format],
  )
}
