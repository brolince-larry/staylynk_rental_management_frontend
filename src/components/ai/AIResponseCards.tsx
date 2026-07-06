// src/components/ai/AIResponseCards.tsx
// Structured response card renderers for all four roles.
import React, { useState } from 'react'
import {
  AlertTriangle, Award, BarChart3, Bell, Building2, Calendar, CheckCircle,
  Clock, CreditCard, FileText, Home, Loader2, MapPin, MessageSquare,
  Phone, Settings, ShieldCheck, TrendingUp, User, Users, Wrench, XCircle,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '@/api/client'
import { useAuthStore } from '@/store/auth.store'

// ─── Role accent config ───────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, { primary: string; light: string; text: string; border: string }> = {
  superadmin: { primary: '#4F46E5', light: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800/50' },
  admin:      { primary: '#7C3AED', light: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800/50' },
  manager:    { primary: '#0D9488', light: 'bg-teal-50 dark:bg-teal-950/30',   text: 'text-teal-700 dark:text-teal-300',   border: 'border-teal-200 dark:border-teal-800/50' },
  tenant:     { primary: '#2563EB', light: 'bg-blue-50 dark:bg-blue-950/30',   text: 'text-blue-700 dark:text-blue-300',   border: 'border-blue-200 dark:border-blue-800/50' },
}

function rc(role: string) {
  return ROLE_COLOR[role] ?? ROLE_COLOR.admin
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtKES(n: number | undefined | null): string {
  if (n == null) return 'KES —'
  return `KES ${Number(n).toLocaleString()}`
}

function fmtPct(n: number | undefined | null): string {
  if (n == null) return '—%'
  return `${Number(n).toFixed(1)}%`
}

function daysBadge(days: number): { label: string; cls: string } {
  if (days > 30) return { label: `${days}d`, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
  if (days > 14) return { label: `${days}d`, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
  return { label: `${days}d`, cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
}

function priorityBadge(p: string | undefined) {
  const v = (p ?? '').toLowerCase()
  if (v === 'urgent' || v === 'critical') return { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', dot: '🔴' }
  if (v === 'high')   return { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', dot: '🟠' }
  if (v === 'normal' || v === 'medium') return { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', dot: '🟡' }
  return { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', dot: '🟢' }
}

function statusBadge(s: string | undefined) {
  const v = (s ?? '').toLowerCase().replace(/_/g, ' ')
  if (v === 'active') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (v.includes('overdue') || v === 'expired') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (v.includes('expir') || v === 'pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (v === 'paid') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function OccupancyRing({ pct, size = 80, role }: { pct: number; size?: number; role: string }): React.ReactElement {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(100, pct) / 100)
  const accent = rc(role).primary
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={8} className="text-muted/40" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-sm font-bold text-foreground">{Math.round(pct)}%</span>
    </div>
  )
}

function CardWrap({ children, className }: { children: React.ReactNode; className?: string }): React.ReactElement {
  return (
    <div className={`mt-3 overflow-hidden rounded-xl border border-border bg-card ${className ?? ''}`}>
      {children}
    </div>
  )
}

function CardHeader({ title, badge }: { title: string; badge?: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</span>
      {badge}
    </div>
  )
}

function MiniStat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-[0.68rem] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-bold text-foreground" style={accent ? { color: accent } : undefined}>{value}</div>
      {sub && <div className="text-[0.65rem] text-muted-foreground">{sub}</div>}
    </div>
  )
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export interface AIResponseCardProps {
  responseType: string
  cards: Record<string, unknown>
  role: string
  onSend?: (msg: string) => void
}

export function AIResponseCard({ responseType, cards, role, onSend }: AIResponseCardProps): React.ReactElement | null {
  switch (responseType) {
    case 'platform_summary':     return <PlatformSummaryCard data={cards} role={role} />
    case 'revenue_report':       return <RevenueReportCard data={cards} role={role} />
    case 'overdue_rent':         return <OverdueRentCard data={cards} role={role} onSend={onSend} />
    case 'property_performance': return <PropertyPerformanceCard data={cards} role={role} />
    case 'audit_log':            return <AuditLogCard data={cards} />
    case 'admin_list':           return <AdminListCard data={cards} />
    case 'portfolio_summary':    return <PortfolioSummaryCard data={cards} role={role} />
    case 'tenant_list':          return <TenantListCard data={cards} role={role} />
    case 'vacant_rooms':         return <VacantRoomsCard data={cards} role={role} onSend={onSend} />
    case 'maintenance_list':     return <MaintenanceListCard data={cards} role={role} onSend={onSend} />
    case 'pending_bookings':     return <PendingBookingsCard data={cards} role={role} onSend={onSend} />
    case 'income_report':        return <IncomeReportCard data={cards} role={role} />
    case 'daily_summary':        return <DailySummaryCard data={cards} role={role} onSend={onSend} />
    case 'inspection_schedule':  return <InspectionScheduleCard data={cards} role={role} />
    case 'worker_list':          return <WorkerListCard data={cards} role={role} />
    case 'tenant_summary':       return <TenantSummaryCard data={cards} role={role} />
    case 'rent_balance':         return <RentBalanceCard data={cards} role={role} />
    case 'payment_history':      return <PaymentHistoryCard data={cards} />
    case 'maintenance_status':   return <MaintenanceStatusCard data={cards} role={role} onSend={onSend} />
    case 'lease_detail':         return <LeaseDetailCard data={cards} role={role} />
    case 'new_maintenance_request': return <NewMaintenanceForm role={role} />
    default: return null
  }
}

// ─── SUPER ADMIN cards ────────────────────────────────────────────────────────

function PlatformSummaryCard({ data, role }: { data: Record<string, unknown>; role: string }): React.ReactElement {
  const d = data as {
    total_properties?: number; total_rooms?: number; occupied?: number; vacant?: number
    occupancy_rate?: number; total_tenants?: number; total_admins?: number
    monthly_revenue?: number; overdue_amount?: number; overdue_count?: number; open_maintenance?: number
  }
  const accent = rc(role).primary
  const revenueData = [
    { name: 'Collected', value: d.monthly_revenue ?? 0, fill: '#047857' },
    { name: 'Overdue',   value: d.overdue_amount ?? 0,  fill: '#be123c' },
  ]
  return (
    <CardWrap>
      <CardHeader title="Platform Summary" />
      <div className="p-4 space-y-4">
        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MiniStat label="Properties"  value={d.total_properties ?? 0} accent={accent} />
          <MiniStat label="Total Rooms" value={d.total_rooms ?? 0} />
          <MiniStat label="Tenants"     value={d.total_tenants ?? 0} />
          <MiniStat label="Admins"      value={d.total_admins ?? 0} />
          <MiniStat label="Overdue"     value={d.overdue_count ?? 0} sub={fmtKES(d.overdue_amount)} accent="#be123c" />
          <MiniStat label="Maintenance" value={d.open_maintenance ?? 0} sub="open requests" />
        </div>
        {/* Occupancy ring + revenue bar side by side */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <OccupancyRing pct={d.occupancy_rate ?? 0} size={76} role={role} />
            <span className="text-[0.68rem] text-muted-foreground">Occupancy</span>
          </div>
          <div className="flex-1 min-w-[140px]">
            <p className="mb-1 text-[0.68rem] font-semibold text-muted-foreground uppercase tracking-wide">Revenue vs Overdue</p>
            <ResponsiveContainer width="100%" height={64}>
              <BarChart data={revenueData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: unknown) => fmtKES(v as number)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                {revenueData.map((entry) => (
                  <Bar key={entry.name} dataKey="value" fill={entry.fill} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          <Wrench className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          <span className="text-foreground font-medium">{d.open_maintenance ?? 0} open maintenance requests</span>
          {(d.open_maintenance ?? 0) > 5 && (
            <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[0.65rem] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
              Action needed
            </span>
          )}
        </div>
      </div>
    </CardWrap>
  )
}

function RevenueReportCard({ data, role }: { data: Record<string, unknown>; role: string }): React.ReactElement {
  const d = data as {
    period?: string; total_collected?: number; total_outstanding?: number
    collection_rate?: number; top_property?: string
    breakdown?: Array<{ property: string; collected: number; outstanding: number }>
  }
  const breakdown = d.breakdown ?? []
  const chartData = breakdown.map((b) => ({ name: b.property.split(' ')[0], collected: b.collected, outstanding: b.outstanding }))
  return (
    <CardWrap>
      <CardHeader title={`Revenue — ${d.period ?? ''}`} />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Collected"    value={fmtKES(d.total_collected)}    accent="#047857" />
          <MiniStat label="Outstanding"  value={fmtKES(d.total_outstanding)}  accent="#be123c" />
          <MiniStat label="Collection %" value={fmtPct(d.collection_rate)}    accent={rc(role).primary} />
        </div>
        {d.top_property && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Award className="h-3.5 w-3.5 text-amber-500" />
            <span>Top: <strong className="text-foreground">{d.top_property}</strong></span>
          </div>
        )}
        {chartData.length > 0 && (
          <>
            <p className="text-[0.68rem] font-semibold text-muted-foreground uppercase tracking-wide">Per Property</p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: unknown) => fmtKES(v as number)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="collected"   fill="#047857" radius={[3, 3, 0, 0]} name="Collected" />
                <Bar dataKey="outstanding" fill="#be123c" radius={[3, 3, 0, 0]} name="Outstanding" />
              </BarChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-max text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    {['Property', 'Collected', 'Outstanding', 'Rate'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {breakdown.map((b) => {
                    const rate = b.collected / ((b.collected + b.outstanding) || 1) * 100
                    return (
                      <tr key={b.property} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium text-foreground">{b.property}</td>
                        <td className="px-3 py-2 text-emerald-700 dark:text-emerald-400">{fmtKES(b.collected)}</td>
                        <td className="px-3 py-2 text-red-600 dark:text-red-400">{fmtKES(b.outstanding)}</td>
                        <td className="px-3 py-2 font-semibold text-foreground">{fmtPct(rate)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </CardWrap>
  )
}

function OverdueRentCard({
  data, role, onSend,
}: { data: Record<string, unknown>; role: string; onSend?: (msg: string) => void }): React.ReactElement {
  const d = data as {
    count?: number; total_amount?: number
    tenants?: Array<{ name: string; property: string; room: string; amount: number; days_overdue: number }>
  }
  const tenants = d.tenants ?? []
  const accent = rc(role)
  return (
    <CardWrap>
      <CardHeader
        title="Overdue Rent"
        badge={
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[0.68rem] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {d.count ?? tenants.length} tenants · {fmtKES(d.total_amount)}
          </span>
        }
      />
      <div className="divide-y divide-border">
        {tenants.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">No overdue rent</p>
          </div>
        ) : (
          tenants.map((t) => {
            const db = daysBadge(t.days_overdue)
            return (
              <div key={`${t.name}-${t.room}`} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{t.name}</p>
                  <p className="text-[0.68rem] text-muted-foreground">{t.property} · {t.room}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400">{fmtKES(t.amount)}</p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${db.cls}`}>{db.label} overdue</span>
                </div>
                {onSend && (
                  <button
                    type="button"
                    onClick={() => onSend(`Send payment reminder to ${t.name}`)}
                    className={`shrink-0 rounded-lg px-2 py-1 text-[0.68rem] font-semibold transition ${accent.light} ${accent.text} ${accent.border} border`}
                  >
                    Remind
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
      {tenants.length > 1 && onSend && (
        <div className="border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={() => onSend('Send reminders to all overdue tenants')}
            className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
          >
            Send reminders to all {tenants.length} tenants
          </button>
        </div>
      )}
    </CardWrap>
  )
}

function PropertyPerformanceCard({ data, role }: { data: Record<string, unknown>; role: string }): React.ReactElement {
  const d = data as {
    properties?: Array<{ property: string; occupancy: number; revenue: number; overdue: number; maintenance: number }>
  }
  const rows = d.properties ?? []
  const [sortKey, setSortKey] = useState<string>('occupancy')
  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey as keyof typeof a] as number
    const bv = b[sortKey as keyof typeof b] as number
    return bv - av
  })
  const cols: Array<{ key: string; label: string }> = [
    { key: 'property', label: 'Property' },
    { key: 'occupancy', label: 'Occupancy' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'maintenance', label: 'Maint.' },
  ]
  const maxOcc = Math.max(...rows.map((r) => r.occupancy), 1)
  const minOcc = Math.min(...rows.map((r) => r.occupancy))
  return (
    <CardWrap>
      <CardHeader title="Property Performance" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead className="bg-muted/50">
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`cursor-pointer px-3 py-2.5 text-left font-semibold transition hover:text-foreground ${sortKey === c.key ? 'text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => c.key !== 'property' && setSortKey(c.key)}
                >
                  {c.label} {sortKey === c.key && '↓'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((r) => {
              const isHighOcc = r.occupancy === maxOcc
              const isLowOcc = r.occupancy === minOcc && rows.length > 1
              return (
                <tr key={r.property} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium text-foreground">{r.property}</td>
                  <td className={`px-3 py-2 font-semibold ${isHighOcc ? 'text-emerald-600 dark:text-emerald-400' : isLowOcc ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                    {fmtPct(r.occupancy)}
                  </td>
                  <td className="px-3 py-2 text-foreground">{fmtKES(r.revenue)}</td>
                  <td className="px-3 py-2 text-red-600 dark:text-red-400">{fmtKES(r.overdue)}</td>
                  <td className="px-3 py-2 text-foreground">{r.maintenance}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </CardWrap>
  )
}

function AuditLogCard({ data }: { data: Record<string, unknown> }): React.ReactElement {
  const d = data as { actions?: Array<{ timestamp: string; user: string; action: string; entity: string }> }
  const items = d.actions ?? []
  const [filter, setFilter] = useState<'all' | 'admin' | 'tenant' | 'system'>('all')
  const filters = ['all', 'admin', 'tenant', 'system'] as const
  const filtered = filter === 'all' ? items : items.filter((i) => i.action.toLowerCase().includes(filter))
  return (
    <CardWrap>
      <CardHeader title="Audit Log" />
      <div className="flex gap-1.5 px-4 pt-3 flex-wrap">
        {filters.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`rounded-full px-2.5 py-1 text-[0.68rem] font-medium transition ${filter === f ? 'bg-indigo-600 text-white' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
            {f === 'all' ? 'All' : f === 'admin' ? 'Admin' : f === 'tenant' ? 'Tenant' : 'System'} actions
          </button>
        ))}
      </div>
      <div className="mt-3 divide-y divide-border max-h-[280px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No events</p>
        ) : (
          filtered.map((item, i) => (
            <div key={i} className="flex gap-3 px-4 py-2.5">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{item.action}</p>
                <p className="text-[0.65rem] text-muted-foreground">{item.user} · {item.entity}</p>
              </div>
              <span className="shrink-0 text-[0.65rem] text-muted-foreground">{item.timestamp}</span>
            </div>
          ))
        )}
      </div>
    </CardWrap>
  )
}

function AdminListCard({ data }: { data: Record<string, unknown> }): React.ReactElement {
  const d = data as { admins?: Array<{ name: string; email: string; properties: number; tenants: number; last_active: string }> }
  const admins = d.admins ?? []
  return (
    <CardWrap>
      <CardHeader title="Active Admins" badge={<span className="text-[0.68rem] text-muted-foreground">{admins.length} total</span>} />
      <div className="divide-y divide-border">
        {admins.map((a) => (
          <div key={a.email} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">{a.name}</p>
              <p className="text-[0.68rem] text-muted-foreground">{a.email}</p>
            </div>
            <div className="text-right text-[0.68rem] text-muted-foreground shrink-0">
              <div>{a.properties} props · {a.tenants} tenants</div>
              <div>Active {a.last_active}</div>
            </div>
          </div>
        ))}
      </div>
    </CardWrap>
  )
}

// ─── ADMIN cards ──────────────────────────────────────────────────────────────

function PortfolioSummaryCard({ data, role }: { data: Record<string, unknown>; role: string }): React.ReactElement {
  const d = data as {
    properties?: number; rooms?: number; occupied?: number; vacant?: number
    occupancy_rate?: number; tenants?: number; monthly_revenue?: number
    outstanding_amount?: number; overdue_invoice_count?: number
    open_maintenance?: number; urgent_maintenance?: number
  }
  const accent = rc(role).primary
  return (
    <CardWrap>
      <CardHeader title="My Portfolio" />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Properties"  value={d.properties ?? 0} accent={accent} />
          <MiniStat label="Rooms"       value={d.rooms ?? 0} />
          <MiniStat label="Tenants"     value={d.tenants ?? 0} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <OccupancyRing pct={d.occupancy_rate ?? 0} size={72} role={role} />
            <span className="text-[0.68rem] text-muted-foreground">{d.occupied ?? 0} occupied / {d.vacant ?? 0} vacant</span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            <MiniStat label="Revenue"     value={fmtKES(d.monthly_revenue)}    accent="#047857" />
            <MiniStat label="Outstanding" value={fmtKES(d.outstanding_amount)} accent="#be123c" />
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          <Wrench className={`h-3.5 w-3.5 shrink-0 ${(d.urgent_maintenance ?? 0) > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          <span className="text-foreground">{d.open_maintenance ?? 0} open · <strong className="text-red-600 dark:text-red-400">{d.urgent_maintenance ?? 0} urgent</strong></span>
        </div>
      </div>
    </CardWrap>
  )
}

function TenantListCard({ data, role }: { data: Record<string, unknown>; role: string }): React.ReactElement {
  const d = data as { total?: number; tenants?: Array<{ name: string; room: string; property: string; balance: number; lease_status: string }> }
  const tenants = d.tenants ?? []
  const accent = rc(role)
  return (
    <CardWrap>
      <CardHeader title="Tenants" badge={<span className="text-[0.68rem] text-muted-foreground">{d.total ?? tenants.length} total</span>} />
      <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
        {tenants.map((t) => (
          <div key={`${t.name}-${t.room}`} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{t.name}</p>
              <p className="text-[0.65rem] text-muted-foreground">{t.room} · {t.property}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {t.balance > 0 && (
                <span className="text-[0.65rem] font-semibold text-red-600 dark:text-red-400">{fmtKES(t.balance)}</span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${statusBadge(t.lease_status)}`}>
                {(t.lease_status ?? '').replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </CardWrap>
  )
}

function VacantRoomsCard({
  data, role, onSend,
}: { data: Record<string, unknown>; role: string; onSend?: (msg: string) => void }): React.ReactElement {
  const d = data as {
    total_vacant?: number
    rooms?: Array<{ room_number: string; property: string; floor: string; block: string; monthly_rent: number; days_vacant: number }>
  }
  const rooms = d.rooms ?? []
  const accent = rc(role)
  return (
    <CardWrap>
      <CardHeader title="Vacant Rooms" badge={<span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${d.total_vacant ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700'}`}>{d.total_vacant ?? rooms.length} vacant</span>} />
      <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Home className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">All rooms occupied</p>
          </div>
        ) : (
          rooms.map((r) => {
            const db = daysBadge(r.days_vacant)
            return (
              <div key={`${r.room_number}-${r.property}`} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Home className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{r.room_number} · {r.property}</p>
                  <p className="text-[0.65rem] text-muted-foreground">Floor {r.floor} · Block {r.block} · {fmtKES(r.monthly_rent)}/mo</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${db.cls}`}>{db.label} empty</span>
              </div>
            )
          })
        )}
      </div>
    </CardWrap>
  )
}

function MaintenanceListCard({
  data, role, onSend,
}: { data: Record<string, unknown>; role: string; onSend?: (msg: string) => void }): React.ReactElement {
  const d = data as {
    open?: number; urgent?: number
    requests?: Array<{ id: number; property: string; room: string; issue: string; priority: string; days_open: number; status: string }>
  }
  const requests = d.requests ?? []
  return (
    <CardWrap>
      <CardHeader
        title="Maintenance"
        badge={
          <div className="flex gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{d.open ?? requests.length} open</span>
            {(d.urgent ?? 0) > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[0.65rem] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">{d.urgent} urgent</span>}
          </div>
        }
      />
      <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
        {requests.map((r) => {
          const pb = priorityBadge(r.priority)
          const db = daysBadge(r.days_open)
          return (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="text-base leading-none mt-0.5">{pb.dot}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{r.issue}</p>
                  <p className="text-[0.65rem] text-muted-foreground">{r.property} · {r.room}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${db.cls}`}>{db.label} open</span>
                </div>
              </div>
              {onSend && (
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => onSend(`Mark maintenance request ${r.id} as resolved`)}
                    className="rounded-md bg-emerald-50 px-2.5 py-1 text-[0.65rem] font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Resolve
                  </button>
                  <button type="button" onClick={() => onSend(`Assign maintenance request ${r.id} to a worker`)}
                    className="rounded-md bg-muted px-2.5 py-1 text-[0.65rem] font-semibold text-muted-foreground transition hover:bg-muted/80">
                    Assign
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </CardWrap>
  )
}

function PendingBookingsCard({
  data, role, onSend,
}: { data: Record<string, unknown>; role: string; onSend?: (msg: string) => void }): React.ReactElement {
  const d = data as {
    total?: number
    bookings?: Array<{ reference: string; name: string; property: string; room: string; move_in: string; phone: string }>
  }
  const bookings = d.bookings ?? []
  const accent = rc(role)
  return (
    <CardWrap>
      <CardHeader title="Pending Bookings" badge={<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.68rem] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{d.total ?? bookings.length} pending</span>} />
      <div className="divide-y divide-border">
        {bookings.map((b) => (
          <div key={b.reference} className="px-4 py-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{b.name}</p>
                <p className="text-[0.65rem] text-muted-foreground">{b.reference} · {b.property} · {b.room}</p>
                <p className="text-[0.65rem] text-muted-foreground">Move-in: {b.move_in} · {b.phone}</p>
              </div>
            </div>
            {onSend && (
              <div className="flex gap-2">
                <button type="button" onClick={() => onSend(`Approve booking ${b.reference}`)}
                  className="flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[0.65rem] font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <CheckCircle className="h-3 w-3" /> Approve
                </button>
                <button type="button" onClick={() => onSend(`Reject booking ${b.reference}`)}
                  className="flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-[0.65rem] font-semibold text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300">
                  <XCircle className="h-3 w-3" /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </CardWrap>
  )
}

function IncomeReportCard({ data, role }: { data: Record<string, unknown>; role: string }): React.ReactElement {
  const d = data as {
    total_collected?: number
    daily?: Array<{ date: string; amount: number }>
    breakdown?: Array<{ property: string; expected: number; collected: number }>
  }
  const daily = (d.daily ?? []).map((x) => ({ name: x.date.slice(-5), amount: x.amount }))
  const breakdown = d.breakdown ?? []
  return (
    <CardWrap>
      <CardHeader title="Income Report" />
      <div className="p-4 space-y-4">
        <MiniStat label="Total Collected" value={fmtKES(d.total_collected)} accent={rc(role).primary} />
        {daily.length > 0 && (
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: unknown) => fmtKES(v as number)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Line type="monotone" dataKey="amount" stroke={rc(role).primary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {breakdown.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-max text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {['Property', 'Expected', 'Collected', 'Gap'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {breakdown.map((b) => (
                  <tr key={b.property} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium text-foreground">{b.property}</td>
                    <td className="px-3 py-2 text-foreground">{fmtKES(b.expected)}</td>
                    <td className="px-3 py-2 text-emerald-700 dark:text-emerald-400">{fmtKES(b.collected)}</td>
                    <td className="px-3 py-2 text-red-600 dark:text-red-400">{fmtKES(b.expected - b.collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CardWrap>
  )
}

// ─── MANAGER cards ────────────────────────────────────────────────────────────

function DailySummaryCard({
  data, role, onSend,
}: { data: Record<string, unknown>; role: string; onSend?: (msg: string) => void }): React.ReactElement {
  const d = data as {
    date?: string; maintenance_open?: number; maintenance_urgent?: number
    vacant_rooms?: number; pending_inspections?: number; tenant_messages?: number
  }
  const items = [
    { icon: Wrench,        label: `${d.maintenance_open ?? 0} maintenance requests`, sub: d.maintenance_urgent ? `${d.maintenance_urgent} urgent` : '', prompt: 'Show open maintenance requests', alert: (d.maintenance_urgent ?? 0) > 0 },
    { icon: Home,          label: `${d.vacant_rooms ?? 0} vacant rooms`, sub: '', prompt: 'Show vacant rooms', alert: false },
    { icon: Calendar,      label: `${d.pending_inspections ?? 0} inspections pending`, sub: '', prompt: 'Show inspection schedule', alert: false },
    { icon: MessageSquare, label: `${d.tenant_messages ?? 0} unread messages`, sub: '', prompt: 'Show tenant messages', alert: (d.tenant_messages ?? 0) > 0 },
  ]
  const accent = rc(role)
  return (
    <CardWrap>
      <CardHeader title={`Today's Briefing · ${d.date ?? ''}`} />
      <div className="divide-y divide-border">
        {items.map(({ icon: Icon, label, sub, prompt, alert }) => (
          <button key={label} type="button" onClick={() => onSend?.(prompt)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/30">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${alert ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted'}`}>
              <Icon className={`h-4 w-4 ${alert ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">{label}</p>
              {sub && <p className="text-[0.65rem] text-red-600 dark:text-red-400 font-semibold">{sub}</p>}
            </div>
            <span className="text-xs text-muted-foreground">→</span>
          </button>
        ))}
      </div>
    </CardWrap>
  )
}

function InspectionScheduleCard({ data, role }: { data: Record<string, unknown>; role: string }): React.ReactElement {
  const d = data as { inspections?: Array<{ property: string; room: string; scheduled: string; type: string; status: string }> }
  const inspections = d.inspections ?? []
  return (
    <CardWrap>
      <CardHeader title="Inspection Schedule" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead className="bg-muted/50">
            <tr>
              {['Time', 'Property', 'Room', 'Type', 'Status'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {inspections.map((ins, i) => (
              <tr key={i} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium text-foreground">{ins.scheduled}</td>
                <td className="px-3 py-2 text-foreground">{ins.property}</td>
                <td className="px-3 py-2 text-foreground">{ins.room}</td>
                <td className="px-3 py-2 capitalize text-foreground">{ins.type}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${statusBadge(ins.status)}`}>
                    {ins.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardWrap>
  )
}

function WorkerListCard({ data, role }: { data: Record<string, unknown>; role: string }): React.ReactElement {
  const d = data as { workers?: Array<{ name: string; role: string; assigned_tasks: number; status: string }> }
  const workers = d.workers ?? []
  const accent = rc(role)
  return (
    <CardWrap>
      <CardHeader title="Workers" />
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {workers.map((w) => (
          <div key={w.name} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
              <Settings className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">{w.name}</p>
              <p className="text-[0.65rem] text-muted-foreground">{w.role} · {w.assigned_tasks} tasks</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${w.status === 'available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
              {w.status}
            </span>
          </div>
        ))}
      </div>
    </CardWrap>
  )
}

// ─── TENANT cards ─────────────────────────────────────────────────────────────

function TenantSummaryCard({ data, role }: { data: Record<string, unknown>; role: string }): React.ReactElement {
  const d = data as {
    property?: string; room?: string; lease_status?: string; rent_balance?: number
    outstanding_invoice_count?: number; overdue_balance?: number; open_maintenance?: number
  }
  const hasBalance = (d.rent_balance ?? 0) > 0
  const navigate = useNavigate()
  return (
    <CardWrap>
      <CardHeader title="My Account" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-foreground">{d.property ?? '—'}</p>
            <p className="text-[0.65rem] text-muted-foreground">Room {d.room ?? '—'}</p>
          </div>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${statusBadge(d.lease_status)}`}>
            {(d.lease_status ?? 'unknown').replace(/_/g, ' ')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-lg border px-3 py-2.5 ${hasBalance ? 'border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/20' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20'}`}>
            <p className="text-[0.68rem] text-muted-foreground">Rent Balance</p>
            <p className={`text-sm font-bold ${hasBalance ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {hasBalance ? fmtKES(d.rent_balance) : 'Clear ✓'}
            </p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-[0.68rem] text-muted-foreground">Maintenance</p>
            <p className="text-sm font-bold text-foreground">{d.open_maintenance ?? 0} open</p>
          </div>
        </div>
        {hasBalance && (
          <button type="button" onClick={() => navigate('/tenant/payments')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500">
            <CreditCard className="h-4 w-4" /> Pay Now
          </button>
        )}
      </div>
    </CardWrap>
  )
}

function RentBalanceCard({ data, role }: { data: Record<string, unknown>; role: string }): React.ReactElement {
  const d = data as {
    balance?: number; due_date?: string
    invoices?: Array<{ id: number; period: string; amount: number; status: string; due: string }>
  }
  const invoices = d.invoices ?? []
  const hasBalance = (d.balance ?? 0) > 0
  const navigate = useNavigate()

  const dueDate = d.due_date ? new Date(d.due_date) : null
  const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null

  return (
    <CardWrap>
      <CardHeader title="Rent Balance" />
      <div className="p-4 space-y-4">
        <div className="text-center">
          <p className={`text-3xl font-extrabold ${hasBalance ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {fmtKES(d.balance ?? 0)}
          </p>
          {daysLeft !== null && (
            <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${daysLeft < 3 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-muted text-muted-foreground'}`}>
              Due in {daysLeft} day{daysLeft !== 1 ? 's' : ''} · {d.due_date}
            </span>
          )}
        </div>
        {invoices.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {['Period', 'Amount', 'Due', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium text-foreground">{inv.period}</td>
                    <td className="px-3 py-2 text-foreground">{fmtKES(inv.amount)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{inv.due}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${statusBadge(inv.status)}`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasBalance && (
          <button type="button" onClick={() => navigate('/tenant/payments')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500">
            <CreditCard className="h-4 w-4" /> Pay Now
          </button>
        )}
      </div>
    </CardWrap>
  )
}

function PaymentHistoryCard({ data }: { data: Record<string, unknown> }): React.ReactElement {
  const d = data as {
    payments?: Array<{ reference: string; period: string; amount: number; paid_on: string; method: string; status: string }>
  }
  const payments = d.payments ?? []
  return (
    <CardWrap>
      <CardHeader title="Payment History" />
      <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
        {payments.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No payment history</p>
        ) : (
          payments.map((p) => (
            <div key={p.reference} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{p.period}</p>
                <p className="text-[0.65rem] text-muted-foreground">{p.reference} · {p.method} · {p.paid_on}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmtKES(p.amount)}</p>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${statusBadge(p.status)}`}>{p.status}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </CardWrap>
  )
}

function MaintenanceStatusCard({
  data, role, onSend,
}: { data: Record<string, unknown>; role: string; onSend?: (msg: string) => void }): React.ReactElement {
  const d = data as {
    requests?: Array<{ id: number; issue: string; category: string; status: string; created: string; last_update: string }>
  }
  const requests = d.requests ?? []
  function statusDot(s: string) {
    const v = s.toLowerCase().replace(/_/g, ' ')
    if (v === 'resolved' || v === 'done') return '✅'
    if (v === 'in progress' || v === 'in-progress') return '🔵'
    return '🟡'
  }
  return (
    <CardWrap>
      <CardHeader title="Maintenance Requests" />
      <div className="divide-y divide-border">
        {requests.map((r) => (
          <div key={r.id} className="px-4 py-3 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">{statusDot(r.status)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{r.issue}</p>
                <p className="text-[0.65rem] text-muted-foreground">{r.category} · Logged {r.created}</p>
                <p className="text-[0.65rem] text-muted-foreground">Updated {r.last_update}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${statusBadge(r.status)}`}>
                {r.status.replace(/_/g, ' ')}
              </span>
            </div>
            {onSend && (
              <div className="flex gap-2">
                <button type="button" onClick={() => onSend(`Add comment to maintenance request ${r.id}`)}
                  className="rounded-md bg-muted px-2.5 py-1 text-[0.65rem] font-semibold text-muted-foreground hover:bg-muted/80">
                  Add comment
                </button>
                <button type="button" onClick={() => onSend(`Mark maintenance request ${r.id} as urgent`)}
                  className="rounded-md bg-red-50 px-2.5 py-1 text-[0.65rem] font-semibold text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300">
                  Mark urgent
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </CardWrap>
  )
}

function LeaseDetailCard({ data, role }: { data: Record<string, unknown>; role: string }): React.ReactElement {
  const d = data as {
    property?: string; room?: string; start_date?: string; end_date?: string
    monthly_rent?: number; deposit?: number; status?: string; days_remaining?: number
  }
  const accent = rc(role).primary
  const totalDays = d.start_date && d.end_date
    ? Math.ceil((new Date(d.end_date).getTime() - new Date(d.start_date).getTime()) / 86400000)
    : null
  const elapsed = totalDays && d.days_remaining !== undefined ? totalDays - d.days_remaining : null
  const pct = totalDays && elapsed !== null ? Math.min(100, (elapsed / totalDays) * 100) : 0
  const daysLeft = d.days_remaining ?? 0
  return (
    <CardWrap>
      <CardHeader title="My Lease" />
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{d.property ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Room {d.room ?? '—'}</p>
          </div>
          <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(d.status)}`}>
            {(d.status ?? 'active').replace(/_/g, ' ')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Monthly Rent" value={fmtKES(d.monthly_rent)} accent={accent} />
          <MiniStat label="Deposit"      value={fmtKES(d.deposit)} />
          <MiniStat label="Start"        value={d.start_date ?? '—'} />
          <MiniStat label="End"          value={d.end_date ?? '—'} />
        </div>
        {totalDays && (
          <div className="space-y-1">
            <div className="flex justify-between text-[0.68rem] text-muted-foreground">
              <span>Lease progress</span>
              <span className={`font-semibold ${daysLeft < 30 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: daysLeft < 30 ? '#dc2626' : accent }} />
            </div>
          </div>
        )}
      </div>
    </CardWrap>
  )
}

// ─── Inline maintenance form (tenant) ────────────────────────────────────────

const MAINT_CATEGORIES = ['Plumbing', 'Electrical', 'Structural', 'General']
const MAINT_PRIORITIES = ['normal', 'urgent']

function NewMaintenanceForm({ role }: { role: string }): React.ReactElement {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('General')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const auth = useAuthStore()
  const accent = rc(role).primary

  const handleSubmit = async () => {
    if (!description.trim()) { setErrMsg('Please describe the issue.'); return }
    setStatus('submitting')
    setErrMsg('')
    try {
      await apiPost('/maintenance', { description, category, priority })
      setStatus('done')
    } catch {
      setErrMsg('Failed to submit. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <CardWrap>
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-500" />
          <p className="text-sm font-semibold text-foreground">Request submitted!</p>
          <p className="text-xs text-muted-foreground">We'll look into it shortly.</p>
        </div>
      </CardWrap>
    )
  }

  return (
    <CardWrap>
      <CardHeader title="Submit Maintenance Request" />
      <div className="p-4 space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300/50">
            {MAINT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priority</label>
          <div className="flex gap-1.5">
            {MAINT_PRIORITIES.map((p) => (
              <button key={p} type="button" onClick={() => setPriority(p as 'normal' | 'urgent')}
                className={`flex-1 rounded-lg border py-1.5 text-[0.68rem] font-semibold capitalize transition ${priority === p ? 'border-transparent text-white shadow-sm' : 'border-border bg-muted/40 text-muted-foreground hover:border-blue-300 hover:text-foreground'}`}
                style={priority === p ? { backgroundColor: p === 'urgent' ? '#dc2626' : accent } : undefined}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300/50" />
        </div>
        {errMsg && <p className="text-[0.68rem] font-medium text-red-500">{errMsg}</p>}
        <button type="button" onClick={() => void handleSubmit()} disabled={status === 'submitting'}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: accent }}>
          {status === 'submitting' ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…</> : 'Submit Request'}
        </button>
      </div>
    </CardWrap>
  )
}
