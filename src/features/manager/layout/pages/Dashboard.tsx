// src/features/manager/pages/Dashboard.tsx — Image 3
import React, { useState } from 'react'
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
import { OccupancyChart, RevenueDonut } from '@/components/charts'

function fmt(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

// Room Occupancy Calendar
interface CalendarProps {
  rooms: Array<{ id: number; name: string }>
  loading?: boolean
}

function RoomOccupancyCalendar({ rooms, loading }: CalendarProps): React.ReactElement {
  const today = new Date()
  const days = Array.from({ length: 16 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i - 2)
    return { date: d.getDate(), day: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3), full: d }
  })

  const STATUS_COLORS: Record<string, string> = {
    occupied: 'bg-emerald-400/70', booked: 'bg-violet-300/70', available: 'bg-green-50', blocked: 'bg-red-200/60',
  }

  const mockStatus = ['occupied', 'occupied', 'available', 'booked', 'blocked', 'occupied', 'available']

  if (loading) return <div className="h-32 bg-muted animate-pulse rounded-lg" />

  return (
    <div>
      <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
        {[['bg-emerald-400/70', 'Occupied'], ['bg-violet-300/70', 'Booked'], ['bg-green-50 border border-green-200', 'Available'], ['bg-red-200/60', 'Blocked']].map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm border border-border ${cls}`} />
            {label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs" aria-label="Room occupancy calendar">
          <thead>
            <tr>
              <th className="bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground border border-border w-20">Room</th>
              {days.map((d) => (
                <th key={d.date} className="bg-muted px-1 py-2 text-center text-xs font-medium text-muted-foreground border border-border min-w-[34px]">
                  <div>{d.date}</div>
                  <div className="text-[10px] font-normal">{d.day}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rooms.length ? rooms : [{ id: 101, name: '101' }, { id: 102, name: '102' }, { id: 103, name: '103' }, { id: 104, name: '104' }]).map((room, ri) => (
              <tr key={room.id}>
                <td className="bg-muted/50 px-3 py-1.5 font-medium text-foreground border border-border">{room.name}</td>
                {days.map((_, ci) => {
                  const status = mockStatus[(ri + ci) % mockStatus.length]
                  return (
                    <td
                      key={ci}
                      className={`border border-border h-6 ${STATUS_COLORS[status] ?? 'bg-muted'}`}
                      title={status}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ManagerDashboard(): React.ReactElement {
  const user = useAuthStore((s) => s.user)
  const orgCurrency = user?.org?.currency ?? 'USD'
  const { data, isLoading, isError, refetch, isFetching } = useManagerDashboard()
  const stats = data?.stats

  return (
    <>
      <Helmet><title>Dashboard — {user?.org?.name ?? 'Manager'} | StayLynk</title></Helmet>
      <div className="p-6 max-w-[1600px]">
        <PageHeader
          title={`Welcome back, ${user?.org?.name ?? user?.name}!`}
          emoji="👋"
          subtitle="Here's what's happening with your property."
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
          <StatCard label="Total Properties" value={stats?.total_properties ?? '—'} changeLabel={stats ? '+2 this month' : undefined} icon={<Building2 className="h-4 w-4 text-violet-600" />} iconBg="bg-violet-100" loading={isLoading} />
          <StatCard label="Total Rooms" value={stats?.total_rooms ?? '—'} changeLabel={stats ? '+16 this month' : undefined} icon={<BedDouble className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-100" loading={isLoading} />
          <StatCard label="Occupied Rooms" value={stats?.occupied_rooms ?? '—'} changeLabel={stats ? `${stats.occupancy_rate}% Occupancy` : undefined} icon={<Users className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-100" loading={isLoading} />
          <StatCard label="Monthly Revenue" value={stats ? fmt(stats.monthly_revenue, orgCurrency) : '—'} change={12.6} changeLabel="this month" icon={<DollarSign className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-100" loading={isLoading} />
          <StatCard label="Pending Payments" value={stats ? fmt(stats.pending_payments, orgCurrency) : '—'} change={-8.4} changeLabel="this month" icon={<CreditCard className="h-4 w-4 text-red-500" />} iconBg="bg-red-100" loading={isLoading} />
        </div>

        {/* Charts + rent collection + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px_280px] gap-4 mb-4">
          <SectionCard title="Occupancy Overview" action={<span className="text-xs text-muted-foreground px-2 py-1 rounded border border-border">Last 30 Days ▾</span>}>
            <OccupancyChart data={data?.occupancy_chart ?? []} height={160} loading={isLoading} />
          </SectionCard>

          <SectionCard title="Revenue Overview" action={<span className="text-xs text-muted-foreground px-2 py-1 rounded border border-border">This Month ▾</span>}>
            <RevenueDonut data={data?.revenue_breakdown ?? null} loading={isLoading} currency={orgCurrency} />
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
                  { label: 'Collected', value: data?.rent_collection?.collected ?? 0, change: 12.6, positive: true },
                  { label: 'Pending',   value: data?.rent_collection?.pending   ?? 0, change: -8.4, positive: false },
                  { label: 'Overdue',   value: data?.rent_collection?.overdue   ?? 0, change: 5.2,  positive: false },
                ].map((row) => (
                  <div key={row.label} className="py-2 border-b border-border last:border-0">
                    <p className="text-xs text-muted-foreground mb-0.5">{row.label}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground">{fmt(row.value, orgCurrency)}</span>
                      <span className={`text-xs font-medium ${row.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {row.positive ? '▲' : '▼'} {Math.abs(row.change)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="Recent Activities" action={<ViewAllLink to="/manager/bookings" />}>
            {[
              { icon: '📅', bg: 'bg-violet-100', title: 'New booking received', sub: 'Room 101 - John Doe', time: '10 min' },
              { icon: '💰', bg: 'bg-emerald-100', title: 'Rent payment received', sub: '$850 from Jane Smith', time: '1 hr' },
              { icon: '👤', bg: 'bg-amber-100', title: 'Tenant checked in', sub: 'Room 203 - Mike Johnson', time: '3 hr' },
              { icon: '📄', bg: 'bg-blue-100', title: 'Invoice generated', sub: 'INV-2025-018', time: '5 hr' },
              { icon: '🔧', bg: 'bg-red-100', title: 'Maintenance request', sub: 'Room 105 - AC not working', time: '1 day' },
            ].map((a) => (
              <div key={a.title} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${a.bg}`}>{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground leading-tight truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.sub}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{a.time}</span>
              </div>
            ))}
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

        {/* Recent bookings + Room calendar */}
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
                        <td className="px-4 py-3 text-xs font-medium text-foreground">{b.tenant_name}</td>
                        <td className="px-4 py-3 text-xs">{b.room_number}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(b.check_in_date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {b.check_out_date ? format(new Date(b.check_out_date), 'MMM d, yyyy') : '—'}
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

          <SectionCard title="Room Occupancy Calendar ℹ️">
            <RoomOccupancyCalendar rooms={[]} loading={isLoading} />
          </SectionCard>
        </div>
      </div>
    </>
  )
}
