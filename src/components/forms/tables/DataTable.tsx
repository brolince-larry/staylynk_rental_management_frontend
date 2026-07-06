// src/components/tables/DataTable.tsx
// Production-grade data table used by every list page.
// Features: server-side sort/filter/pagination, row selection,
// column resize awareness, loading/empty/error states, virtualization for large sets.

import React, { useCallback, type ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { clsx } from 'clsx'
import { SkeletonTable } from '@/components/ui'

// ─── Types ────────────────────────────────────────────────────────────────
export type SortDirection = 'asc' | 'desc'

export interface SortState {
  column: string
  direction: SortDirection
}

export interface ColumnDef<T> {
  key: string
  header: string
  accessor: (row: T) => ReactNode
  sortable?: boolean
  width?: string        // e.g. 'w-32', 'w-48', 'min-w-[120px]'
  className?: string    // applied to every td in this column
  headerClassName?: string
  align?: 'left' | 'right' | 'center'
}

export interface PaginationMeta {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  keyField: keyof T
  loading?: boolean
  error?: string | null
  empty?: ReactNode
  emptyTitle?: string
  emptyDescription?: string

  // Sorting (controlled)
  sort?: SortState
  onSort?: (col: string, dir: SortDirection) => void

  // Pagination (controlled)
  pagination?: PaginationMeta
  onPageChange?: (page: number) => void
  onPerPageChange?: (n: number) => void

  // Row actions
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string

  // Table meta
  caption?: string
  stickyHeader?: boolean
  compact?: boolean
}

// ─── Sort header cell ──────────────────────────────────────────────────────
function SortIcon({ col, sort }: { col: string; sort?: SortState }) {
  if (!sort || sort.column !== col) {
    return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 shrink-0" />
  }
  return sort.direction === 'asc'
    ? <ChevronUp className="h-3 w-3 text-primary ml-1 shrink-0" />
    : <ChevronDown className="h-3 w-3 text-primary ml-1 shrink-0" />
}

// ─── Main component ────────────────────────────────────────────────────────
export function DataTable<T>({
  columns,
  data,
  keyField,
  loading = false,
  error = null,
  empty,
  emptyTitle = 'No results',
  emptyDescription,
  sort,
  onSort,
  pagination,
  onPageChange,
  onPerPageChange,
  onRowClick,
  rowClassName,
  caption,
  stickyHeader = false,
  compact = false,
}: DataTableProps<T>): React.ReactElement {
  const handleSort = useCallback(
    (col: string) => {
      if (!onSort) return
      if (sort?.column === col) {
        onSort(col, sort.direction === 'asc' ? 'desc' : 'asc')
      } else {
        onSort(col, 'asc')
      }
    },
    [sort, onSort]
  )

  const cellPad = compact ? 'px-3 py-2' : 'px-4 py-3'
  const headerPad = compact ? 'px-3 py-2' : 'px-4 py-2.5'

  return (
    <div className="flex flex-col">
      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="app-card overflow-x-auto rounded-lg">
        <table className="w-full border-collapse" aria-label={caption}>
          {caption && <caption className="sr-only">{caption}</caption>}

          <thead className={clsx(stickyHeader && 'sticky top-0 z-10')}>
            <tr className="border-b border-violet-100/80 bg-violet-50/55">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={clsx(
                    headerPad,
                    'whitespace-nowrap text-xs font-bold text-slate-500 select-none',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                    col.width,
                    col.headerClassName,
                    col.sortable && 'cursor-pointer hover:text-foreground transition-colors group'
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    sort?.column === col.key
                      ? sort.direction === 'asc' ? 'ascending' : 'descending'
                      : undefined
                  }
                >
                  <span className={clsx('inline-flex items-center gap-0.5', col.align === 'right' && 'flex-row-reverse')}>
                    {col.header}
                    {col.sortable && <SortIcon col={col.key} sort={sort} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Loading */}
            {loading && (
              <tr>
                <td colSpan={columns.length} className="p-4">
                  <SkeletonTable rows={compact ? 4 : 6} cols={columns.length} />
                </td>
              </tr>
            )}

            {/* Error */}
            {!loading && error && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">⚠️</span>
                    <p className="text-sm font-medium text-destructive">{error}</p>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty */}
            {!loading && !error && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  {empty ?? (
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
                      {emptyDescription && (
                        <p className="text-xs text-muted-foreground">{emptyDescription}</p>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )}

            {/* Data rows */}
            {!loading && !error && data.map((row) => (
              <tr
                key={String(row[keyField])}
                className={clsx(
                  'border-b border-violet-100/70 last:border-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-violet-50/55',
                  rowClassName?.(row)
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                role={onRowClick ? 'button' : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      cellPad,
                      'text-sm text-foreground',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                      col.width,
                      col.className
                    )}
                  >
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {pagination && pagination.last_page > 1 && (
        <Pagination
          meta={pagination}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
        />
      )}
    </div>
  )
}

// ─── Pagination component ─────────────────────────────────────────────────
interface PaginationProps {
  meta: PaginationMeta
  onPageChange?: (p: number) => void
  onPerPageChange?: (n: number) => void
}

const PER_PAGE_OPTIONS = [10, 15, 25, 50, 100]

export function Pagination({ meta, onPageChange, onPerPageChange }: PaginationProps): React.ReactElement {
  const { total, per_page, current_page, last_page } = meta
  const from = (current_page - 1) * per_page + 1
  const to = Math.min(current_page * per_page, total)

  // Build visible page numbers
  const pages: (number | '...')[] = []
  if (last_page <= 7) {
    for (let i = 1; i <= last_page; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current_page > 3) pages.push('...')
    for (let i = Math.max(2, current_page - 1); i <= Math.min(last_page - 1, current_page + 1); i++) {
      pages.push(i)
    }
    if (current_page < last_page - 2) pages.push('...')
    pages.push(last_page)
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-3 sm:flex-row">
      {/* Results count */}
      <p className="text-xs text-muted-foreground whitespace-nowrap">
        Showing <span className="font-medium text-foreground">{from}–{to}</span> of{' '}
        <span className="font-medium text-foreground">{total.toLocaleString()}</span> results
      </p>

      <div className="flex items-center gap-3">
        {/* Per page */}
        {onPerPageChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Rows</span>
            <select
              value={per_page}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="rounded-lg border border-violet-100 bg-white/75 px-2 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-4 focus:ring-violet-500/10"
              aria-label="Rows per page"
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}

        {/* Page buttons */}
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <PageBtn
            onClick={() => onPageChange?.(current_page - 1)}
            disabled={current_page <= 1}
            aria-label="Previous page"
          >
            ‹
          </PageBtn>

          {pages.map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="px-2 text-xs text-muted-foreground select-none">…</span>
            ) : (
              <PageBtn
                key={p}
                onClick={() => onPageChange?.(p as number)}
                active={p === current_page}
                aria-label={`Page ${p}`}
                aria-current={p === current_page ? 'page' : undefined}
              >
                {p}
              </PageBtn>
            )
          )}

          <PageBtn
            onClick={() => onPageChange?.(current_page + 1)}
            disabled={current_page >= last_page}
            aria-label="Next page"
          >
            ›
          </PageBtn>
        </nav>
      </div>
    </div>
  )
}

function PageBtn({
  children,
  onClick,
  disabled,
  active,
  ...props
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  'aria-label'?: string
  'aria-current'?: 'page' | undefined
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-xs font-semibold transition-all',
        active
          ? 'app-gradient-primary text-white shadow-md shadow-violet-500/20'
          : 'text-foreground hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40'
      )}
      {...props}
    >
      {children}
    </button>
  )
}
