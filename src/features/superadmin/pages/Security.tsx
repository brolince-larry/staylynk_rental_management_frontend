// src/features/superadmin/pages/Security.tsx
import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { toast } from 'sonner'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  useSecurityDashboard, useSecurityEvents, useSecurityThreats,
  useSecurityHeatmap, useSecurityBruteForce, useSecurityRiskyUsers,
  useSecurityCategoryStats, useBlockIP, useResolveSecurityEvent,
  useTraceSecurityEvent, useSuspendUser,
} from '../hooks/useSecurity'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { FilterBar, SearchInput, Select, Modal, Button, FormField, Input } from '@/components/forms'
import { PageHeader, SectionCard } from '@/components/ui'
import { formatDatetime, formatRelative } from '@/utils/format'
import { useBodyScrollLock, useDebounce, usePagination, useToast } from '@/hooks'
import { useRealtime } from '@/providers/realtimeContext'
import { useAuthStore } from '@/store/auth.store'
import type { SecurityEvent, BruteForceEntry, RiskyUser, CategoryStat, HeatmapCell, TraceEventData } from '@/api/security'
import { AlertTriangle, Loader2, Mail, MapPin, Monitor, Search, ShieldAlert, ShieldOff, UserX, Wifi, RefreshCw } from 'lucide-react'

// ── Risk level styling ────────────────────────────────────────────────────
const RISK_BADGE: Record<string, string> = {
  low:      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  medium:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 animate-pulse',
}

const CATEGORY_COLORS: Record<string, string> = {
  Auth: '#8b5cf6', Payment: '#f59e0b', API: '#3b82f6',
  Input: '#ef4444', File: '#10b981', Admin: '#f97316',
}

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({
  label, value, color, loading,
}: { label: string; value?: number; color: string; loading: boolean }): React.ReactElement {
  const colorMap: Record<string, string> = {
    amber:  'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    red:    'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    orange: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800',
  }
  const textMap: Record<string, string> = {
    amber:  'text-amber-700 dark:text-amber-400',
    red:    'text-red-700 dark:text-red-400',
    orange: 'text-orange-700 dark:text-orange-400',
  }
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] ?? colorMap.amber}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-current opacity-10" />
      ) : (
        <p className={`mt-1 text-3xl font-bold tabular-nums ${textMap[color] ?? textMap.amber}`}>
          {value?.toLocaleString() ?? '—'}
        </p>
      )}
    </div>
  )
}

// ── Risk score bar ────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }): React.ReactElement {
  const clamp = Math.min(100, Math.max(0, score))
  const bg = clamp >= 80 ? 'bg-red-500' : clamp >= 60 ? 'bg-orange-500' : clamp >= 40 ? 'bg-yellow-500' : 'bg-slate-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${bg}`} style={{ width: `${clamp}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">{clamp}</span>
    </div>
  )
}

// ── Event type badge ──────────────────────────────────────────────────────
function EventTypeBadge({ type }: { type: string }): React.ReactElement {
  return (
    <span className="inline-flex max-w-[160px] truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono dark:bg-slate-800">
      {type}
    </span>
  )
}

// ── Heatmap ───────────────────────────────────────────────────────────────
function AttackHeatmap({ cells, loading }: { cells: HeatmapCell[]; loading: boolean }): React.ReactElement {
  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />
  if (!cells.length) return <p className="py-8 text-center text-sm text-muted-foreground">No heatmap data.</p>

  const dates      = [...new Set(cells.map((c) => c.date))].sort()
  const eventTypes = [...new Set(cells.map((c) => c.event_type))]
  const maxCount   = Math.max(...cells.map((c) => c.count), 1)

  const lookup: Record<string, number> = {}
  cells.forEach((c) => { lookup[`${c.date}|${c.event_type}`] = c.count })

  const intensity = (n: number) => {
    if (!n) return 'bg-slate-100 dark:bg-slate-800'
    const pct = n / maxCount
    if (pct < 0.25) return 'bg-orange-200 dark:bg-orange-900/40'
    if (pct < 0.5)  return 'bg-orange-400 dark:bg-orange-700/60'
    if (pct < 0.75) return 'bg-red-500 dark:bg-red-700'
    return 'bg-red-700 dark:bg-red-500'
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Date labels */}
        <div className="mb-1 ml-32 grid text-[10px] text-muted-foreground"
          style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
          {dates.map((d, i) => (
            <span key={d} className={`truncate text-center ${i % 7 === 0 ? 'font-medium' : 'opacity-0'}`}>
              {d.slice(5)}
            </span>
          ))}
        </div>
        {/* Grid */}
        {eventTypes.map((et) => (
          <div key={et} className="mb-0.5 flex items-center gap-1">
            <span className="w-32 shrink-0 truncate text-right text-[10px] text-muted-foreground pr-2">{et}</span>
            <div className="grid flex-1 gap-0.5"
              style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
              {dates.map((d) => {
                const n = lookup[`${d}|${et}`] ?? 0
                return (
                  <div key={d} title={`${et} — ${d}: ${n}`}
                    className={`aspect-square rounded-sm ${intensity(n)}`} />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Attacker Intel Modal ──────────────────────────────────────────────────
function AttackerIntelModal({
  eventId,
  onClose,
}: {
  eventId: number | null
  onClose: () => void
}): React.ReactElement | null {
  const { data, isLoading, isError } = useTraceSecurityEvent(eventId)
  const { mutate: blockIP,  isPending: blocking  } = useBlockIP()
  const { mutate: suspend,  isPending: suspending } = useSuspendUser()
  const { toasts, success, error: toastErr } = useToast()

  useBodyScrollLock(eventId !== null)

  if (!eventId) return null

  const intel = data as TraceEventData | undefined

  const handleBlockIp = () => {
    if (!intel?.event.ip_hash) return
    blockIP({ ip_address: intel.event.ip_hash, reason: 'Blocked via attacker trace', type: 'permanent' }, {
      onSuccess: () => success('IP permanently blocked'),
      onError: (e) => toastErr(e, 'Failed to block IP'),
    })
  }

  const handleSuspend = () => {
    if (!intel?.account?.id) return
    suspend(intel.account.id, {
      onSuccess: () => success(`${intel.account?.email} suspended`),
      onError: (e) => toastErr(e, 'Failed to suspend user'),
    })
  }

  const LEVEL_COLOR: Record<string, string> = {
    low: 'text-slate-500', medium: 'text-yellow-600', high: 'text-orange-600', critical: 'text-red-600',
  }

  return (
    <>
      {toasts.map(t => (
        <div key={t.id} className={`fixed bottom-4 right-4 z-[300] rounded-lg px-4 py-3 text-sm shadow-lg text-white ${t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {t.title}
        </div>
      ))}
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <div
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/40">
                <Search className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Attacker Intelligence</p>
                <p className="text-xs text-muted-foreground">Event #{eventId} · Score ≥ 75</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">✕</button>
          </div>

          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Aggregating threat intelligence…</p>
            </div>
          )}

          {isError && (
            <div className="p-8 text-center">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
              <p className="text-sm text-muted-foreground">Could not load trace data. Event may have score &lt; 75.</p>
            </div>
          )}

          {intel && (
            <div className="p-5 space-y-5">
              {/* Risk summary banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Max Score', value: intel.risk_summary.max_score, color: intel.risk_summary.max_score >= 80 ? 'text-red-600' : 'text-orange-600' },
                  { label: 'Total Events', value: intel.risk_summary.total_event_count },
                  { label: 'Unique Endpoints', value: intel.risk_summary.unique_endpoints },
                  { label: 'Distinct Attack Types', value: intel.risk_summary.unique_event_types },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-center">
                    <p className={`text-xl font-bold ${s.color ?? 'text-foreground'}`}>{s.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Account profile */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <UserX className="h-3.5 w-3.5 text-red-500" /> Known Account
                  </p>
                  {intel.account ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium text-foreground">{intel.account.name}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium text-foreground break-all">{intel.account.email}</span></div>
                      {intel.account.phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium text-foreground">{intel.account.phone}</span></div>}
                      <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-medium capitalize text-foreground">{intel.account.role ?? '—'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Org</span><span className="font-medium text-foreground">{intel.account.org ?? '—'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                        <span className={`font-semibold capitalize ${intel.account.status === 'suspended' ? 'text-red-500' : 'text-emerald-600'}`}>{intel.account.status}</span>
                      </div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Last Login</span><span className="text-foreground">{intel.account.last_login_at ? formatRelative(intel.account.last_login_at) : 'Never'}</span></div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Unauthenticated — no account linked to this event.</p>
                  )}
                </div>

                {/* Network & Device */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-blue-500" /> Network & Device
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">IP Address</span>
                      <span className="font-mono font-medium text-foreground text-right break-all">{intel.raw_ip ?? 'Not available (hashed only)'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">IP Hash</span>
                      <span className="font-mono text-[10px] text-muted-foreground text-right">{intel.event.ip_hash ? intel.event.ip_hash.slice(0, 24) + '…' : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IP Blocked</span>
                      <span className={`font-semibold ${intel.ip_blocked ? 'text-red-500' : 'text-emerald-600'}`}>{intel.ip_blocked ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Device Blocked</span>
                      <span className={`font-semibold ${intel.device_blocked ? 'text-red-500' : 'text-emerald-600'}`}>{intel.device_blocked ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">First Seen</span><span className="text-foreground">{formatDatetime(intel.risk_summary.first_seen)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Last Seen</span><span className="text-foreground">{formatDatetime(intel.risk_summary.last_seen)}</span></div>
                  </div>
                </div>
              </div>

              {/* Associated emails */}
              {intel.associated_emails.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-amber-500" /> Emails Used from This IP ({intel.associated_emails.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {intel.associated_emails.map(email => (
                      <span key={email} className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Endpoints targeted */}
              {intel.risk_summary.endpoints_targeted.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5 text-violet-500" /> Endpoints Targeted
                  </p>
                  <div className="space-y-1">
                    {intel.risk_summary.endpoints_targeted.map(ep => (
                      <div key={ep} className="rounded-lg bg-muted/50 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">{ep}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Event timeline */}
              {intel.ip_events.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> Event Timeline from This IP ({intel.ip_events.length})
                  </p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {intel.ip_events.map(e => (
                      <div key={e.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-2">
                        <span className={`shrink-0 text-[10px] font-bold uppercase ${LEVEL_COLOR[e.risk_level] ?? 'text-muted-foreground'}`}>{e.risk_level}</span>
                        <span className="flex-1 truncate font-mono text-[11px] text-foreground">{e.event_type}</span>
                        {e.event_count > 1 && <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">×{e.event_count}</span>}
                        <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{e.risk_score}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatDatetime(e.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  variant="destructive"
                  size="sm"
                  loading={blocking}
                  disabled={!intel.event.ip_hash || intel.ip_blocked}
                  onClick={handleBlockIp}
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  {intel.ip_blocked ? 'IP Already Blocked' : 'Block IP Permanently'}
                </Button>
                {intel.account && intel.account.status !== 'suspended' && (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={suspending}
                    onClick={handleSuspend}
                    className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                  >
                    <UserX className="h-3.5 w-3.5" />
                    Suspend {intel.account.email}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Live threat feed (Reverb) ─────────────────────────────────────────────
interface LiveEvent {
  event_type: string
  level: string
  score: number
  label: string
  ip?: string
  endpoint?: string
  user_id?: number
  timestamp: string
}

function ThreatsTab(): React.ReactElement {
  const { data, isLoading, refetch, isFetching } = useSecurityThreats()
  const { mutate: resolve, isPending: resolving } = useResolveSecurityEvent()
  const { token } = useAuthStore()
  const { subscribePrivate } = useRealtime()
  const [traceId, setTraceId] = useState<number | null>(null)
  const [live, setLive] = useState<LiveEvent[]>([])

  useEffect(() => {
    if (!token) return
    return subscribePrivate<LiveEvent>('security.alerts', '.threat.detected', (event) => {
      setLive((prev) => [event, ...prev].slice(0, 50))

      if (event.level === 'critical') {
        toast.error(`🚨 ${event.label} — ${event.ip ?? 'Unknown IP'}`, {
          duration: 8000,
          style: { background: '#ef4444', color: '#fff', width: '100%' },
        })
      } else {
        toast.warning(`⚠️ ${event.label} — ${event.endpoint ?? event.event_type}`, {
          duration: 5000,
        })
      }
    })
  }, [token, subscribePrivate])

  const rows = (data?.data ?? []) as SecurityEvent[]

  const columns: ColumnDef<SecurityEvent>[] = [
    {
      key: 'created_at', header: 'Time',
      accessor: (r) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDatetime(r.created_at)}</span>,
    },
    {
      key: 'event_type', header: 'Event',
      accessor: (r) => <EventTypeBadge type={r.event_type} />,
    },
    {
      key: 'risk_level', header: 'Level',
      accessor: (r) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${RISK_BADGE[r.risk_level] ?? RISK_BADGE.medium}`}>
          {r.risk_level}
        </span>
      ),
    },
    {
      key: 'risk_score', header: 'Score',
      accessor: (r) => <ScoreBar score={r.risk_score} />,
    },
    {
      key: 'endpoint', header: 'Endpoint',
      accessor: (r) => <span className="text-[11px] font-mono text-muted-foreground">{r.endpoint ?? '—'}</span>,
    },
    {
      key: 'actions', header: '',
      accessor: (r) => (
        <div className="flex items-center gap-1">
          {r.risk_score >= 75 && (
            <button
              onClick={() => setTraceId(r.id)}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1"
            >
              <Search className="h-3 w-3" /> Investigate
            </button>
          )}
          {!r.resolved ? (
            <button
              onClick={() => resolve(r.id)}
              disabled={resolving}
              className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            >
              Resolve
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Resolved</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium text-foreground">Live Threats</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            LIVE
          </span>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {live.length > 0 && (
        <SectionCard title={`${live.length} new event${live.length !== 1 ? 's' : ''} since page load`}>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {live.map((e, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold capitalize ${RISK_BADGE[e.level] ?? ''}`}>{e.level}</span>
                <span className="font-mono text-muted-foreground">{e.event_type}</span>
                {e.ip && <span className="font-mono">{e.ip}</span>}
                <span className="ml-auto text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <DataTable
        columns={columns}
        data={rows}
        keyField="id"
        loading={isLoading}
        emptyTitle="No active threats"
        emptyDescription="No high or critical events in the last 24 hours."
        caption="Active threat feed"
      />
      <AttackerIntelModal eventId={traceId} onClose={() => setTraceId(null)} />
    </div>
  )
}

// ── Events tab ────────────────────────────────────────────────────────────
function EventsTab(): React.ReactElement {
  const [search, setSearch]         = useState('')
  const [eventType, setEventType]   = useState('')
  const [riskLevel, setRiskLevel]   = useState('')
  const [from, setFrom]             = useState('')
  const [to, setTo]                 = useState('')
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { mutate: resolve, isPending: resolving } = useResolveSecurityEvent()
  const [traceId, setTraceId] = useState<number | null>(null)
  const debSearch = useDebounce(search, 400)

  const params: Record<string, unknown> = {
    ...(debSearch   && { search: debSearch }),
    ...(eventType   && { event_type: eventType }),
    ...(riskLevel   && { risk_level: riskLevel }),
    ...(from        && { from }),
    ...(to          && { to }),
    page, per_page: perPage,
  }

  const { data, isLoading, isError } = useSecurityEvents(params)
  const rows = (data?.data ?? []) as SecurityEvent[]
  const meta = data?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<SecurityEvent>[] = [
    {
      key: 'created_at', header: 'Time',
      accessor: (r) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDatetime(r.created_at)}</span>,
    },
    {
      key: 'event_type', header: 'Event',
      accessor: (r) => (
        <div className="flex items-center gap-1.5">
          <EventTypeBadge type={r.event_type} />
          {r.event_count > 1 && (
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              ×{r.event_count}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'risk_level', header: 'Level',
      accessor: (r) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${RISK_BADGE[r.risk_level] ?? RISK_BADGE.medium}`}>
          {r.risk_level}
        </span>
      ),
    },
    {
      key: 'risk_score', header: 'Score',
      accessor: (r) => <ScoreBar score={r.risk_score} />,
    },
    {
      key: 'endpoint', header: 'Endpoint',
      accessor: (r) => <span className="text-[11px] font-mono text-muted-foreground">{r.endpoint ?? '—'}</span>,
    },
    {
      key: 'action', header: 'Action',
      accessor: (r) => <span className="text-[11px] text-muted-foreground">{r.action ?? '—'}</span>,
    },
    {
      key: 'resolve', header: '',
      accessor: (r) => (
        <div className="flex items-center gap-1">
          {r.risk_score >= 75 && (
            <button
              onClick={() => setTraceId(r.id)}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1"
            >
              <Search className="h-3 w-3" /> Investigate
            </button>
          )}
          {!r.resolved ? (
            <button
              onClick={() => resolve(r.id)}
              disabled={resolving}
              className="rounded px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50"
            >
              Resolve
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground line-through">Resolved</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search IP, user, endpoint…" className="w-56" />
        <Select value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(1) }}
          placeholder="All events" className="w-44 text-xs"
          options={[
            { value: '', label: 'All events' },
            { value: 'brute_force_attempt',           label: 'Brute Force' },
            { value: 'credential_stuffing',           label: 'Credential Stuffing' },
            { value: 'sql_injection_attempt',         label: 'SQL Injection' },
            { value: 'xss_attempt',                   label: 'XSS Attempt' },
            { value: 'command_injection_attempt',     label: 'Command Injection' },
            { value: 'fake_callback_attempt',         label: 'Fake Callback' },
            { value: 'payment_manipulation_attempt',  label: 'Payment Tampering' },
            { value: 'invoice_tampering',             label: 'Invoice Tampering' },
            { value: 'mpesa_callback_mismatch',       label: 'M-Pesa Mismatch' },
            { value: 'privilege_escalation_attempt',  label: 'Privilege Escalation' },
            { value: 'unauthorized_role_change',      label: 'Unauthorized Role Change' },
            { value: 'mass_delete_attempt',           label: 'Mass Delete' },
            { value: 'malware_signature_detected',    label: 'Malware Upload' },
            { value: 'executable_upload_attempt',     label: 'Executable Upload' },
          ]}
        />
        <Select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); setPage(1) }}
          placeholder="All levels" className="w-36 text-xs"
          options={[
            { value: '', label: 'All levels' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical' },
          ]}
        />
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground" />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground" />
        </div>
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        keyField="id"
        loading={isLoading}
        error={isError ? 'Failed to load security events.' : null}
        emptyTitle="No security events"
        emptyDescription="No events match your filters."
        pagination={meta}
        onPageChange={setPage}
        onPerPageChange={setPerPage}
        caption="Security events"
      />
      <AttackerIntelModal eventId={traceId} onClose={() => setTraceId(null)} />
    </div>
  )
}

// ── Brute force tab ───────────────────────────────────────────────────────
function BruteForceTab(): React.ReactElement {
  const { data, isLoading } = useSecurityBruteForce()
  const { mutate: blockIP, isPending: blocking } = useBlockIP()
  const [blockTarget, setBlockTarget] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const rows = (data?.data ?? []) as BruteForceEntry[]

  const columns: ColumnDef<BruteForceEntry>[] = [
    {
      key: 'ip_hash', header: 'IP (hashed)',
      accessor: (r) => <span className="font-mono text-xs">{r.ip_hash.slice(0, 16)}…</span>,
    },
    {
      key: 'attempts', header: 'Attempts',
      accessor: (r) => (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {r.attempts}
        </span>
      ),
    },
    {
      key: 'last_attempt', header: 'Last Attempt',
      accessor: (r) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDatetime(r.last_attempt)}</span>,
    },
    {
      key: 'action', header: '',
      accessor: (r) => (
        <button
          onClick={() => { setBlockTarget(r.ip_hash); setReason('Brute force attack') }}
          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          Block IP
        </button>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        keyField="ip_hash"
        loading={isLoading}
        emptyTitle="No brute force detected"
        caption="Brute force attempts"
      />
      <Modal
        open={blockTarget !== null}
        onClose={() => { setBlockTarget(null); setReason('') }}
        title="Block IP Address"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setBlockTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={blocking}
              onClick={() => {
                if (!blockTarget) return
                blockIP(
                  { ip_address: blockTarget, reason, type: 'temporary', duration_hours: 24 },
                  {
                    onSuccess: () => { setBlockTarget(null); setReason('') },
                  },
                )
              }}
            >
              Block
            </Button>
          </>
        }
      >
        <FormField label="Reason" htmlFor="block-reason" required>
          <Input id="block-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </Modal>
    </>
  )
}

// ── Risky users tab ───────────────────────────────────────────────────────
function RiskyUsersTab(): React.ReactElement {
  const { data, isLoading } = useSecurityRiskyUsers()
  const rows = (data?.data ?? []) as RiskyUser[]

  const columns: ColumnDef<RiskyUser>[] = [
    {
      key: 'user_id', header: 'User ID',
      accessor: (r) => <span className="font-mono text-xs">#{r.user_id}</span>,
    },
    {
      key: 'max_score', header: 'Max Score',
      accessor: (r) => <ScoreBar score={r.max_score} />,
    },
    {
      key: 'total_events', header: 'Total Events',
      accessor: (r) => <span className="text-xs font-semibold">{r.total_events}</span>,
    },
    {
      key: 'distinct_events', header: 'Distinct Types',
      accessor: (r) => <span className="text-xs">{r.distinct_events}</span>,
    },
    {
      key: 'last_event', header: 'Last Seen',
      accessor: (r) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDatetime(r.last_event)}</span>,
    },
    {
      key: 'view', header: '',
      accessor: (r) => (
        <a
          href={`/superadmin/users?id=${r.user_id}`}
          className="rounded px-2 py-1 text-xs text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
        >
          View User
        </a>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      keyField="user_id"
      loading={isLoading}
      emptyTitle="No risky users"
      caption="Risky users"
    />
  )
}

// ── Category donut ────────────────────────────────────────────────────────
function CategoriesTab(): React.ReactElement {
  const { data, isLoading } = useSecurityCategoryStats()
  const rows = (data?.data ?? []) as CategoryStat[]

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">No category data.</p>

  const chartData = rows.map((r) => ({ name: r.category, value: r.count }))
  const colors = rows.map((r) => CATEGORY_COLORS[r.category] ?? '#94a3b8')

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row">
      <div className="h-64 w-full max-w-sm">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
              paddingAngle={3} dataKey="value">
              {chartData.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Pie>
            <ReTooltip
              formatter={(value: number, name: string) => [`${value.toLocaleString()} events`, name]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend iconType="circle" iconSize={10}
              formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2">
        {rows.map((r) => (
          <div key={r.category} className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[r.category] ?? '#94a3b8' }} />
            <span className="flex-1 text-sm text-foreground">{r.category}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{r.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'events',    label: 'Events' },
  { id: 'threats',   label: 'Threats 🔴' },
  { id: 'heatmap',   label: 'Heatmap' },
  { id: 'brute',     label: 'Brute Force' },
  { id: 'users',     label: 'Risky Users' },
  { id: 'categories',label: 'Categories' },
] as const

type Tab = typeof TABS[number]['id']

export default function SecurityDashboard(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('dashboard')
  const { data: dash, isLoading: dashLoading, refetch: refetchDash, isFetching: dashFetching } = useSecurityDashboard()
  const { data: heatData, isLoading: heatLoading } = useSecurityHeatmap()
  const heatCells = (heatData?.data ?? []) as HeatmapCell[]

  const STAT_CARDS: { label: string; field: keyof typeof dash; color: string }[] = [
    { label: 'Failed Logins Today',   field: 'failed_logins_today',   color: 'amber' },
    { label: 'Blocked IPs',           field: 'blocked_ips_active',     color: 'red' },
    { label: 'Blocked Devices',       field: 'blocked_devices_active', color: 'red' },
    { label: 'Critical Events Today', field: 'critical_events_today',  color: 'red' },
    { label: 'High Events Today',     field: 'high_events_today',      color: 'orange' },
    { label: 'Brute Force (7d)',      field: 'brute_force_attempts',   color: 'orange' },
    { label: 'Injection Attempts (30d)', field: 'injection_attempts',  color: 'red' },
    { label: 'Payment Attacks (30d)', field: 'payment_attacks',        color: 'red' },
  ]

  return (
    <>
      <Helmet><title>Security Dashboard — StayLynk</title></Helmet>
      <div className="p-6">
        <PageHeader
          title="Security"
          subtitle="Platform threat monitoring and security event management."
          actions={
            tab === 'dashboard' ? (
              <button
                onClick={() => void refetchDash()}
                disabled={dashFetching}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${dashFetching ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            ) : undefined
          }
        />

        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={[
                'shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors -mb-px',
                tab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Dashboard tab */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {STAT_CARDS.map(({ label, field, color }) => (
                <StatCard
                  key={field}
                  label={label}
                  value={dash?.[field]}
                  color={color}
                  loading={dashLoading}
                />
              ))}
            </div>

            <SectionCard title="Attack Heatmap — Last 30 Days">
              <AttackHeatmap cells={heatCells} loading={heatLoading} />
            </SectionCard>
          </div>
        )}

        {tab === 'events'     && <EventsTab />}
        {tab === 'threats'    && <ThreatsTab />}
        {tab === 'heatmap'    && (
          <SectionCard title="Attack Heatmap — Last 30 Days">
            <AttackHeatmap cells={heatCells} loading={heatLoading} />
          </SectionCard>
        )}
        {tab === 'brute'      && <BruteForceTab />}
        {tab === 'users'      && <RiskyUsersTab />}
        {tab === 'categories' && (
          <SectionCard title="Category Distribution">
            <CategoriesTab />
          </SectionCard>
        )}
      </div>
    </>
  )
}
