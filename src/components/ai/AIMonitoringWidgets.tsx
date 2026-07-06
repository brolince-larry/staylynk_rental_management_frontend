import React from 'react'
import { Activity, AlertTriangle, Gauge, ShieldAlert, Timer, Zap } from 'lucide-react'
import { SectionCard } from '@/components/ui'
import type { AIMonitoringData } from '@/features/superadmin/layout/hooks/useDashboard'

interface Props {
  stats?: AIMonitoringData | null
  loading?: boolean
}

export default function AIMonitoringWidgets({ stats, loading = false }: Props): React.ReactElement {
  const circuitOpen = stats?.circuit_open === true

  const rows = [
    {
      label: 'Total Requests',
      value: formatCount(stats?.total_requests),
      icon: Activity,
      tone: 'text-amber-600 bg-amber-100 dark:bg-amber-950/40',
    },
    {
      label: 'Blocked Requests',
      value: formatCount(stats?.blocked_requests),
      icon: ShieldAlert,
      tone: (stats?.blocked_requests ?? 0) > 0
        ? 'text-red-600 bg-red-100 dark:bg-red-950/40'
        : 'text-slate-500 bg-slate-100 dark:bg-slate-800/40',
      badge: (stats?.blocked_requests ?? 0) > 0,
    },
    {
      label: 'Low Confidence',
      value: formatCount(stats?.low_confidence),
      icon: Gauge,
      tone: 'text-sky-600 bg-sky-100 dark:bg-sky-950/40',
    },
    {
      label: 'Cache Hit Rate',
      value: formatPercent(stats?.cache_hit_rate),
      icon: Zap,
      tone: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40',
    },
    {
      label: 'Avg Response',
      value: formatMs(stats?.avg_response_ms),
      icon: Timer,
      tone: 'text-violet-600 bg-violet-100 dark:bg-violet-950/40',
    },
    {
      label: 'Circuit',
      value: circuitOpen ? '🔴 Open' : '🟢 Closed',
      icon: Activity,
      tone: circuitOpen
        ? 'text-red-600 bg-red-100 dark:bg-red-950/40'
        : 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40',
    },
  ]

  return (
    <SectionCard title="AI Monitoring">
      {/* Circuit-open warning banner */}
      {circuitOpen && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/30">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">AI Circuit Breaker is Open</p>
            <p className="text-xs text-red-600 dark:text-red-400">
              The AI model circuit is open — requests are being blocked to prevent cascading failures.
              {stats?.circuit_open_at ? ` Opened at ${new Date(stats.circuit_open_at).toLocaleString()}.` : ''}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {rows.map(({ label, value, icon: Icon, tone, badge }) => (
          <div key={label} className={`rounded-xl border p-3 ${badge ? 'border-red-200 bg-red-50/60 dark:border-red-900/30 dark:bg-red-950/20' : 'border-border bg-muted/20'}`}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 text-xs font-medium text-muted-foreground">{label}</span>
            </div>
            {loading ? (
              <div className="h-5 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <p className={`text-lg font-extrabold tracking-tight ${badge ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                {value}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Counters are Redis-based and accumulate from deployment. They reset if Redis is flushed — this is expected for operational monitoring.
      </p>
    </SectionCard>
  )
}

function formatCount(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—'
}

function formatPercent(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  const normalized = value <= 1 ? value * 100 : value
  return `${normalized.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
}

function formatMs(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value).toLocaleString()} ms` : '—'
}
