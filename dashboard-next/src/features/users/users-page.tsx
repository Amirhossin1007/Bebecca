import type { RowSelectionState, SortingState } from "@tanstack/react-table"
import { Columns3, Download, RefreshCw, Search, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Num } from "@/components/num"
import { DataTable } from "@/components/data-table/data-table"
import { TablePagination } from "@/components/data-table/table-pagination"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  useBulkUsersAction,
  useResetUsersUsage,
  useUserAdminOptions,
  useUserServiceOptions,
  useUsers,
  type BulkUsersAction,
} from "@/features/users/api"
import { BulkActionBar } from "@/features/users/bulk-action-bar"
import { useUserColumns } from "@/features/users/columns"
import { downloadUsersCsv } from "@/features/users/export-csv"
import {
  ActiveFilterChips,
  UsersFilters,
  type UserFilterDraft,
  type UserFilterKey,
} from "@/features/users/users-filters"
import { useCurrentAdmin } from "@/features/auth/api"
import { ApiError, errorMessage } from "@/lib/api"
import { useFormat } from "@/lib/use-format"
import { cn } from "@/lib/utils"
import type { Admin } from "@/types/api"

const SORTABLE = new Set(["username", "used_traffic", "expire", "created_at"])
const STATUS_VALUES = new Set(["active", "disabled", "limited", "expired", "on_hold"])

const VISIBILITY_COLUMNS = [
  { id: "service", labelKey: "next.users.columnService" },
  { id: "admin", labelKey: "next.users.columnOwner" },
  { id: "created_at", labelKey: "next.users.columnCreated" },
] as const
type VisibilityColumnId = (typeof VISIBILITY_COLUMNS)[number]["id"]

function isVisibilityColumn(id: string | undefined): id is VisibilityColumnId {
  return id === "service" || id === "admin" || id === "created_at"
}

function canViewAdmins(admin: Admin | null): boolean {
  if (!admin) return false
  if (admin.role === "full_access") return true
  const permissions = admin.permissions as
    | { admin_management?: { can_view?: boolean } }
    | undefined
  return permissions?.admin_management?.can_view === true
}

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
  const currentAdmin = useCurrentAdmin()

  // The URL is the single source of truth for filters so a view is shareable:
  // `service` maps to the API's `service_id`, and the match options are stored
  // as `1` or absent. Selection is separate component state and never in the URL.
  const search = params.get("search") ?? ""
  const statusParam = params.get("status") ?? ""
  const status = STATUS_VALUES.has(statusParam) ? statusParam : ""
  const admin = params.get("admin") ?? ""
  const serviceParam = params.get("service") ?? ""
  const serviceNumber = Number(serviceParam)
  const service =
    serviceParam && Number.isInteger(serviceNumber) && serviceNumber > 0 ? serviceParam : ""
  const matchCase = params.get("match_case") === "1"
  const matchWholeWord = params.get("match_whole_word") === "1"
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0)
  const size = [20, 50, 100].includes(Number(params.get("size"))) ? Number(params.get("size")) : 20
  const sortParam = params.get("sort")

  const [searchInput, setSearchInput] = useState(search)
  const [syncedSearch, setSyncedSearch] = useState(search)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<Record<VisibilityColumnId, boolean>>({
    service: true,
    admin: true,
    created_at: true,
  })

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

  const sessionReady = Boolean(currentAdmin)
  const canFilterByAdmin = canViewAdmins(currentAdmin)
  const adminsQuery = useUserAdminOptions(sessionReady && canFilterByAdmin)
  const servicesQuery = useUserServiceOptions(sessionReady)
  const serviceOptions = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data])
  const servicesForbidden =
    servicesQuery.error instanceof ApiError && servicesQuery.error.status === 403
  const showAdmin = canFilterByAdmin && !adminsQuery.isError
  const showService = !servicesForbidden

  const query = useUsers({
    offset: page * size,
    limit: size,
    search,
    status,
    sort: sortParam,
    admin: admin ? [admin] : undefined,
    serviceId: service ? serviceNumber : undefined,
    matchCase,
    matchWholeWord,
  })
  const data = query.data
  const rows = useMemo(() => data?.users ?? [], [data])

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

  // Selection is page-local: every query change drops it, and a page change is
  // part of the signature, so a selection can never leak across pages. The
  // signature is tracked as state and adjusted during render — the same React
  // pattern used above for the search box — instead of in an effect.
  const selectionSignature = [
    search,
    status,
    admin,
    service,
    matchCase,
    matchWholeWord,
    page,
    size,
    sortParam ?? "",
  ].join("\u241f")
  const [syncedSelectionSignature, setSyncedSelectionSignature] = useState(selectionSignature)
  if (selectionSignature !== syncedSelectionSignature) {
    setSyncedSelectionSignature(selectionSignature)
    setRowSelection({})
  }

  const selectedUsernames = useMemo(
    () =>
      rows
        .filter((user) => rowSelection[String(user.id)])
        .map((user) => user.username),
    [rows, rowSelection],
  )

  const bulkUsers = useBulkUsersAction()
  const resetUsers = useResetUsersUsage()
  const bulkPending = bulkUsers.isPending || resetUsers.isPending

  const runBulk = (action: BulkUsersAction) => {
    if (selectedUsernames.length === 0) return
    const usernames = [...selectedUsernames]
    bulkUsers.mutate(
      { action, usernames },
      {
        onSuccess: (result) => {
          toast.success(t("usersTable.bulkActionCount", { count: result?.count ?? usernames.length }))
          setRowSelection({})
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  const runBulkReset = () => {
    if (selectedUsernames.length === 0) return
    const usernames = [...selectedUsernames]
    resetUsers.mutate(usernames, {
      onSuccess: () => {
        toast.success(t("usersTable.bulkActionCount", { count: usernames.length }))
        setRowSelection({})
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  const activeFilterCount =
    (status ? 1 : 0) + (admin ? 1 : 0) + (service ? 1 : 0) + (matchCase ? 1 : 0) + (matchWholeWord ? 1 : 0)
  const filterDraft: UserFilterDraft = { status, admin, service }

  const applyFilters = (draft: UserFilterDraft) => {
    update({ status: draft.status || null, admin: draft.admin || null, service: draft.service || null })
  }

  const onMatchChange = (key: "match_case" | "match_whole_word", value: boolean) => {
    update({ [key]: value ? "1" : null })
  }

  const removeFilter = (key: UserFilterKey) => {
    if (key === "search") setSearchInput("")
    update({ [key]: null })
  }

  const clearAllFilters = () => {
    setSearchInput("")
    update({
      search: null,
      status: null,
      admin: null,
      service: null,
      match_case: null,
      match_whole_word: null,
    })
  }

  const serviceName = useMemo(
    () => serviceOptions.find((option) => String(option.id) === service)?.name,
    [serviceOptions, service],
  )

  const visibleColumns = useMemo(
    () =>
      columns.filter(
        (column) => !isVisibilityColumn(column.id) || columnVisibility[column.id],
      ),
    [columns, columnVisibility],
  )

  const breakdown = data?.status_breakdown ?? {}
  const total = data?.total ?? 0
  const breakdownTotal = BREAKDOWN_ORDER.reduce((sum, key) => sum + (breakdown[key] ?? 0), 0)

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
              className="pe-8 ps-8"
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

          <UsersFilters
            draft={filterDraft}
            activeCount={activeFilterCount}
            matchCase={matchCase}
            matchWholeWord={matchWholeWord}
            admins={adminsQuery.data ?? []}
            services={serviceOptions}
            showAdmin={showAdmin}
            showService={showService}
            onApply={applyFilters}
            onClear={clearAllFilters}
            onMatchChange={onMatchChange}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                disabled={rows.length === 0}
                onClick={() => downloadUsersCsv(rows, `users-page-${page + 1}.csv`)}
              >
                <Download className="size-3.5" />
                {t("next.users.exportCsv")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("next.users.exportCsvHint", { count: rows.length })}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" aria-label={t("next.users.toggleColumns")}>
                <Columns3 className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {VISIBILITY_COLUMNS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={columnVisibility[column.id]}
                  onCheckedChange={(checked) =>
                    setColumnVisibility((current) => ({ ...current, [column.id]: checked === true }))
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {t(column.labelKey)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ActiveFilterChips
          search={search}
          status={status}
          admin={admin}
          service={service}
          serviceName={serviceName}
          matchCase={matchCase}
          matchWholeWord={matchWholeWord}
          onRemove={removeFilter}
          onClearAll={clearAllFilters}
        />

        <BulkActionBar
          count={selectedUsernames.length}
          isPending={bulkPending}
          onClear={() => setRowSelection({})}
          onResetUsage={runBulkReset}
          onActivate={() => runBulk("activate_users")}
          onDisable={() => runBulk("disable_users")}
          onDelete={() => runBulk("delete_users")}
        />

        <DataTable
          columns={visibleColumns}
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
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          enableRowSelection
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
