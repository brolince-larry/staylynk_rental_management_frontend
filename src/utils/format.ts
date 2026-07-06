// src/utils/format.ts
// Centralised formatters — no inline formatting in components

import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'

// ─── Currency ─────────────────────────────────────────────────────────────
export function formatCurrency(
  amount: number,
  currency = 'USD',
  opts?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    ...opts,
  }).format(amount)
}

export function formatCurrencyCompact(amount: number, currency = 'USD'): string {
  if (amount >= 1_000_000) {
    return formatCurrency(amount / 1_000_000, currency, { maximumFractionDigits: 1 }) + 'M'
  }
  if (amount >= 1_000) {
    return formatCurrency(amount / 1_000, currency, { maximumFractionDigits: 1 }) + 'K'
  }
  return formatCurrency(amount, currency, { maximumFractionDigits: 0 })
}

// ─── Dates ────────────────────────────────────────────────────────────────
export function formatDate(iso: string, pattern = 'MMM d, yyyy'): string {
  try {
    const d = parseISO(iso)
    return isValid(d) ? format(d, pattern) : '—'
  } catch {
    return '—'
  }
}

export function formatDateShort(iso: string): string {
  return formatDate(iso, 'MMM d, yyyy')
}

export function formatDatetime(iso: string): string {
  return formatDate(iso, 'MMM d, yyyy h:mm a')
}

export function formatMonthYear(iso: string): string {
  return formatDate(iso, 'MMMM yyyy')
}

export function formatRelative(iso: string): string {
  try {
    const d = parseISO(iso)
    return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '—'
  } catch {
    return '—'
  }
}

export function formatYearMonth(iso: string): string {
  // Handles both "2025-06" and full ISO strings
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const [year, month] = iso.split('-')
    return format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy')
  }
  return formatDate(iso, 'MMMM yyyy')
}

// ─── Numbers ──────────────────────────────────────────────────────────────
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatPercent(n: number | string | null | undefined, decimals = 1): string {
  const value = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(value) ? `${value.toFixed(decimals)}%` : '—'
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Status labels ────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  checked_in:   'Checked In',
  checked_out:  'Checked Out',
  no_show:      'No Show',
  in_progress:  'In Progress',
  partially_paid: 'Partial',
}

export function formatStatus(status?: string | null): string {
  const normalizedStatus = typeof status === 'string' && status.trim().length > 0
    ? status.trim()
    : 'unknown'
  return STATUS_LABELS[normalizedStatus] ??
    normalizedStatus
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
}

// ─── File size ────────────────────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(2)} MB`
  if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(1)} KB`
  return `${bytes} B`
}
