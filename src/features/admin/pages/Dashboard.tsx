// src/features/admin/pages/Dashboard.tsx
// Matches Image 1 exactly — all 6 sections

import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  Building2, BedDouble, Users, DollarSign, FileText,
  CalendarDays, Download, RefreshCw,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { useAdminDashboard } from '../hooks/useDashboard'
import { useAuthStore } from '@/store/auth.store'
import { openSignedDocument } from '@/api/documentDownloads'
import { useToast } from '@/hooks'
import { ToastContainer } from '@/components/forms'
import {
  StatCard, StatusBadge, SectionCard, ProgressBar,
  EmptyState, SkeletonTable, PageHeader, ViewAllLink, ActivityItem,
} from '@/components/ui'
import { OccupancyChart, ProfitOverviewDonut } from '@/components/charts'

function monthlyOccupancy(points: Array<{ date: string; occupancy_rate: number }>): Array<{ date: string; occupancy_rate: number }> {
  return points.map((p) => ({ ...p, date: format(new Date(p.date), 'MMM') }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function fmt(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(iso: string): string {
  try { return format(new Date(iso), 'MMM d, yyyy') } catch { return iso }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m} min${m !== 1 ? 's' : ''} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr${h !== 1 ? 's' : ''} ago`
  return `${Math.floor(h / 24)} day(s) ago`
}

// ─── Activity icon mapping ─────────────────────────────────────────────────
const ACTIVITY_ICONS: Record<string, { icon: string; bg: string }> = {
  created:         { icon: '✨', bg: 'bg-violet-100' },
  updated:         { icon: '✏️',  bg: 'bg-blue-100'   },
  deleted:         { icon: '🗑',  bg: 'bg-red-100'    },
  login_success:   { icon: '🔑',  bg: 'bg-emerald-100' },
  payment_received:{ icon: '💰',  bg: 'bg-emerald-100' },
  booking_confirmed:{icon: '📅',  bg: 'bg-violet-100' },
  lease_created:   { icon: '📃',  bg: 'bg-blue-100'   },
  lease_terminated:{ icon: '⛔',  bg: 'bg-red-100'    },
}

export default function AdminDashboard(): React.ReactElement {
  const user = useAuthStore((s) => s.user)
  const orgCurrency = user?.org?.currency ?? 'USD'
  const { toasts, success, error: toastError, dismiss } = useToast()

  // ── Date range state ──────────────────────────────────────────────────
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showDatePicker, setShowDatePicker] = useState(false)

  const exportRevenueReport = () => {
    void openSignedDocument('/admin/reports/export?type=revenue', {
      onPending: (message) => success(message),
    }).catch((err) => toastError(err, 'Failed to export report'))
  }

  // ── Data fetching ─────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch, isFetching } = useAdminDashboard({ from, to })

  const stats = data?.stats
  const isLoadingStats = isLoading || !stats

  return (
    <>
      <Helmet>
        <title>Dashboard — {user?.org?.name ?? 'Admin'} | StayLynk</title>
      </Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="max-w-[1600px] p-4 sm:p-6">
        {/* ── Page header ──────────────────────────────────────────────── */}
        <PageHeader
          title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'Admin'}!`}
          emoji="👋"
          subtitle="Here's what's happening across all your properties."
          actions={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {/* Date range picker */}
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-violet-300 hover:text-violet-600 dark:hover:border-violet-600"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {format(new Date(from), 'MMM d')} – {format(new Date(to), 'MMM d, yyyy')}
                </button>
                {showDatePicker && (
                  <div className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-border bg-card p-4 shadow-2xl ring-1 ring-black/5 dark:ring-white/5">
                    <p className="mb-3 text-xs font-semibold text-foreground">Select date range</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">From</label>
                        <input
                          type="date"
                          value={from}
                          onChange={(e) => setFrom(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">To</label>
                        <input
                          type="date"
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className="px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => { setShowDatePicker(false); void refetch() }}
                        className="app-gradient-primary rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-500/20"
                      >
                        Apply
                      </button>
                    </div>
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-2 text-xs text-muted-foreground">Quick select</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          ['Last 7 days', 7], ['Last 30 days', 30],
                          ['Last 90 days', 90],
                        ].map(([label, days]) => (
                          <button
                            key={label as string}
                            onClick={() => {
                              setFrom(format(subDays(new Date(), days as number), 'yyyy-MM-dd'))
                              setTo(format(new Date(), 'yyyy-MM-dd'))
                              setShowDatePicker(false)
                            }}
                            className="rounded-lg border border-border bg-muted px-2 py-1 text-xs text-foreground transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/30 dark:hover:text-violet-400"
                          >
                            {label as string}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Refresh */}
              <button
                onClick={() => void refetch()}
                disabled={isFetching}
                aria-label="Refresh dashboard"
                className="rounded-lg border border-violet-100 bg-white/80 p-2 text-slate-600 shadow-sm transition-all hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              </button>

              {/* Export */}
              <button
                onClick={exportRevenueReport}
                className="app-gradient-primary flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:-translate-y-0.5"
              >
                <Download className="h-3.5 w-3.5" />
                Export Report
              </button>
            </div>
          }
        />

        {/* ── Error state ───────────────────────────────────────────────── */}
        {isError && (
          <div role="alert" className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
            <span className="text-red-500 text-lg">⚠️</span>
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Failed to load dashboard data</p>
              <button onClick={() => void refetch()} className="text-xs text-red-600 underline mt-0.5">
                Click to retry
              </button>
            </div>
          </div>
        )}

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Total Properties"
            value={stats?.total_properties.toLocaleString() ?? '—'}
            changeLabel={stats ? `+${stats.new_properties_month} this month` : undefined}
            icon={<Building2 className="h-4 w-4 text-violet-600" />}
            iconBg="bg-violet-100 dark:bg-violet-950/50"
            accentBorder="border-violet-500"
            accentGlow="bg-violet-500"
            loading={isLoadingStats}
          />
          <StatCard
            label="Total Beds"
            value={stats?.total_rooms.toLocaleString() ?? '—'}
            changeLabel={stats ? `+${stats.new_rooms_month} this month` : undefined}
            icon={<BedDouble className="h-4 w-4 text-blue-600" />}
            iconBg="bg-blue-100 dark:bg-blue-950/50"
            accentBorder="border-blue-500"
            accentGlow="bg-blue-500"
            loading={isLoadingStats}
          />
          <StatCard
            label="Occupied Beds"
            value={stats?.occupied_rooms.toLocaleString() ?? '—'}
            changeLabel={stats ? `${stats.occupancy_rate}% Occupancy` : undefined}
            icon={<Users className="h-4 w-4 text-amber-600" />}
            iconBg="bg-amber-100 dark:bg-amber-950/50"
            accentBorder="border-amber-500"
            accentGlow="bg-amber-500"
            loading={isLoadingStats}
          />
          <StatCard
            label="Monthly Revenue"
            value={stats ? fmt(stats.monthly_revenue, orgCurrency) : '—'}
            change={stats?.revenue_change_pct}
            changeLabel="this month"
            icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-100 dark:bg-emerald-950/50"
            accentBorder="border-emerald-500"
            accentGlow="bg-emerald-500"
            loading={isLoadingStats}
          />
          <StatCard
            label="Pending Invoices"
            value={stats?.pending_invoices_count ?? '—'}
            changeLabel={stats ? fmt(stats.pending_invoices_amount, orgCurrency) : undefined}
            icon={<FileText className="h-4 w-4 text-red-500" />}
            iconBg="bg-red-100 dark:bg-red-950/50"
            accentBorder="border-red-500"
            accentGlow="bg-red-500"
            loading={isLoadingStats}
          />
        </div>

        {/* ── Charts + Activity row ─────────────────────────────────────── */}
        <div className="mb-4 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
          {/* Occupancy chart */}
          <SectionCard
            title="Occupancy Overview"
            action={
              <span className="rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs font-semibold text-muted-foreground">
                {new Date().getFullYear()}
              </span>
            }
          >
            <OccupancyChart
              data={monthlyOccupancy(data?.occupancy_chart ?? [])}
              height={200}
              loading={isLoading}
            />
          </SectionCard>

          {/* Revenue donut */}
          <SectionCard
            title="Revenue Overview"
            action={
              <span className="rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs font-semibold text-muted-foreground">
                {data?.revenue_breakdown?.period?.year ?? new Date().getFullYear()}
              </span>
            }
          >
            <ProfitOverviewDonut
              data={data?.revenue_breakdown ?? null}
              loading={isLoading}
              currency={orgCurrency}
            />
          </SectionCard>

          {/* Recent activities — first 5 visible, rest scrollable */}
          <SectionCard title="Recent Activities">
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex gap-2">
                    <div className="h-7 w-7 rounded-lg bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-2.5 bg-muted rounded animate-pulse" />
                      <div className="h-2 w-3/4 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : data?.recent_activity.length ? (
              <div className="max-h-[280px] overflow-y-auto -mx-5 px-5">
                {data.recent_activity.slice(0, 5).map((a) => {
                  const iconCfg = ACTIVITY_ICONS[a.event] ?? { icon: '📋', bg: 'bg-slate-100' }
                  return (
                    <ActivityItem
                      key={a.id}
                      icon={<span className="text-xs">{iconCfg.icon}</span>}
                      iconBg={iconCfg.bg}
                      title={a.description}
                      subtitle={a.model && a.model_id ? `${a.model} #${a.model_id}` : undefined}
                      time={relativeTime(a.created_at)}
                    />
                  )
                })}
              </div>
            ) : (
              <EmptyState title="No recent activity" />
            )}
          </SectionCard>
        </div>

        {/* ── Recent bookings + Property status row ────────────────────── */}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_0.58fr]">
          {/* Recent bookings table */}
          <SectionCard
            title="Recent Bookings"
            action={<ViewAllLink to="/admin/bookings" />}
            padding={false}
          >
            {isLoading ? (
              <div className="p-5"><SkeletonTable rows={5} cols={6} /></div>
            ) : data?.recent_bookings.length ? (
              <div className="max-h-[380px] overflow-auto">
                <table className="w-full" aria-label="Recent bookings">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-violet-100 bg-violet-50/95 backdrop-blur-sm dark:bg-card/95">
                      {['Tenant', 'Property', 'Room', 'Check In', 'Check Out', 'Amount', 'Status'].map(h => (
                        <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-bold text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_bookings.map((b) => (
                      <tr key={b.id} className="border-b border-violet-100/80 transition-colors last:border-0 hover:bg-violet-50/55">
                        <td className="px-4 py-3 text-xs font-medium text-foreground">{b.tenant_name ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{b.property_name ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-foreground">{b.room ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(b.check_in_date)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {b.check_out_date ? fmtDate(b.check_out_date) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-foreground">
                          {fmt(b.amount, orgCurrency)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={b.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState title="No bookings yet" description="Bookings will appear here once created." />
              </div>
            )}
          </SectionCard>

          {/* Property status */}
          <SectionCard title="Property Status" action={<ViewAllLink to="/admin/properties" />}>
            {isLoading ? (
              <div className="space-y-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 bg-muted rounded animate-pulse" />
                    <div className="h-2 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-1.5 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : data?.property_status.length ? (
              <div className="max-h-[380px] overflow-y-auto space-y-3.5">
                {data.property_status.map((p) => (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      {p.occupied_rooms} / {p.total_rooms} rooms occupied
                    </p>
                    <ProgressBar
                      value={p.occupancy_rate}
                      showLabel
                      color={
                        p.occupancy_rate >= 90 ? 'bg-emerald-500' :
                        p.occupancy_rate >= 70 ? 'bg-primary' :
                        p.occupancy_rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No properties" description="Add properties to see occupancy status." />
            )}
          </SectionCard>
        </div>

      </div>
    </>
  )
}
