// src/components/charts/index.tsx
// Recharts wrappers used across dashboards
// Lazy-loaded via dynamic import at route level

import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { clsx } from 'clsx'
import { TrendingUp } from 'lucide-react'

// ─── Occupancy Line Chart ─────────────────────────────────────────────────
interface OccupancyPoint {
  date: string
  occupancy_rate: number
}

interface OccupancyChartProps {
  data: OccupancyPoint[]
  height?: number
  loading?: boolean
}

export function OccupancyChart({ data, height = 180, loading = false }: OccupancyChartProps): React.ReactElement {
  if (loading) {
    return <div className="animate-pulse bg-muted rounded-lg" style={{ height }} />
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2.5 text-center" style={{ height }}>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/70">
          <TrendingUp className="h-5 w-5 text-muted-foreground/30" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground/60">No occupancy data yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Appears once bookings are confirmed</p>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="occupancyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6d28d9" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#6d28d9" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '11px',
            boxShadow: '0 4px 12px rgba(0,0,0,.08)',
          }}
          formatter={(value) => {
            const n = typeof value === 'number' ? value : Number(value ?? 0)
            return [`${n.toFixed(1)}%`, 'Occupancy']
          }}
          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
        />
        <Area
          type="monotone"
          dataKey="occupancy_rate"
          stroke="#6d28d9"
          strokeWidth={2}
          fill="url(#occupancyGrad)"
          dot={false}
          activeDot={{ r: 4, fill: '#6d28d9', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Revenue Donut Chart ──────────────────────────────────────────────────
const DONUT_COLORS = ['#6d28d9', '#ef4444', '#f59e0b', '#10b981']

interface RevenueSegment {
  label: string
  amount: number
  percent: number
}

interface RevenueBreakdown {
  total: number
  room_rent:  RevenueSegment
  late_fees:  RevenueSegment
  utilities:  RevenueSegment
  other_fees: RevenueSegment
}

interface RevenueDonutProps {
  data: RevenueBreakdown | null
  loading?: boolean
  currency?: string
}

function formatCurrency(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    maximumFractionDigits: 0,
  }).format(n)
}

export function RevenueDonut({ data, loading = false, currency = 'USD' }: RevenueDonutProps): React.ReactElement {
  if (loading) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-32 w-32 rounded-full animate-pulse bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-3 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!data) return <div className="text-xs text-muted-foreground py-4 text-center">No data</div>

  const segments = [
    { name: 'Room Rent',  value: data.room_rent.amount,  pct: data.room_rent.percent,  color: DONUT_COLORS[0] },
    { name: 'Late Fees',  value: data.late_fees.amount,  pct: data.late_fees.percent,  color: DONUT_COLORS[1] },
    { name: 'Utilities',  value: data.utilities.amount,  pct: data.utilities.percent,  color: DONUT_COLORS[2] },
    { name: 'Other Fees', value: data.other_fees.amount, pct: data.other_fees.percent, color: DONUT_COLORS[3] },
  ]

  return (
    <div className="flex items-center gap-4">
      {/* Donut */}
      <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
        <PieChart width={130} height={130}>
          <Pie
            data={segments}
            cx={60}
            cy={60}
            innerRadius={44}
            outerRadius={62}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {segments.map((s, i) => <Cell key={i} fill={s.color} />)}
          </Pie>
        </PieChart>
        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm font-bold text-foreground leading-none">
            {formatCurrency(data.total, currency)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Total</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-1.5">
        {segments.map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-muted-foreground flex-1 truncate">{s.name}</span>
            <span className="text-foreground font-medium whitespace-nowrap">
              {formatCurrency(s.value, currency)} ({s.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Profit Overview Donut — yearly P&L: rent minus expenses/salaries = profit
const PROFIT_DONUT_COLORS = ['#ef4444', '#f59e0b', '#10b981']

interface ProfitSegment {
  amount: number
  percent: number
}

interface ProfitBreakdown {
  total: number
  expenses: ProfitSegment
  salaries: ProfitSegment
  profit:   ProfitSegment
  period?: { year: number }
}

interface ProfitOverviewDonutProps {
  data: ProfitBreakdown | null
  loading?: boolean
  currency?: string
}

export function ProfitOverviewDonut({ data, loading = false, currency = 'USD' }: ProfitOverviewDonutProps): React.ReactElement {
  if (loading) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-32 w-32 rounded-full animate-pulse bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-3 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!data) return <div className="text-xs text-muted-foreground py-4 text-center">No data</div>

  const segments = [
    { name: 'Expenses', value: data.expenses.amount, pct: data.expenses.percent, color: PROFIT_DONUT_COLORS[0] },
    { name: 'Salaries', value: data.salaries.amount, pct: data.salaries.percent, color: PROFIT_DONUT_COLORS[1] },
    // A loss can't render as a negative pie slice — clamp only the drawn
    // value; the legend and label below still show the real (possibly
    // negative) profit figure.
    { name: 'Profit',   value: Math.max(0, data.profit.amount), pct: data.profit.percent, color: PROFIT_DONUT_COLORS[2] },
  ]

  return (
    <div className="flex items-center gap-4">
      {/* Donut */}
      <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
        <PieChart width={130} height={130}>
          <Pie
            data={segments}
            cx={60}
            cy={60}
            innerRadius={44}
            outerRadius={62}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {segments.map((s, i) => <Cell key={i} fill={s.color} />)}
          </Pie>
        </PieChart>
        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className={`text-sm font-bold leading-none ${data.profit.amount < 0 ? 'text-red-500' : 'text-foreground'}`}>
            {formatCurrency(data.profit.amount, currency)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{data.profit.amount < 0 ? 'Loss' : 'Profit'} {data.period?.year ?? ''}</p>
        </div>
      </div>

      {/* Legend — label + value stacked per row so long currency strings
          wrap instead of overflowing this column's fixed width. */}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="min-w-0 text-xs">
          <span className="text-muted-foreground">Rent collected</span>
          <p className="break-words font-medium text-foreground">{formatCurrency(data.total, currency)}</p>
        </div>
        {segments.map((s) => (
          <div key={s.name} className="min-w-0 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.color }} />
              {s.name}
            </span>
            <p className="break-words font-medium text-foreground">
              {formatCurrency(s.name === 'Profit' ? data.profit.amount : s.value, currency)} ({s.pct}%)
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Revenue Line Chart (SuperAdmin) ─────────────────────────────────────
interface RevenueTrendPoint {
  period: string
  revenue: number
}

interface RevenueTrendChartProps {
  data: RevenueTrendPoint[]
  height?: number
  loading?: boolean
}

export function RevenueTrendChart({ data, height = 200, loading = false }: RevenueTrendChartProps): React.ReactElement {
  if (loading) return <div className="animate-pulse bg-muted rounded-lg" style={{ height }} />
  if (!data.length) return <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ height }}>No data</div>

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6d28d9" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#6d28d9" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
        />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
          formatter={(value) => {
            const n = typeof value === 'number' ? value : Number(value ?? 0)
            return [`$${(n / 1000).toFixed(1)}K`, 'Revenue']
          }}
          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
        />
        <Area type="monotone" dataKey="revenue" stroke="#6d28d9" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: '#6d28d9', strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Plan Distribution Donut (SuperAdmin) ────────────────────────────────
const PLAN_COLORS = ['#6d28d9', '#f59e0b', '#10b981', '#818cf8']

interface PlanDistributionProps {
  data: Array<{ plan_name: string; active_subscribers: number }>
  loading?: boolean
}

export function PlanDistributionDonut({ data, loading = false }: PlanDistributionProps): React.ReactElement {
  if (loading) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-32 w-32 rounded-full animate-pulse bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-3 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.active_subscribers, 0)

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
        <PieChart width={130} height={130}>
          <Pie data={data} cx={60} cy={60} innerRadius={44} outerRadius={62} paddingAngle={2} dataKey="active_subscribers" strokeWidth={0}>
            {data.map((d, i) => (
              <Cell key={`${d.plan_name || 'plan'}-${i}`} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {data.map((d, i) => (
          <div key={`${d.plan_name || 'plan'}-${i}`} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
            <span className="text-muted-foreground flex-1">{d.plan_name}</span>
            <span className="text-foreground font-medium">
              {d.active_subscribers} ({total > 0 ? ((d.active_subscribers / total) * 100).toFixed(1) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
