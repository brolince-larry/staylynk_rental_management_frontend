// src/components/ui/index.tsx
import React, { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'

// ─── StatCard ─────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: ReactNode
  iconBg?: string
  loading?: boolean
  footer?: ReactNode
  /** Tailwind border color class for the left accent, e.g. 'border-violet-500' */
  accentBorder?: string
  /** Tailwind bg class for the background glow, e.g. 'bg-violet-500' */
  accentGlow?: string
}

export function StatCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  iconBg = 'bg-violet-50 dark:bg-violet-950/40',
  loading = false,
  footer,
  accentBorder,
  accentGlow,
}: StatCardProps): React.ReactElement {
  const safeValue  = Number.isNaN(value) ? '—' : value
  const safeChange = typeof change === 'number' && Number.isFinite(change) ? change : undefined
  const isUp   = safeChange !== undefined && safeChange > 0
  const isDown = safeChange !== undefined && safeChange < 0

  if (loading) {
    return (
      <div className={clsx('app-card rounded-xl p-5 relative overflow-hidden', accentBorder && `border-l-[3px] ${accentBorder}`)}>
        <div className="mb-3 flex items-center justify-between">
          <div className="h-2.5 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="h-8 w-28 rounded-lg bg-muted animate-pulse mb-2" />
        <div className="h-2.5 w-16 rounded-full bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <div className={clsx(
      'app-card rounded-xl p-5 relative overflow-hidden transition-all duration-200 hover:shadow-md group',
      accentBorder && `border-l-[3px] ${accentBorder}`,
    )}>
      {/* Decorative glow behind icon */}
      {accentGlow && (
        <div className={clsx('pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.09] blur-2xl dark:opacity-[0.14] transition-opacity duration-300 group-hover:opacity-[0.14]', accentGlow)} />
      )}

      {/* Label row */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <p className="text-[1.85rem] font-bold tabular-nums tracking-tight text-foreground leading-none">
        {safeValue}
      </p>

      {/* Change indicator */}
      {(safeChange !== undefined || changeLabel) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {safeChange !== undefined && (
            <span className={clsx(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[0.72rem] font-semibold',
              isUp
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                : isDown
                ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                : 'bg-muted text-muted-foreground',
            )}>
              {isUp   && <TrendingUp   className="h-3 w-3 shrink-0" />}
              {isDown && <TrendingDown className="h-3 w-3 shrink-0" />}
              {!isUp && !isDown && <Minus className="h-3 w-3 shrink-0" />}
              {isUp ? '+' : ''}{safeChange}%
            </span>
          )}
          {changeLabel && (
            <span className="text-[0.72rem] text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      )}

      {footer && <div className="mt-3">{footer}</div>}
    </div>
  )
}

// ─── StatusBadge ──────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  active:       'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/50',
  paid:         'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/50',
  confirmed:    'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/50',
  checked_in:   'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800/50',
  pending:      'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/50',
  overdue:      'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800/50',
  suspended:    'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800/50',
  cancelled:    'bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50',
  checked_out:  'bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50',
  terminated:   'bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50',
  expired:      'bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50',
  draft:        'bg-slate-100 text-slate-600 border-slate-200/80',
  maintenance:  'bg-orange-50 text-orange-700 border-orange-200/80',
  trial:        'bg-blue-50 text-blue-700 border-blue-200/80',
  void:         'bg-slate-100 text-slate-500 border-slate-200/80',
  no_show:      'bg-slate-100 text-slate-500 border-slate-200/80',
  resolved:     'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  open:         'bg-amber-50 text-amber-700 border-amber-200/80',
  in_progress:  'bg-blue-50 text-blue-700 border-blue-200/80',
}

const STATUS_LABELS: Record<string, string> = {
  checked_in:  'Checked In',
  checked_out: 'Checked Out',
  no_show:     'No Show',
  in_progress: 'In Progress',
}

interface BadgeProps {
  status?: string | null
  className?: string
}

export function StatusBadge({ status, className }: BadgeProps): React.ReactElement {
  const key   = typeof status === 'string' && status.trim().length > 0 ? status.trim() : 'unknown'
  const style = STATUS_STYLES[key] ?? 'bg-slate-100 text-slate-600 border-slate-200/80'
  const label = STATUS_LABELS[key] ??
    key.split(/[_\s-]+/).filter(Boolean)
       .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
       .join(' ')

  return (
    <span className={clsx(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-[0.72rem] font-medium leading-none',
      style,
      className,
    )}>
      {label}
    </span>
  )
}

// ─── ProgressBar ──────────────────────────────────────────────────────────
interface ProgressBarProps {
  value: number
  className?: string
  color?: string
  showLabel?: boolean
}

export function ProgressBar({
  value,
  className,
  color = 'bg-primary',
  showLabel = false,
}: ProgressBarProps): React.ReactElement {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && (
        <span className="w-9 text-right text-[0.72rem] tabular-nums text-muted-foreground">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  )
}

// ─── SectionCard ──────────────────────────────────────────────────────────
interface SectionCardProps {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  padding?: boolean
  contentClassName?: string
}

export function SectionCard({
  title,
  action,
  children,
  className,
  padding = true,
  contentClassName,
}: SectionCardProps): React.ReactElement {
  return (
    <div className={clsx('app-card overflow-hidden rounded-xl', className)}>
      <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-muted/30 to-transparent px-5 py-3.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action && <div className="text-xs text-muted-foreground">{action}</div>}
      </div>
      <div className={clsx(padding ? 'p-5' : '', contentClassName)}>{children}</div>
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground/40">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── SkeletonTable ────────────────────────────────────────────────────────
export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }): React.ReactElement {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-3.5 rounded-full bg-muted animate-pulse"
              style={{ flex: j === 0 ? '1.5' : '1' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── PageHeader ───────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  /** @deprecated Pass a subtitle instead — emoji in headings reduces the premium feel */
  emoji?: string
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps): React.ReactElement {
  return (
    <div className="mb-6 flex flex-col gap-3 pt-1.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.5rem] font-bold tracking-tight text-foreground sm:text-[1.625rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
}

// ─── ViewAllLink ──────────────────────────────────────────────────────────
interface ViewAllProps {
  to?: string
  onClick?: () => void
  label?: string
}

export function ViewAllLink({ to, onClick, label = 'View all' }: ViewAllProps): React.ReactElement {
  const cls = 'inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/75'
  if (to) {
    return (
      <Link to={to} className={cls}>
        {label}
        <ArrowRight className="h-3 w-3" />
      </Link>
    )
  }
  return (
    <button onClick={onClick} className={cls}>
      {label}
      <ArrowRight className="h-3 w-3" />
    </button>
  )
}

// ─── ActivityItem ─────────────────────────────────────────────────────────
interface ActivityItemProps {
  icon: ReactNode
  iconBg?: string
  title: string
  subtitle?: string
  time: string
}

export function ActivityItem({
  icon,
  iconBg = 'bg-violet-50 dark:bg-violet-950/40',
  title,
  subtitle,
  time,
}: ActivityItemProps): React.ReactElement {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className={clsx(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs',
        iconBg,
      )}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.8rem] font-medium leading-snug text-foreground">{title}</p>
        {subtitle && (
          <p className="mt-0.5 truncate text-[0.72rem] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <span className="shrink-0 text-[0.7rem] text-muted-foreground">{time}</span>
    </div>
  )
}
