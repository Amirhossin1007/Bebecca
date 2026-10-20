import type { SortingState } from "@tanstack/react-table"
import { RefreshCw, Search, SlidersHorizontal, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { Num } from "@/components/num"
import { DataTable } from "@/components/data-table/data-table"
import { TablePagination } from "@/components/data-table/table-pagination"
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
import { useUserColumns } from "@/features/users/columns"
import { useUsers } from "@/features/users/api"
import { useFormat } from "@/lib/use-format"
import { cn } from "@/lib/utils"

const STATUS_FILTERS = ["active", "disabled", "limited", "expired", "on_hold"] as const
const SORTABLE = new Set(["username", "used_traffic", "expire", "created_at"])

const BREAKDOWN_ORDER = ["active", "expired", "limited", "on_hold", "disabled"] as const
const BREAKDOWN_TONE: Record<string, string> = {
  active: "bg-success",
  expired: "bg-destructive",
  limited: "bg-warning",
  on_hold: "bg-info",
  disabled: "bg-muted-foreground/45",
}

export function UsersPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const columns = useUserColumns()
  const [params, setParams] = useSearchParams()

  const search = params.get("search") ?? ""
  const status = params.get("status") ?? ""
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0)
  const size = [20, 50, 100].includes(Number(params.get("size"))) ? Number(params.get("size")) : 20
  const sortParam = params.get("sort")

  const [searchInput, setSearchInput] = useState(search)
  const [syncedSearch, setSyncedSearch] = useState(search)

  // When the URL changes from elsewhere (the header search box), adopt it during
  // render — React's supported alternative to a synchronising effect.
  if (search !== syncedSearch) {
    setSyncedSearch(search)
    setSearchInput(search)
  }

  const update = (next: Record<string, string | null>, resetPage = true) => {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") merged.delete(key)
      else merged.set(key, value)
    }
    if (resetPage) merged.delete("page")
    setParams(merged, { replace: true })
  }

  // Debounce typing into the URL, which drives the server query.
  useEffect(() => {
    if (searchInput === search) return
    const timer = setTimeout(() => update({ search: searchInput || null }), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, search])

  const query = useUsers({ offset: page * size, limit: size, search, status, sort: sortParam })
  const data = query.data

  const sorting = useMemo<SortingState>(() => {
    if (!sortParam) return []
    const desc = sortParam.startsWith("-")
    const id = desc ? sortParam.slice(1) : sortParam
    return SORTABLE.has(id) ? [{ id, desc }] : []
  }, [sortParam])

  const onSortingChange = (updater: SortingState | ((old: SortingState) => SortingState)) => {
    const next = typeof updater === "function" ? updater(sorting) : updater
    const first = next[0]
    update({ sort: first ? `${first.desc ? "-" : ""}${first.id}` : null })
  }

  const breakdown = data?.status_breakdown ?? {}
  const total = data?.total ?? 0
  const breakdownTotal = BREAKDOWN_ORDER.reduce((sum, key) => sum + (breakdown[key] ?? 0), 0)
  const hasFilters = Boolean(search || status)

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("next.nav.users")}
        description={t("next.page.users.desc")}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={cn("size-3.5", query.isFetching && "animate-spin")} />
            {t("refresh")}
          </Button>
        }
      />

      {/* Summary band: totals, status distribution and traffic in one dense card. */}
      <Card className="overflow-hidden">
        <CardContent className="grid gap-5 p-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,12rem)] md:items-center md:gap-7 md:divide-x md:divide-border">
          <div className="md:pe-7">
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {t("next.stat.total")}
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              {query.isPending ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <span className="text-2xl font-semibold tracking-tight tabular">{format.number(total)}</span>
              )}
              {data?.users_limit ? (
                <span className="text-[0.75rem] text-muted-foreground tabular">
                  / {format.number(data.users_limit)}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
              {t("next.stat.online")}:{" "}
              <span className="font-medium text-foreground tabular">
                {format.number(data?.online_total ?? 0)}
              </span>
            </p>
          </div>

          <div className="md:px-7">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {t("usersStatusBreakdown")}
              </span>
              <span className="text-[0.6875rem] text-muted-foreground tabular">
                {format.number(breakdownTotal)}
              </span>
            </div>
            {query.isPending ? (
              <Skeleton className="h-1.5 w-full rounded-full" />
            ) : (
              <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted">
                {BREAKDOWN_ORDER.map((key) => {
                  const count = breakdown[key] ?? 0
                  if (!count) return null
                  return (
                    <span
                      key={key}
                      className={cn("h-full first:rounded-s-full last:rounded-e-full", BREAKDOWN_TONE[key])}
                      style={{ width: `${(count / Math.max(breakdownTotal, 1)) * 100}%` }}
                      title={`${t(`status.${key}`)}: ${count}`}
                    />
                  )
                })}
              </div>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              {BREAKDOWN_ORDER.map((key) => (
                <span key={key} className="inline-flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", BREAKDOWN_TONE[key])} />
                  {t(`status.${key}`)}
                  <span className="font-medium text-foreground tabular">{format.number(breakdown[key] ?? 0)}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="md:ps-7">
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {t("next.stat.traffic")}
            </span>
            <div className="mt-1.5">
              {query.isPending ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <Num className="text-2xl font-semibold tracking-tight">
                  {format.bytes(data?.usage_total ?? 0)}
                </Num>
              )}
            </div>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">{t("next.users.remaining")}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("next.users.searchPlaceholder")}
              className="h-8 pe-8 ps-8 text-[0.8125rem]"
              aria-label={t("next.users.searchPlaceholder")}
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={t("next.users.clear")}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <Select
            value={status || "all"}
            onValueChange={(value) => update({ status: value === "all" ? null : value })}
          >
            <SelectTrigger size="sm" className="h-8 w-36 gap-1.5 text-[0.75rem]">
              <SlidersHorizontal className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder={t("next.users.allStatuses")} />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">{t("next.users.allStatuses")}</SelectItem>
              {STATUS_FILTERS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-[0.75rem] text-muted-foreground"
              onClick={() => {
                setSearchInput("")
                setParams({}, { replace: true })
              }}
            >
              <X className="size-3.5" />
              {t("next.users.clear")}
            </Button>
          ) : null}


        </div>

        <DataTable
          columns={columns}
          data={data?.users}
          isLoading={query.isPending}
          isError={query.isError}
          onRetry={() => query.refetch()}
          emptyTitle={t("next.users.emptyTitle")}
          emptyBody={t("next.users.emptyBody")}
          errorTitle={t("next.users.errorTitle")}
          sorting={sorting}
          onSortingChange={onSortingChange}
          getRowId={(row) => String(row.id)}
          skeletonRows={size > 20 ? 12 : 8}
        />

        <TablePagination
          page={page}
          pageSize={size}
          total={total}
          disabled={query.isFetching}
          onPageChange={(next) => update({ page: String(Math.max(0, next)) }, false)}
          onPageSizeChange={(next) => {
            const merged = new URLSearchParams(params)
            merged.set("size", String(next))
            merged.delete("page")
            setParams(merged, { replace: true })
          }}
        />
      </Card>
    </div>
  )
}
