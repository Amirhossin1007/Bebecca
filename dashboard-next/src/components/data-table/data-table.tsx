import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Updater,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox, RefreshCw } from "lucide-react"
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
}: DataTableProps<TData>) {
  const { t } = useTranslation()
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
    state: sorting ? { sorting } : undefined,
  })

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
    <div className={cn("relative w-full overflow-x-auto", className)}>
      <span role="status" aria-live="polite" className="sr-only">
        {isLoading ? t("next.table.loading") : `${rowCount ?? table.getRowModel().rows.length}`}
      </span>
      <Table aria-busy={isLoading ? true : undefined}>
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b border-border hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() === 150 ? undefined : header.getSize() }}
                    className={cn(
                      "h-9 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground",
                      canSort && "select-none",
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
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
                {columns.map((_column, columnIndex) => (
                  <TableCell key={`skeleton-cell-${columnIndex}`} className="py-2.5">
                    <Skeleton className={cn("h-4 rounded-sm", columnIndex === 0 ? "w-32" : "w-16")} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-0">
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
              <TableRow key={row.id} className="group/row border-b border-border/70 transition-colors hover:bg-muted/40">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-2.5 align-middle">
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
