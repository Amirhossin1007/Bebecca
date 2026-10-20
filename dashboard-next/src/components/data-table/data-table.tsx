import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type Table as TableInstance,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox, RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[]
  data: TData[] | undefined
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  emptyTitle: string
  emptyBody?: string
  errorTitle?: string
  skeletonRows?: number
  rowCount?: number
  className?: string
  /** Server-side sorting state, when the table sorts through the API. */
  sorting?: SortingState
  onSortingChange?: (updater: Updater<SortingState>) => void
  getRowId?: (row: TData) => string
  /** Opt-in row selection; `rowSelection` is keyed by the row id from `getRowId`. */
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  enableRowSelection?: boolean
  /**
   * Controlled column visibility. Optional so tables that never expose a
   * visibility menu keep letting TanStack own (and hide) the state internally.
   */
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  /**
   * Hands the table instance to the caller, because a menu such as
   * `ViewOptions` has to read and toggle columns from outside the table shell.
   * The v8 instance is stable for the component's lifetime, so this runs once.
   *
   * Chosen over exposing `columnVisibility` only: `ViewOptions` takes the table
   * instance itself, so the instance is the smaller addition — while the
   * controlled visibility props above keep the caller's menu in sync.
   */
  onTableReady?: (table: TableInstance<TData>) => void
}

/**
 * Table shell shared by every list screen: skeleton, empty and error states are
 * handled once so each page only describes its columns.
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading,
  isError,
  onRetry,
  emptyTitle,
  emptyBody,
  errorTitle,
  skeletonRows = 8,
  rowCount,
  className,
  sorting,
  onSortingChange,
  getRowId,
  rowSelection,
  onRowSelectionChange,
  enableRowSelection,
  columnVisibility,
  onColumnVisibilityChange,
  onTableReady,
}: DataTableProps<TData>) {
  const { t } = useTranslation()
  // Only include the state slices the caller actually controls, so a table that
  // never opts into row selection keeps its previous uncontrolled behaviour.
  const tableState: {
    sorting?: SortingState
    rowSelection?: RowSelectionState
    columnVisibility?: VisibilityState
  } = {}
  if (sorting) tableState.sorting = sorting
  if (rowSelection) tableState.rowSelection = rowSelection
  if (columnVisibility) tableState.columnVisibility = columnVisibility
  // TanStack Table v8 owns mutable table state internally; the React Compiler
  // cannot model that, so this hook legitimately opts out of memoisation.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    // Server-sorted tables own the sort state; everything else sorts client-side.
    manualSorting: Boolean(onSortingChange),
    getSortedRowModel: onSortingChange ? undefined : getSortedRowModel(),
    onSortingChange,
    enableRowSelection: enableRowSelection ?? Boolean(onRowSelectionChange),
    onRowSelectionChange,
    onColumnVisibilityChange,
    state: Object.keys(tableState).length > 0 ? tableState : undefined,
  })

  // The instance is stable, so the caller learns about the table exactly once.
  useEffect(() => {
    onTableReady?.(table)
  }, [onTableReady, table])

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
          <RefreshCw className="size-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{errorTitle ?? t("next.table.error")}</p>
          <p className="text-xs text-muted-foreground">{t("next.table.retry")}</p>
        </div>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            {t("next.table.retry")}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn(
      // This wrapper is the only scroll box; shadcn's inner table container must not
      // become a second one, or `position: sticky` on the header would resolve to it.
      "relative max-h-[min(56svh,42rem)] w-full overflow-auto [&>[data-slot=table-container]]:overflow-visible",
      className,
    )}>
      <span role="status" aria-live="polite" className="sr-only">
        {isLoading ? t("next.table.loading") : `${rowCount ?? table.getRowModel().rows.length}`}
      </span>
      <Table aria-busy={isLoading ? true : undefined}>
        <TableHeader className="bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b border-border hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                    }
                    style={{ width: header.getSize() === 150 ? undefined : header.getSize() }}
                    className={cn(
                      // Sticky belongs on the cell: a sticky <thead> is unreliable in Chrome.
                      "sticky top-0 z-10 h-8 border-b border-border bg-card text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground",
                      canSort && "select-none",
                    )}
                  >
                    {header.isPlaceholder ? null : canSort &&
                      typeof header.column.columnDef.header === "string" ? (
                      // Plain string headers keep the lightweight inline sort toggle.
                      // A header that renders a component (e.g. ColumnHeader) owns its
                      // own sort affordance, so wrapping it would nest buttons.
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="-ms-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, index) => (
              <TableRow key={`skeleton-${index}`} className="hover:bg-transparent">
                {table.getVisibleLeafColumns().map((column, columnIndex) => (
                  <TableCell key={`skeleton-cell-${column.id}`} className="py-2.5">
                    <Skeleton className={cn("h-4 rounded-sm", columnIndex === 0 ? "w-32" : "w-16")} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={table.getVisibleLeafColumns().length} className="py-0">
                <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-14 text-center">
                  <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Inbox className="size-4" />
                  </div>
                  <p className="text-sm font-medium">{emptyTitle}</p>
                  {emptyBody ? (
                    <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{emptyBody}</p>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className="group/row border-b border-border/70 transition-colors hover:bg-muted/40 data-[state=selected]:bg-primary/[0.06]"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {typeof rowCount === "number" && !isLoading && !isError ? (
        <span className="sr-only">{rowCount}</span>
      ) : null}
    </div>
  )
}
