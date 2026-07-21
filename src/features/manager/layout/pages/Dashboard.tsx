// src/features/manager/pages/Dashboard.tsx — Image 3
import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Building2, BedDouble, Users, DollarSign, CreditCard, RefreshCw, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { useManagerDashboard } from '../hooks/useDashboard'
import { useAuthStore } from '@/store/auth.store'
import {
  StatCard, StatusBadge, SectionCard, ProgressBar,
  EmptyState, SkeletonTable, PageHeader, ViewAllLink,
} from '@/components/ui'
import { OccupancyChart, ProfitOverviewDonut } from '@/components/charts'
import { formatRelative } from '@/utils/format'

function monthlyOccupancy(points: Array<{ date: string; occupancy_rate: number }>): Array<{ date: string; occupancy_rate: number }> {
  return points.map((p) => ({ ...p, date: format(new Date(p.date), 'MMM') }))
}

function fmt(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

const ACTIVITY_ICONS: Record<string, { icon: string; bg: string }> = {
  Booking:            { icon: '📅', bg: 'bg-violet-100' },
  Payment:            { icon: '💰', bg: 'bg-emerald-100' },
  Tenant:             { icon: '👤', bg: 'bg-amber-100' },
  User:               { icon: '👤', bg: 'bg-amber-100' },
  Invoice:            { icon: '📄', bg: 'bg-blue-100' },
  MaintenanceRequest: { icon: '🔧', bg: 'bg-red-100' },
  LeaseAgreement:     { icon: '📃', bg: 'bg-indigo-100' },
  Room:                { icon: '🛏', bg: 'bg-teal-100' },
}

function activityLabel(model: string, event: string): string {
  const modelLabel = model.replace(/([a-z])([A-Z])/g, '$1 $2').trim() || 'Record'
  const eventLabel = event.replace(/_/g, ' ')
  return `${modelLabel} ${eventLabel}`.trim()
}

export default function ManagerDashboard(): React.ReactElement {
  const user = useAuthStore((s) => s.user)
  const orgCurrency = user?.org?.currency ?? 'USD'
  const { data, isLoading, isError, refetch, isFetching } = useManagerDashboard()
  const stats = data?.stats
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? 'there'
  const propertyName = user?.current_property?.name ?? user?.org?.name

  return (
    <>
      <Helmet><title>Dashboard — {user?.org?.name ?? 'Manager'} | StayLynk</title></Helmet>
      <div className="p-4 max-w-[1600px] sm:p-6">
        <PageHeader
          title={`Welcome back, ${firstName}!`}
          emoji="👋"
          subtitle={propertyName ? `Here's what's happening with ${propertyName}.` : "Here's what's happening with your properties."}
          actions={
            <div className="flex items-center gap-2">
              <button onClick={() => void refetch()} disabled={isFetching} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted disabled:opacity-50" aria-label="Refresh">
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
              <Link to="/manager/rooms" className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Room
              </Link>
            </div>
          }
        />

        {isError && (
          <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700">
            ⚠️ Failed to load. <button onClick={() => void refetch()} className="underline">Retry</button>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          <StatCard label="Total Properties" value={stats?.total_properties ?? '—'} changeLabel={stats ? `+${stats.new_properties_month} this month` : undefined} icon={<Building2 className="h-4 w-4 text-violet-600" />} iconBg="bg-violet-100" iconShape="full" loading={isLoading} />
          <StatCard label="Total Rooms" value={stats?.total_rooms ?? '—'} changeLabel={stats ? `+${stats.new_rooms_month} this month` : undefined} icon={<BedDouble className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-100" iconShape="full" loading={isLoading} />
          <StatCard label="Occupied Rooms" value={stats?.occupied_rooms ?? '—'} changeLabel={stats ? `${stats.occupancy_rate}% Occupancy` : undefined} icon={<Users className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-100" iconShape="full" loading={isLoading} />
          <StatCard label="Monthly Revenue" value={stats ? fmt(stats.monthly_revenue, orgCurrency) : '—'} change={stats?.revenue_change_pct} changeLabel="this month" icon={<DollarSign className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-100" iconShape="full" loading={isLoading} />
          <StatCard label="Pending Payments" value={stats ? fmt(stats.pending_payments, orgCurrency) : '—'} icon={<CreditCard className="h-4 w-4 text-red-500" />} iconBg="bg-red-100" iconShape="full" loading={isLoading} />
        </div>

        {/* Charts + rent collection + activity */}
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-[1fr_300px_280px] gap-4 mb-4">
          <SectionCard title="Occupancy Overview" action={<span className="text-xs text-muted-foreground px-2 py-1 rounded border border-border">{new Date().getFullYear()}</span>}>
            <OccupancyChart data={monthlyOccupancy(data?.occupancy_overview ?? [])} height={160} loading={isLoading} />
          </SectionCard>

          <SectionCard title="Revenue Overview" action={<span className="text-xs text-muted-foreground px-2 py-1 rounded border border-border">{data?.revenue_overview?.period?.year ?? new Date().getFullYear()}</span>}>
            <ProfitOverviewDonut data={data?.revenue_overview ?? null} loading={isLoading} currency={orgCurrency} />
            {/* Rent collection summary */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-foreground">Rent Collection Summary</p>
                <ViewAllLink to="/manager/payments" label="View report" />
              </div>
              {isLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div>
              ) : (
                [
                  { label: 'Collected', value: data?.rent_collection_summary?.collected ?? 0, change: data?.rent_collection_summary?.collected_change_pct ?? 0 },
                  { label: 'Pending',   value: data?.rent_collection_summary?.pending   ?? 0, change: data?.rent_collection_summary?.pending_change_pct ?? 0 },
                  { label: 'Overdue',   value: data?.rent_collection_summary?.overdue   ?? 0, change: data?.rent_collection_summary?.overdue_change_pct ?? 0 },
                ].map((row) => (
                  <div key={row.label} className="py-2 border-b border-border last:border-0">
                    <p className="text-xs text-muted-foreground mb-0.5">{row.label}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground">{fmt(row.value, orgCurrency)}</span>
                      <span className={`text-xs font-medium ${row.change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {row.change >= 0 ? '▲' : '▼'} {Math.abs(row.change)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="Recent Activities" action={<ViewAllLink to="/manager/bookings" />}>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div>
            ) : (data?.recent_activities ?? []).length ? (data?.recent_activities ?? []).map((a) => {
              const style = ACTIVITY_ICONS[a.model] ?? { icon: '📋', bg: 'bg-muted' }
              return (
                <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${style.bg}`}>{style.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground leading-tight truncate capitalize">{activityLabel(a.model, a.event)}</p>
                    <p className="text-xs text-muted-foreground truncate">by {a.actor}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{formatRelative(a.created_at)}</span>
                </div>
              )
            }) : <p className="py-4 text-center text-xs text-muted-foreground">No recent activity</p>}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-foreground mb-3">
                Property Status <ViewAllLink to="/manager/properties" />
              </p>
              {isLoading ? (
                <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div>
              ) : <div className="max-h-[380px] overflow-y-auto">{(data?.property_status ?? []).slice(0, 4).map((p) => (
                <div key={p.id} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-foreground truncate">{p.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">{p.occupancy_rate}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{p.occupied_rooms}/{p.total_rooms} rooms occupied</p>
                  <ProgressBar value={p.occupancy_rate} />
                </div>
              ))}</div>}
            </div>
          </SectionCard>
        </div>

        {/* Recent bookings */}
        <div className="space-y-4">
          <SectionCard title="Recent Bookings" action={<ViewAllLink to="/manager/bookings" />} padding={false}>
            {isLoading ? (
              <div className="p-5"><SkeletonTable rows={5} cols={6} /></div>
            ) : (data?.recent_bookings ?? []).length ? (
              <div className="max-h-[380px] overflow-auto">
                <table className="w-full" aria-label="Recent bookings">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border bg-muted/60 backdrop-blur-sm dark:bg-card/95">
                      {['Guest Name', 'Room', 'Check-In', 'Check-Out', 'Amount', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recent_bookings ?? []).map((b) => (
                      <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 text-xs font-medium text-foreground">{b.guest_name}</td>
                        <td className="px-4 py-3 text-xs">{b.room}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(b.check_in), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {b.check_out ? format(new Date(b.check_out), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium">{fmt(b.amount, orgCurrency)}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-5"><EmptyState title="No bookings yet" /></div>}
          </SectionCard>
        </div>
      </div>
    </>
  )
}
