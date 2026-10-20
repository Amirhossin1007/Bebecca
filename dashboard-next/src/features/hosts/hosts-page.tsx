import { Search, ShieldAlert, SlidersHorizontal, X } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { DataTable } from "@/components/data-table/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { isForbidden, useHosts } from "@/features/hosts/api"
import { useHostColumns, type HostRow } from "@/features/hosts/columns"
import { useFormat } from "@/lib/use-format"

type EnabledFilter = "all" | "enabled" | "disabled"

/** One column of the summary band: uppercase label, headline value, quiet hint. */
function SummaryStat({
  label,
  value,
  hint,
  loading,
}: {
  label: string
  value: string
  hint?: string
  loading?: boolean
}) {
  return (
    <div className="min-w-0 md:px-5 md:first:ps-0 md:last:pe-0">
      <span className="text-[0.6875rem] font-medium tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </span>
      <div className="mt-1.5">
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <span className="tabular text-2xl font-semibold tracking-tight">
            {value}
          </span>
        )}
      </div>
      {hint ? (
        <p className="tabular mt-1 truncate text-[0.6875rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Calm, informational replacement for the screen when the API answers 403. */
function PermissionNotice({ message }: { message: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-2.5 px-6 py-14 text-center">
        <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <ShieldAlert className="size-4" />
        </div>
        <p className="max-w-sm text-[0.8125rem] leading-relaxed text-muted-foreground">
          {message}
        </p>
      </CardContent>
    </Card>
  )
}

export function HostsPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const columns = useHostColumns()
  const query = useHosts()

  const [search, setSearch] = useState("")
  const [stateFilter, setStateFilter] = useState<EnabledFilter>("all")

  const data = query.data
  const loading = query.isPending
  const failed = query.isError
  const forbidden = isForbidden(query.error)

  // One row per host, tagged with the inbound it belongs to.
  const rows = useMemo<HostRow[]>(() => {
    if (!data) return []
    return Object.entries(data).flatMap(([inboundTag, hosts]) =>
      hosts.map((host) => ({ inboundTag, host }))
    )
  }, [data])

  const inboundTags = useMemo(() => Object.keys(data ?? {}).length, [data])
  const active = rows.filter((row) => !row.host.is_disabled).length
  const disabled = rows.length - active

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter(({ host }) => {
      if (stateFilter === "enabled" && host.is_disabled) return false
      if (stateFilter === "disabled" && !host.is_disabled) return false
      if (!needle) return true
      return [host.remark, host.address, host.sni].some((value) =>
        value?.toLowerCase().includes(needle)
      )
    })
  }, [rows, search, stateFilter])

  const hasFilters = search.trim().length > 0 || stateFilter !== "all"
  const empty = (value: string) => (failed ? "—" : value)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("next.nav.hosts")}
        description={t("next.page.hosts.desc")}
      />

      {forbidden ? (
        <PermissionNotice message={t("hostsPage.noPermission")} />
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardContent className="grid gap-5 p-4 sm:grid-cols-2 md:grid-cols-4 md:items-start md:gap-0 md:divide-x md:divide-border">
              <SummaryStat
                label={t("next.nav.hosts")}
                value={empty(format.number(rows.length))}
                loading={loading}
              />
              <SummaryStat
                label={t("next.stat.active")}
                value={empty(format.number(active))}
                loading={loading}
              />
              <SummaryStat
                label={t("status.disabled")}
                value={empty(format.number(disabled))}
                loading={loading}
              />
              <SummaryStat
                label={t("hostsPage.tabInbounds")}
                value={empty(format.number(inboundTags))}
                loading={loading}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5">
              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("next.hosts.searchPlaceholder")}
                  className="h-8 ps-8 pe-8 text-[0.8125rem]"
                  aria-label={t("next.hosts.searchPlaceholder")}
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={t("next.users.clear")}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>

              <Select
                value={stateFilter}
                onValueChange={(value) =>
                  setStateFilter(
                    value === "enabled" || value === "disabled" ? value : "all"
                  )
                }
              >
                <SelectTrigger
                  size="sm"
                  className="h-8 w-36 gap-1.5 text-[0.75rem]"
                >
                  <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All hosts" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">
                    {t("next.hosts.allHosts")}
                  </SelectItem>
                  <SelectItem value="enabled">
                    {t("hostsPage.enabled")}
                  </SelectItem>
                  <SelectItem value="disabled">
                    {t("status.disabled")}
                  </SelectItem>
                </SelectContent>
              </Select>

              {hasFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-[0.75rem] text-muted-foreground"
                  onClick={() => {
                    setSearch("")
                    setStateFilter("all")
                  }}
                >
                  <X className="size-3.5" />
                  {t("next.users.clear")}
                </Button>
              ) : null}

              {loading || failed ? null : (
                <span className="tabular ms-auto text-[0.6875rem] text-muted-foreground">
                  {format.number(filtered.length)} {t("next.common.of")}{" "}
                  {format.number(rows.length)}
                </span>
              )}
            </div>

            <DataTable
              columns={columns}
              data={filtered}
              isLoading={loading}
              isError={failed}
              onRetry={() => query.refetch()}
              emptyTitle={t("next.hosts.emptyTitle")}
              emptyBody={t("next.hosts.emptyBody")}
              getRowId={(row) => `${row.inboundTag}-${row.host.id}`}
            />
          </Card>
        </>
      )}
    </div>
  )
}
