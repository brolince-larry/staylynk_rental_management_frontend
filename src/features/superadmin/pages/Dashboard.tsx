// src/features/superadmin/pages/Dashboard.tsx
import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Building2, Home, BedDouble, Users, DollarSign, Package, RefreshCw, Download } from 'lucide-react'
import { useSuperAdminDashboard } from '../hooks/useDashboard'
import {
  StatCard, StatusBadge, SectionCard, ProgressBar,
  SkeletonTable, PageHeader, ViewAllLink,
} from '@/components/ui'
import { RevenueTrendChart, PlanDistributionDonut } from '@/components/charts'
import AIMonitoringWidgets from '@/components/ai/AIMonitoringWidgets'
import { apiBaseUrl } from '@/config/env'

function fmtKES(n: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n)
}

function statusColor(s: string): string {
  const v = s.toLowerCase()
  if (v === 'healthy' || v === 'ok') return 'text-emerald-600 dark:text-emerald-400'
  if (v === 'degraded' || v === 'warning') return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

const PLAN_COLORS: Record<string, string> = {
  enterprise: 'text-violet-600 font-semibold',
  professional: 'text-blue-600 font-semibold',
  standard: 'text-emerald-600 font-semibold',
  basic: 'text-amber-600 font-semibold',
}

const QUICK_ACTIONS = [
  { icon: '🏦', label: 'Add New Organization', href: '/superadmin/organizations' },
  { icon: '📦', label: 'Create Subscription Plan', href: '/superadmin/plans' },
  { icon: '⚙️', label: 'System Settings', href: '/superadmin/system' },
  { icon: '📄', label: 'View All Invoices', href: '/superadmin/billing' },
  { icon: '📈', label: 'Performance Monitor', href: '/superadmin/system' },
]

export default function SuperAdminDashboard(): React.ReactElement {
  const { data, isLoading, isError, refetch, isFetching } = useSuperAdminDashboard()
  const stats = data?.stats
  const health = data?.system_health
  const usage = data?.system_usage

  return (
    <>
      <Helmet><title>Super Admin Dashboard — StayLynk</title></Helmet>

      <div className="p-6 max-w-[1600px]">
        <PageHeader
          title="Super Admin Dashboard"
          emoji="👑"
          subtitle="Overview of your entire SaaS platform"
          actions={
            <div className="flex gap-2">
              <button
                onClick={() => void refetch()}
                disabled={isFetching}
                aria-label="Refresh dashboard"
                className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
              <a
                href={`${apiBaseUrl}/superadmin/reports/export?type=platform`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Reports
              </a>
            </div>
          }
        />

        {isError && (
          <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            ⚠️ Failed to load dashboard data.{' '}
            <button onClick={() => void refetch()} className="underline ml-1">Retry</button>
          </div>
        )}

        {/* ── Stat cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <StatCard
            label="Total Organizations"
            value={stats?.total_organizations.toLocaleString() ?? '—'}
            changeLabel={stats ? `+${stats.new_organizations} this month` : undefined}
            icon={<Building2 className="h-4 w-4 text-violet-600" />}
            iconBg="bg-violet-100 dark:bg-violet-950/50"
            loading={isLoading}
          />
          <StatCard
            label="Total Properties"
            value={stats?.total_properties.toLocaleString() ?? '—'}
            changeLabel={stats ? `+${stats.new_properties} this month` : undefined}
            icon={<Home className="h-4 w-4 text-blue-600" />}
            iconBg="bg-blue-100 dark:bg-blue-950/50"
            loading={isLoading}
          />
          <StatCard
            label="Total Rooms"
            value={stats?.total_rooms.toLocaleString() ?? '—'}
            changeLabel={stats ? `+${stats.new_rooms} this month` : undefined}
            icon={<BedDouble className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-100 dark:bg-emerald-950/50"
            loading={isLoading}
          />
          <StatCard
            label="Total Tenants"
            value={stats?.total_tenants.toLocaleString() ?? '—'}
            changeLabel={stats ? `+${stats.new_tenants} this month` : undefined}
            icon={<Users className="h-4 w-4 text-amber-600" />}
            iconBg="bg-amber-100 dark:bg-amber-950/50"
            loading={isLoading}
          />
          <StatCard
            label="Monthly Revenue"
            value={stats ? fmtKES(stats.monthly_revenue) : '—'}
            change={stats?.revenue_change_pct}
            changeLabel="vs last month"
            icon={<DollarSign className="h-4 w-4 text-red-500" />}
            iconBg="bg-red-100 dark:bg-red-950/50"
            loading={isLoading}
          />
          <StatCard
            label="Active Subscriptions"
            value={stats?.active_subscriptions.toLocaleString() ?? '—'}
            footer={<ViewAllLink to="/superadmin/plans" label="View all plans" />}
            icon={<Package className="h-4 w-4 text-teal-600" />}
            iconBg="bg-teal-100 dark:bg-teal-950/50"
            loading={isLoading}
          />
        </div>

        {/* ── Charts row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px_280px] gap-4 mb-4">
          <SectionCard title="Revenue Overview">
            {stats ? (
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Total Revenue</span>
                <span className={`text-xs font-semibold ${(stats.revenue_change_pct ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {(stats.revenue_change_pct ?? 0) >= 0 ? '▲' : '▼'}{' '}
                  {Math.abs(stats.revenue_change_pct ?? 0)}% vs last month
                </span>
              </div>
            ) : null}
            <RevenueTrendChart data={data?.revenue_trend ?? []} height={190} loading={isLoading} />
          </SectionCard>

          <SectionCard title="Subscription Plan Distribution">
            <PlanDistributionDonut data={data?.plan_distribution ?? []} loading={isLoading} />
          </SectionCard>

          {/* System health — real data */}
          <SectionCard title="System Health" action={<ViewAllLink to="/superadmin/system" label="Details" />}>
            {isLoading ? (
              <div className="space-y-2">{[1,2,3,4,5,6].map(i => <div key={i} className="h-7 bg-muted rounded animate-pulse" />)}</div>
            ) : health ? (
              <div className="space-y-0">
                {/* Server Status */}
                <HealthRow label="Server" value={health.server_status} />
                {/* Database with latency */}
                <HealthRow
                  label="Database"
                  value={health.database.status}
                  hint={health.database.latency_ms != null ? `${health.database.latency_ms.toFixed(1)} ms` : undefined}
                />
                {/* Redis */}
                <HealthRow label="Redis" value={health.redis} />
                {/* Storage with usage bar */}
                <div className="flex justify-between items-start py-1.5 border-b border-border text-xs">
                  <span className="text-muted-foreground">Storage</span>
                  <div className="text-right">
                    <span className={health.storage.used_pct >= 90
                      ? 'text-red-600 font-semibold dark:text-red-400'
                      : health.storage.used_pct >= 75
                        ? 'text-amber-600 font-semibold dark:text-amber-400'
                        : 'text-foreground font-medium'
                    }>
                      {health.storage.used_pct.toFixed(1)}% used
                    </span>
                    {health.storage.free_gb != null && (
                      <p className="text-muted-foreground text-[10px]">{health.storage.free_gb.toFixed(1)} GB free</p>
                    )}
                  </div>
                </div>
                {/* Queue */}
                <div className="flex justify-between items-center py-1.5 border-b border-border text-xs">
                  <span className="text-muted-foreground">Queue</span>
                  <span className="font-medium text-foreground">
                    <span className="text-muted-foreground">{health.queue.pending} pending</span>
                    {health.queue.failed > 0 && (
                      <span className="ml-2 text-red-600 dark:text-red-400">{health.queue.failed} failed</span>
                    )}
                    {health.queue.pending === 0 && health.queue.failed === 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400 ml-1">✓ Clear</span>
                    )}
                  </span>
                </div>
                {/* Uptime */}
                <div className="flex justify-between items-center py-1.5 text-xs">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-medium text-foreground">{health.uptime}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No health data.</p>
            )}
          </SectionCard>
        </div>

        {/* ── Top orgs + System usage ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 mb-4">
          {/* Top Organizations */}
          <SectionCard title="Top Organizations" action={<ViewAllLink to="/superadmin/organizations" label="View all" />} padding={false}>
            {isLoading ? (
              <div className="p-5"><SkeletonTable rows={5} cols={6} /></div>
            ) : (data?.top_organizations ?? []).length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No organizations yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Top organizations">
                  <thead>
                    <tr className="border-b border-border">
                      {['Organization', 'Owner', 'Properties', 'Tenants', 'Plan', 'Status', 'Revenue'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.top_organizations ?? []).slice(0, 8).map((org) => (
                      <tr key={org.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 text-xs font-semibold text-foreground">{org.name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{org.owner ?? '—'}</td>
                        <td className="px-4 py-3 text-xs">{org.properties}</td>
                        <td className="px-4 py-3 text-xs">{org.tenants.toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className={PLAN_COLORS[(org.plan ?? '').toLowerCase()] ?? 'text-foreground'}>
                            {org.plan ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={org.status} /></td>
                        <td className="px-4 py-3 text-xs font-medium text-foreground">{fmtKES(org.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t border-border text-center">
                  <ViewAllLink to="/superadmin/organizations" label="View all organizations" />
                </div>
              </div>
            )}
          </SectionCard>

          {/* System Usage — real data */}
          <SectionCard title="System Usage" action={<ViewAllLink to="/superadmin/system" label="Details" />}>
            {isLoading ? (
              <div className="space-y-4">{[1,2,3,4].map(i => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 bg-muted rounded animate-pulse" />
                  <div className="h-1.5 bg-muted rounded animate-pulse" />
                </div>
              ))}</div>
            ) : (
              <div className="space-y-4">
                {/* API Requests */}
                <UsageRow
                  label="API Requests"
                  value={usage?.api_requests?.display ?? '—'}
                  pct={0}
                />
                {/* Storage */}
                <UsageRow
                  label="Storage Used"
                  value={usage?.storage?.used_display ?? '—'}
                  pct={usage?.storage?.pct ?? 0}
                  warnAt={80}
                />
                {/* Bandwidth */}
                <UsageRow
                  label="Bandwidth"
                  value={usage?.bandwidth?.display ?? '—'}
                  pct={0}
                />
                {/* Active Users */}
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">Active Users</span>
                    <span className="font-medium text-foreground">
                      {(usage?.active_users?.now ?? 0).toLocaleString()} online
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span />
                    <span>{(usage?.active_users?.total ?? 0).toLocaleString()} total platform users</span>
                  </div>
                  <ProgressBar value={0} color="bg-emerald-500" />
                </div>
              </div>
            )}

            {/* System Info from system_health */}
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-foreground mb-2">System Information</p>
              {[
                ['Version', health?.app_version ? `v${health.app_version}` : '—'],
                ['PHP', health?.php_version ?? '—'],
                ['Environment', health?.environment ?? '—'],
                ['Uptime', health?.uptime ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-border last:border-0 text-xs">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground capitalize">{v}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Quick actions ───────────────────────────────────────────── */}
        <SectionCard title="Quick Actions">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.label}
                to={a.href}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-4 text-center hover:bg-muted hover:border-primary/30 transition-all"
              >
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-medium text-foreground leading-tight">{a.label}</span>
              </Link>
            ))}
          </div>
        </SectionCard>

        {/* ── AI Monitoring ───────────────────────────────────────────── */}
        <div className="mt-4">
          <AIMonitoringWidgets stats={data?.ai_monitoring} loading={isLoading} />
        </div>

        {/* ── Per-org Agent Health ─────────────────────────────────────── */}
        <div className="mt-4">
          <SectionCard title="Organization Agent Health">
            {isLoading ? (
              <div className="p-5"><SkeletonTable rows={4} cols={5} /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {['Organization', 'Pending Approvals', 'Recent Failures (24h)', 'Active Workflows', 'Audit Trail'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {((data?.organizations ?? []) as Array<{id: number|string; name: string; pending_approvals?: number; recent_failures?: number; active_workflows?: number}>).map((org) => (
                      <tr key={org.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-xs font-semibold text-foreground">{org.name}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${(org.pending_approvals ?? 0) > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                            {org.pending_approvals ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${(org.recent_failures ?? 0) > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {org.recent_failures ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{org.active_workflows ?? 0}</td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/superadmin/audit-logs?org_id=${org.id}`}
                            className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
                          >
                            View Audit →
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {(data?.organizations ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No organizations</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  )
}

// ── Helper sub-components ────────────────────────────────────────────────────

function HealthRow({ label, value, hint }: { label: string; value: string; hint?: string }): React.ReactElement {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className={`font-medium capitalize ${statusColor(value)}`}>{value}</span>
        {hint && <span className="ml-1.5 text-muted-foreground">({hint})</span>}
      </span>
    </div>
  )
}

function UsageRow({ label, value, pct, warnAt }: { label: string; value: string; pct: number; warnAt?: number }): React.ReactElement {
  const barColor = warnAt != null && pct >= warnAt
    ? pct >= 90 ? 'bg-red-500' : 'bg-amber-500'
    : 'bg-primary'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <ProgressBar value={pct} color={barColor} />
    </div>
  )
}
