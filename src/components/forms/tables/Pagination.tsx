// src/components/tables/Pagination.tsx
// Server-side pagination control with ellipsis, per-page selector,
// and results count. Extracted from DataTable for standalone use.

import React, { type ReactNode } from 'react'
import { clsx } from 'clsx'

export interface PaginationMeta {
  total:        number
  per_page:     number
  current_page: number
  last_page:    number
}

interface PaginationProps {
  meta:             PaginationMeta
  onPageChange?:    (page: number) => void
  onPerPageChange?: (n: number) => void
  className?:       string
}

const PER_PAGE_OPTIONS = [10, 15, 25, 50, 100]

export function Pagination({
  meta,
  onPageChange,
  onPerPageChange,
  className,
}: PaginationProps): React.ReactElement {
  const { total, per_page, current_page, last_page } = meta
  const from = (current_page - 1) * per_page + 1
  const to   = Math.min(current_page * per_page, total)

  // Build visible page numbers with ellipsis
  const pages: (number | '...')[] = []

  if (last_page <= 7) {
    for (let i = 1; i <= last_page; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current_page > 3) pages.push('...')
    for (
      let i = Math.max(2, current_page - 1);
      i <= Math.min(last_page - 1, current_page + 1);
      i++
    ) {
      pages.push(i)
    }
    if (current_page < last_page - 2) pages.push('...')
    pages.push(last_page)
  }

  return (
    <div className={clsx(
      'flex flex-col sm:flex-row items-center justify-between gap-3 pt-3',
      className
    )}>
      {/* Results count */}
      <p className="text-xs text-muted-foreground whitespace-nowrap">
        Showing{' '}
        <span className="font-medium text-foreground">{from}–{to}</span>
        {' '}of{' '}
        <span className="font-medium text-foreground">{total.toLocaleString()}</span>
        {' '}results
      </p>

      <div className="flex items-center gap-3">
        {/* Per page selector */}
        {onPerPageChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Rows</span>
            <select
              value={per_page}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
              <span
                key={`ellipsis-${i}`}
                className="px-2 text-xs text-muted-foreground select-none"
              >
                …
              </span>
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

// ─── Page button ──────────────────────────────────────────────────────────
interface PageBtnProps {
  children:     ReactNode
  onClick?:     () => void
  disabled?:    boolean
  active?:      boolean
  'aria-label'?:   string
  'aria-current'?: 'page' | undefined
}

function PageBtn({
  children,
  onClick,
  disabled,
  active,
  ...props
}: PageBtnProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex h-7 min-w-[28px] items-center justify-center rounded-md px-1.5',
        'text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed'
      )}
      {...props}
    >
      {children}
    </button>
  )
}