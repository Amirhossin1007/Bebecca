import type { SortingState } from "@tanstack/react-table"
import { CircleDot, RefreshCw, ShieldAlert, ShieldCheck, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { DataTable } from "@/components/data-table/data-table"
import { TablePagination } from "@/components/data-table/table-pagination"
import { SearchField } from "@/components/search-field"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { isAdminsForbidden, useAdmins } from "@/features/admins/api"
import { useAdminColumns } from "@/features/admins/columns"
import { useFormat } from "@/lib/use-format"
import { cn } from "@/lib/utils"

const ROLE_FILTERS = ["standard", "reseller", "sudo", "full_access"] as const
const STATUS_FILTERS = ["active", "disabled"] as const
// The endpoint sorts server-side; `username` is not in its whitelist.
const SORTABLE = new Set(["role", "status", "users_count", "users_usage", "expire"])

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
    <div>
      <span className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-1.5">
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <span className="text-2xl font-semibold tracking-tight tabular">{value}</span>
        )}
      </div>
      {hint ? <p className="mt-1 text-[0.6875rem] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Friendly state for admins without permission to view the admin list (403). */
function NoPermissionState() {
  const { t } = useTranslation()
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-2.5 px-6 py-16 text-center">
        <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <ShieldAlert className="size-4" />
        </div>
        <p className="text-sm font-medium">{t("admins.noPermission")}</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{t("next.admins.emptyBody")}</p>
      </CardContent>
    </Card>
  )
}

export function AdminsPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const columns = useAdminColumns()
  const [params, setParams] = useSearchParams()

  const search = params.get("search") ?? ""
  const matchCase = params.get("match_case") === "1"
  const matchWholeWord = params.get("match_whole_word") === "1"
  const role = params.get("role") ?? ""
  const status = params.get("status") ?? ""
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0)
  const size = [20, 50, 100].includes(Number(params.get("size"))) ? Number(params.get("size")) : 20
  const sortParam = params.get("sort")

  const [searchInput, setSearchInput] = useState(search)
  const [syncedSearch, setSyncedSearch] = useState(search)

  // Adjust the input during render when the URL changes from elsewhere.
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

  const query = useAdmins({
    offset: page * size,
    limit: size,
    username: search,
    role,
    status,
    sort: sortParam,
  })
  const data = query.data
  const forbidden = isAdminsForbidden(query.error)

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

  const summary = useMemo(() => {
    const admins = data?.admins ?? []
    return {
      total: data?.total ?? 0,
      fullAccess: admins.filter((admin) => admin.role === "full_access").length,
      sudo: admins.filter((admin) => admin.role === "sudo").length,
      traffic: admins.reduce((sum, admin) => sum + admin.users_usage, 0),
    }
  }, [data])

  const total = data?.total ?? 0
  const hasFilters = Boolean(search || role || status)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("next.nav.admins")}
        description={t("next.page.admins.desc")}
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

      {forbidden ? (
        <NoPermissionState />
      ) : (
        <>
          {/* Summary band: totals plus role/traffic figures for the current page. */}
          <Card className="overflow-hidden">
            <CardContent className="grid gap-5 p-4 sm:grid-cols-2 md:grid-cols-4 md:items-center md:gap-0 md:divide-x md:divide-border">
              <div className="md:pe-6">
                <SummaryStat
                  label={t("next.admins.total")}
                  value={format.number(summary.total)}
                  loading={query.isPending}
                />
              </div>
              <div className="md:px-6">
                <SummaryStat
                  label={t("next.role.full_access")}
                  value={format.number(summary.fullAccess)}
                  hint={t("next.stat.thisPage")}
                  loading={query.isPending}
                />
              </div>
              <div className="md:px-6">
                <SummaryStat
                  label={t("next.role.sudo")}
                  value={format.number(summary.sudo)}
                  hint={t("next.stat.thisPage")}
                  loading={query.isPending}
                />
              </div>
              <div className="md:ps-6">
                <SummaryStat
                  label={t("next.stat.traffic")}
                  value={format.bytes(summary.traffic)}
                  hint={t("next.stat.thisPage")}
                  loading={query.isPending}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5">
              <SearchField
                value={searchInput}
                onChange={setSearchInput}
                placeholder={t("next.admins.searchPlaceholder")}
                matchCase={matchCase}
                matchWholeWord={matchWholeWord}
                loading={query.isFetching && !query.isPending}
                onMatchChange={(next) => {
                  if (next.matchCase !== undefined) update({ match_case: next.matchCase ? "1" : null })
                  if (next.matchWholeWord !== undefined)
                    update({ match_whole_word: next.matchWholeWord ? "1" : null })
                }}
              />

              <Select
                value={role || "all"}
                onValueChange={(value) => update({ role: value === "all" ? null : value })}
              >
                <SelectTrigger size="sm" className="h-8 w-40 gap-1.5 text-[0.75rem]">
                  <ShieldCheck className="size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">{t("next.admins.allRoles")}</SelectItem>
                  {ROLE_FILTERS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`next.role.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={status || "all"}
                onValueChange={(value) => update({ status: value === "all" ? null : value })}
              >
                <SelectTrigger size="sm" className="h-8 w-36 gap-1.5 text-[0.75rem]">
                  <CircleDot className="size-3.5 text-muted-foreground" />
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

              <span className="ms-auto text-[0.6875rem] text-muted-foreground tabular">
                {data ? t("next.users.showing", {
                  from: format.number(total === 0 ? 0 : page * size + 1),
                  to: format.number(Math.min(total, (page + 1) * size)),
                  total: format.number(total),
                }) : null}
              </span>
            </div>

            <DataTable
              columns={columns}
              data={data?.admins}
              isLoading={query.isPending}
              isError={query.isError}
              onRetry={() => query.refetch()}
              emptyTitle={t("next.admins.emptyTitle")}
              emptyBody={t("next.admins.emptyBody")}
              errorTitle={t("next.table.error")}
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
        </>
      )}
    </div>
  )
}
