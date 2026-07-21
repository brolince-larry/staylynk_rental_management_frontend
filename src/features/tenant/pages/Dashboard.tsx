// src/features/tenant/pages/Dashboard.tsx — Image 4
import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { format, addMonths } from 'date-fns'
import { PieChart, Pie, Cell } from 'recharts'
import { useTenantDashboard } from '../hooks/useDashboard'
import { useAuthStore } from '@/store/auth.store'
import { SectionCard, StatusBadge, PageHeader, EmptyState, SkeletonTable, ViewAllLink, StatCard } from '@/components/ui'
import { ToastContainer } from '@/components/forms'
import { useToast } from '@/hooks'
import { openSignedDocument } from '@/api/documentDownloads'
import { publicSiteUrl } from '@/config/env'
import { SmartImage } from '@/components/media'

function fmt(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(iso: string): string {
  try { return format(new Date(iso), 'MMM d, yyyy') } catch { return iso }
}

// Next 6 billing months starting from the next due date — the lease cycle is
// monthly, so each month after the first is a projection, not a confirmed invoice.
function upcomingMonths(fromIso: string): { label: string; year: string }[] {
  const start = new Date(fromIso)
  return Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(start, i)
    return { label: format(d, 'MMM'), year: format(d, 'yyyy') }
  })
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── Payment donut ────────────────────────────────────────────────────────
interface PaymentDonutProps { paid: number; pending: number; overdue: number; total: number }

function PaymentDonut({ paid, pending, overdue, total }: PaymentDonutProps): React.ReactElement {
  const segments = [
    { name: 'Paid',    value: paid,    color: '#10b981' },
    { name: 'Pending', value: pending, color: '#f59e0b' },
    { name: 'Overdue', value: overdue, color: '#ef4444' },
  ]
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
        <PieChart width={130} height={130}>
          <Pie data={segments} cx={60} cy={60} innerRadius={44} outerRadius={62} paddingAngle={2} dataKey="value" strokeWidth={0}>
            {segments.map((s, i) => <Cell key={i} fill={s.color} />)}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm font-bold text-foreground">{fmt(paid)}</p>
          <p className="text-xs text-muted-foreground">Total Paid</p>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {segments.map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            <span className="text-muted-foreground flex-1">{s.name}</span>
            <span className="font-medium text-foreground">
              {fmt(s.value)} ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// AI Insights panel — gradual rollout: hidden for tenants for now (AI is
// admin/superadmin only until fully rolled out). Flip to true to restore.
const AI_INSIGHTS_ENABLED: boolean = false

export default function TenantDashboard(): React.ReactElement {
  const user = useAuthStore((s) => s.user)
  const orgCurrency = user?.org?.currency ?? 'USD'
  const { data, isLoading, isError, refetch } = useTenantDashboard()
  const { toasts, info, error: toastError, dismiss } = useToast()

  const downloadReceipt = (id: string) => {
    void openSignedDocument(`/tenant/payments/${id}/receipt`, {
      onPending: (message) => info(message),
    }).catch((err) => toastError(err, 'Failed to download receipt'))
  }

  const downloadAgreement = () => {
    void openSignedDocument('/tenant/lease/agreement', {
      onPending: (message) => info(message),
    }).catch((err) => toastError(err, 'Failed to download lease agreement'))
  }

  if (!isLoading && data && !data.has_active_lease) {
    return (
      <div className="p-6">
        <PageHeader title="Dashboard" />
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <div className="text-5xl mb-4">🏠</div>
          <h2 className="text-lg font-semibold text-foreground mb-2">No active lease</h2>
          <p className="text-sm text-muted-foreground">{data.message ?? 'Contact your property manager to get started.'}</p>
        </div>
      </div>
    )
  }

  const lease = data?.lease
  const room = data?.room
  const next = data?.next_payment as {
    amount: number; base_rent: number; arrears: number; penalty: number
    due_date: string | null; days_until_due: number | null; status: string
    invoice_number?: string; is_first_payment?: boolean; deposit_amount?: number
    is_overdue?: boolean; urgency?: 'overdue' | 'due_soon' | 'ok'
  } | null | undefined
  const penaltyNotice = data?.penalty_notice as {
    enabled: boolean; type: string; amount: number; grace_days: number
    days_overdue: number; total: number; message: string
  } | null | undefined
  const overview = data?.payment_overview
  const balance = data?.account_balance

  const totalForDonut = overview ? overview.total_paid + overview.total_pending + overview.total_overdue : 0

  return (
    <>
      <Helmet><title>My Dashboard — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6 max-w-[1400px]">
        <PageHeader
          title={
            <>
              {greeting()}, <span className="text-primary">{user?.name?.split(' ')[0] ?? 'there'}</span>{' '}
              <span className="inline-block">👋</span>
            </>
          }
          subtitle="Here's what's happening with your stay."
          actions={
            <Link to="/tenant/invoices" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              💳 Make a Payment
            </Link>
          }
        />

        {isError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700">
            ⚠️ Failed to load. <button onClick={() => void refetch()} className="underline">Retry</button>
          </div>
        )}

        {/* ── Monthly rent — featured hero card ────────────────────── */}
        <div className="app-gradient-primary relative mb-4 overflow-hidden rounded-2xl p-5 text-white shadow-lg shadow-violet-500/20 sm:p-6">
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/75">Monthly Rent</p>
              {isLoading ? (
                <div className="mt-1 h-8 w-32 animate-pulse rounded bg-white/20 sm:h-9" />
              ) : (
                <p className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                  {fmt(lease?.monthly_rent ?? 0, orgCurrency)}
                </p>
              )}
              <p className="mt-1 truncate text-xs text-white/75">
                Due on {lease?.payment_due_day ?? 1}st of each month
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-sm sm:h-14 sm:w-14">
              💰
            </div>
          </div>
        </div>

        {/* ── Quick actions row ─────────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-4 gap-2 sm:gap-4">
          {[
            { icon: '💳', bg: 'bg-violet-100 dark:bg-violet-950/50', title: 'Make a Payment', href: '/tenant/invoices' },
            { icon: '📋', bg: 'bg-blue-100 dark:bg-blue-950/50', title: 'Payment History', href: '/tenant/payments' },
            { icon: '⬇️', bg: 'bg-emerald-100 dark:bg-emerald-950/50', title: 'Download Receipt', href: '/tenant/payments' },
            { icon: '💬', bg: 'bg-violet-100 dark:bg-violet-950/50', title: 'Support', href: '/tenant/support' },
          ].map((a) => (
            <Link key={a.title} to={a.href}
              className="flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-2 text-center transition-transform hover:-translate-y-0.5">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base shadow-sm sm:h-12 sm:w-12 ${a.bg}`}>{a.icon}</div>
              <p className="line-clamp-2 text-[0.7rem] font-medium leading-tight text-foreground sm:text-xs">{a.title}</p>
            </Link>
          ))}
        </div>

        {/* ── Room / Total Paid / Next payment / Lease status ───────── */}
        <div className="grid grid-cols-1 gap-3 mb-5 sm:grid-cols-2">
          <StatCard
            label="Room"
            value={room?.room_number ?? '—'}
            icon={<span className="text-lg">🛏</span>}
            iconBg="bg-violet-100 dark:bg-violet-950/50"
            accentGlow="bg-violet-500"
            loading={isLoading}
            footer={
              <p className="text-xs text-muted-foreground">
                {room?.type ?? 'N/A'} · Block {room?.block}, {room?.floor} Floor
              </p>
            }
          />

          <StatCard
            label="Total Paid"
            value={overview ? fmt(overview.total_paid, orgCurrency) : '—'}
            icon={<span className="text-lg">💰</span>}
            iconBg="bg-amber-100 dark:bg-amber-950/50"
            accentGlow="bg-amber-500"
            loading={isLoading}
            footer={<p className="text-xs text-muted-foreground">All time</p>}
          />

          <StatCard
            label="Next Payment Due"
            value={next?.due_date ? fmtDate(next.due_date) : 'N/A'}
            icon={<span className="text-lg">{next?.is_first_payment ? '🏠' : '📅'}</span>}
            iconBg={
              next?.is_first_payment ? 'bg-violet-100 dark:bg-violet-950/50'
                : next?.urgency === 'overdue' ? 'bg-red-100 dark:bg-red-950/50'
                : next?.urgency === 'due_soon' ? 'bg-amber-100 dark:bg-amber-950/50'
                : 'bg-emerald-100 dark:bg-emerald-950/50'
            }
            accentBorder={
              next?.is_first_payment ? 'border-violet-500'
                : next?.urgency === 'overdue' ? 'border-red-500'
                : next?.urgency === 'due_soon' ? 'border-amber-500'
                : 'border-emerald-500'
            }
            accentGlow={
              next?.is_first_payment ? 'bg-violet-500'
                : next?.urgency === 'overdue' ? 'bg-red-500'
                : next?.urgency === 'due_soon' ? 'bg-amber-500'
                : 'bg-emerald-500'
            }
            loading={isLoading}
            footer={
              <div className="space-y-1">
                {next?.is_first_payment && (
                  <span className="inline-flex rounded-full bg-violet-100 dark:bg-violet-950/50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                    First Payment
                  </span>
                )}
                {next && next.due_date && !next.is_first_payment && (
                  <p className={`text-xs font-medium ${next.urgency === 'overdue' ? 'text-red-600' : next.urgency === 'due_soon' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {next.is_overdue
                      ? `${Math.abs(next.days_until_due ?? 0)} days overdue`
                      : (next.days_until_due ?? 0) <= 0
                        ? 'Due today'
                        : `${next.days_until_due} days remaining`}
                  </p>
                )}
                {next && next.amount > 0 && (
                  <p className="text-xs font-bold text-primary">{fmt(next.amount, orgCurrency)}</p>
                )}
                {next?.is_first_payment ? (
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Rent: {fmt(next.base_rent, orgCurrency)}</p>
                    {(next.deposit_amount ?? 0) > 0 && (
                      <p className="text-[10px] text-violet-600">+ {fmt(next.deposit_amount ?? 0, orgCurrency)} deposit</p>
                    )}
                  </div>
                ) : next && (next.arrears > 0 || next.penalty > 0) && (
                  <div className="space-y-0.5">
                    {next.arrears > 0 && <p className="text-[10px] text-orange-600">+ {fmt(next.arrears, orgCurrency)} arrears</p>}
                    {next.penalty > 0 && <p className="text-[10px] text-red-600">+ {fmt(next.penalty, orgCurrency)} penalty</p>}
                  </div>
                )}
              </div>
            }
          />

          <StatCard
            label="Lease Status"
            value={lease?.status ?? 'N/A'}
            valueClassName="capitalize text-emerald-600 dark:text-emerald-400"
            icon={<span className="text-lg">✅</span>}
            iconBg="bg-emerald-100 dark:bg-emerald-950/50"
            accentGlow="bg-emerald-500"
            loading={isLoading}
            footer={
              <p className="text-xs text-muted-foreground">
                Ends {lease?.end_date ? fmtDate(lease.end_date) : '—'}
              </p>
            }
          />
        </div>

        {/* ── Upcoming payments ─────────────────────────────────────── */}
        <SectionCard
          title="Upcoming Payments"
          action={<ViewAllLink to="/tenant/invoices" label="View all" />}
          className="mb-4"
        >
          {isLoading ? (
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          ) : next?.due_date ? (
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="flex min-w-max items-end gap-4 border-t border-dashed border-border pt-3 sm:gap-6">
                  {upcomingMonths(next.due_date).map((m, i) => (
                    <div key={`${m.label}-${m.year}`} className="flex flex-col items-center gap-1.5">
                      <div className={`h-6 w-2.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/25'}`} />
                      <p className="whitespace-nowrap text-center text-[0.65rem] leading-tight text-muted-foreground">
                        {m.label}<br />{m.year}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="shrink-0 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-center">
                <p className="text-lg font-bold leading-none text-foreground">
                  ⏳ {Math.max(next.days_until_due ?? 0, 0)}
                </p>
                <p className="mt-1 whitespace-nowrap text-[0.65rem] text-muted-foreground">Days Left</p>
              </div>
            </div>
          ) : <EmptyState title="No upcoming payments" />}
        </SectionCard>

        {/* ── Penalty notice banner (never shown to first-timers) ──── */}
        {penaltyNotice?.enabled && !next?.is_first_payment && (
          <div className="mb-4 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 px-4 py-3 flex items-start gap-3">
            <span className="text-lg shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Late Payment Penalty Active</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">{penaltyNotice.message}</p>
              {penaltyNotice.days_overdue > 0 && (
                <p className="text-xs text-red-700 dark:text-red-400 font-medium mt-1">
                  {penaltyNotice.days_overdue} day(s) overdue · Total penalty: {fmt(penaltyNotice.total, orgCurrency)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Lease info + Payment overview + Account balance ───────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Lease info */}
          <SectionCard
            title="Lease Information"
            action={<StatusBadge status={lease?.status ?? 'pending'} />}
          >
            {isLoading ? (
              <div className="space-y-3">{[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-3 bg-muted rounded animate-pulse" />)}</div>
            ) : lease ? (
              <>
                {[
                  ['🪪', 'Lease ID', lease.lease_number],
                  ['📅', 'Start Date', fmtDate(lease.start_date)],
                  ['📅', 'End Date', fmtDate(lease.end_date)],
                  ['🔁', 'Lease Term', `${lease.term_months} Months`],
                  ['💰', 'Monthly Rent', fmt(lease.monthly_rent, orgCurrency)],
                  ['🔒', 'Security Deposit', fmt(lease.security_deposit, orgCurrency)],
                  ['🔁', 'Payment Due Date', `${(lease as Record<string, unknown>).payment_due_day ?? 1}st Of Each Month`],
                  ['💳', 'Payment Method', lease.payment_method?.replace(/_/g, ' ')],
                  ...(lease.last_paid_date ? [['✅', 'Last Payment', `${fmtDate(lease.last_paid_date)} — ${fmt((lease as Record<string, unknown>).last_paid_amount as number ?? 0, orgCurrency)}`]] : []),
                  ...((lease as Record<string, unknown>).arrears_balance as number > 0 ? [['⚠️', 'Arrears Balance', fmt((lease as Record<string, unknown>).arrears_balance as number, orgCurrency)]] : []),
                ].map(([icon, label, value]) => (
                  <div key={label as string} className="flex justify-between gap-3 py-1.5 border-b border-border last:border-0">
                    <span className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="text-[0.8rem]">{icon as string}</span> {label as string}
                    </span>
                    <span className="min-w-0 break-words text-xs font-medium text-foreground text-right capitalize">{value as string}</span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={downloadAgreement}
                  className="mt-3 w-full rounded-lg border border-border px-4 py-2 text-xs font-medium text-primary hover:bg-muted transition-colors"
                >
                  📄 View Lease Agreement
                </button>
              </>
            ) : <EmptyState title="No lease found" />}
          </SectionCard>

          {/* Payment overview */}
          <SectionCard title="Payment Overview">
            {isLoading ? (
              <div className="flex items-center gap-4">
                <div className="h-32 w-32 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">{[1,2,3].map(i => <div key={i} className="h-3 bg-muted rounded animate-pulse" />)}</div>
              </div>
            ) : overview ? (
              <PaymentDonut
                paid={overview.total_paid}
                pending={overview.total_pending}
                overdue={overview.total_overdue}
                total={totalForDonut || overview.total_paid}
              />
            ) : <EmptyState title="No payment data" />}
          </SectionCard>

          {/* Account balance */}
          <SectionCard title="Account Balance">
            {isLoading ? (
              <div className="space-y-3 py-4">
                <div className="h-4 w-32 bg-muted rounded animate-pulse mx-auto" />
                <div className="h-10 w-24 bg-muted rounded animate-pulse mx-auto" />
              </div>
            ) : (
              <div className="relative py-2 text-center">
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 opacity-[0.08] blur-2xl dark:opacity-[0.14]" />
                <p className="relative text-xs text-muted-foreground mb-1">Total Outstanding</p>
                <p className="relative truncate text-2xl font-bold text-emerald-600 sm:text-3xl lg:text-4xl" title={fmt(balance?.total_outstanding ?? 0, orgCurrency)}>
                  {fmt(balance?.total_outstanding ?? 0, orgCurrency)}
                </p>
                {balance?.is_up_to_date && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    ✅ You are all up to date!
                  </div>
                )}
                <Link to="/tenant/invoices" className="mt-4 block w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                  💳 Make a Payment
                </Link>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Payment history ──────────────────────────────────────── */}
        <SectionCard title="Payment History" action={<ViewAllLink to="/tenant/payments" label="View All" />} padding={false} className="mb-4">
          {isLoading ? (
            <div className="p-5"><SkeletonTable rows={6} cols={7} /></div>
          ) : (data?.payment_history ?? []).length ? (
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Payment history">
                <thead>
                  <tr className="border-b border-border">
                    {['Invoice #', 'Month', 'Due Date', 'Amount', 'Status', 'Paid Date', 'Receipt'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.payment_history ?? []).map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs font-mono text-foreground">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{inv.invoice_month}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(inv.due_date)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{fmt(inv.total_amount, orgCurrency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {inv.paid_at ? fmtDate(inv.paid_at) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {inv.status === 'paid' && inv.payment_uuid ? (
                          <button type="button" onClick={() => downloadReceipt(inv.payment_uuid as string)}
                            className="text-xs text-primary hover:underline">⬇ Download</button>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="p-5"><EmptyState title="No payment history yet" /></div>}
        </SectionCard>

        {/* ── Room details + Announcements + Contact ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Room details */}
          <SectionCard title="Room Details">
            <div className="flex gap-3">
              <div className="w-28 shrink-0 overflow-hidden rounded-lg bg-muted" style={{ height: 88 }}>
                {room?.cover_image ? (
                  <SmartImage
                    src={room.cover_image}
                    alt={`Room ${room?.room_number ?? ''}`}
                    usage="card"
                    aspectRatio="1 / 1"
                    sizes="112px"
                    wrapperClassName="h-full w-full"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">🖼</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">Room {room?.room_number ?? '—'}</p>
                <p className="truncate text-xs text-muted-foreground mb-3">{room?.type ?? 'N/A'}</p>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Block</span>
                  <span className="font-medium">Block {room?.block}</span>
                  <span className="text-muted-foreground">Floor</span>
                  <span className="font-medium">{room?.floor} Floor</span>
                  <span className="text-muted-foreground">Occupancy</span>
                  <span className="font-medium">{room?.current_occupants ?? 0} / {room?.capacity ?? 0} Tenants</span>
                  <span className="text-muted-foreground">Room Type</span>
                  <span className="font-medium capitalize">{room?.type ?? 'N/A'}</span>
                </div>
                <Link to="/tenant/room" className="mt-3 inline-block rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                  View Room Details
                </Link>
              </div>
            </div>
          </SectionCard>

          {/* Announcements */}
          <SectionCard title="Recent Announcements" action={<ViewAllLink to="/tenant/announcements" label="View All" />}>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
            ) : (data?.announcements ?? []).length ? (
              (data?.announcements ?? []).slice(0, 3).map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/50 text-xs shrink-0">
                    {a.category === 'maintenance' ? '🔧' : a.category === 'announcement' ? '📢' : '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground leading-tight">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.content}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {fmtDate(a.published_at)}
                  </span>
                </div>
              ))
            ) : <EmptyState title="No announcements" />}
          </SectionCard>

          {/* Contact property */}
          <SectionCard title="Contact Property">
            <div className="space-y-0">
              {[
                ['📞', data?.property?.phone ?? '+1 (555) 123-4567'],
                ['✉️', data?.property?.email ?? 'management@hostel.com'],
                ['🕐', 'Mon - Sun: 8:00 AM - 8:00 PM'],
              ].map(([icon, text]) => (
                <div key={text as string} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 text-xs">
                  <span className="text-base">{icon as string}</span>
                  <span className="text-foreground">{text as string}</span>
                </div>
              ))}
            </div>
            <Link to="/tenant/messages" className="mt-4 block w-full rounded-lg border border-border px-4 py-2 text-center text-xs font-medium text-primary hover:bg-muted transition-colors">
              💬 Send Message
            </Link>

            {/* Lease summary */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-foreground mb-3">My Lease Summary</p>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                <span className="text-muted-foreground">Lease ID</span>
                <span className="min-w-0 break-words font-medium text-right">{lease?.lease_number ?? '—'}</span>
                <span className="text-muted-foreground">Start Date</span>
                <span className="min-w-0 break-words text-right">{lease?.start_date ? fmtDate(lease.start_date) : '—'}</span>
                <span className="text-muted-foreground">End Date</span>
                <span className="min-w-0 break-words text-right">{lease?.end_date ? fmtDate(lease.end_date) : '—'}</span>
                <span className="text-muted-foreground">Days Remaining</span>
                <span className="min-w-0 break-words text-right font-semibold text-emerald-600">{lease?.days_remaining ?? 0} days</span>
              </div>
              <button
                type="button"
                onClick={downloadAgreement}
                className="mt-3 w-full rounded-lg border border-border px-4 py-2 text-xs font-medium text-primary hover:bg-muted transition-colors"
              >
                📄 View Lease Agreement
              </button>
            </div>
          </SectionCard>
        </div>

        {/* ── AI Insights ───────────────────────────────────────────────────
            Gradual rollout: hidden for tenants for now (AI is admin/superadmin
            only until fully rolled out). See AI_INSIGHTS_ENABLED above. */}
        {AI_INSIGHTS_ENABLED && (
        <div className="mt-5 rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 p-5 dark:border-violet-500/20 dark:from-violet-950/30 dark:to-indigo-950/20">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
              <span className="text-sm">🤖</span>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">My AI Summary</p>
              <p className="text-xs text-muted-foreground">Personalized insights from StayLynk AI</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Rent status */}
            <div className="rounded-xl border border-border bg-card/80 p-3">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Rent Status</p>
              {overview ? (
                <>
                  <p className={`text-sm font-bold ${overview.total_overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {overview.total_overdue > 0 ? `⚠ KES ${overview.total_overdue.toLocaleString()} overdue` : '✓ All payments clear'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {overview.total_pending > 0 && `KES ${overview.total_pending.toLocaleString()} pending`}
                  </p>
                </>
              ) : <p className="text-xs text-muted-foreground">—</p>}
            </div>

            {/* Maintenance priority */}
            <div className="rounded-xl border border-border bg-card/80 p-3">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">AI Maintenance Priority</p>
              {(data?.open_maintenance ?? 0) > 0 ? (
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {data!.open_maintenance} open request{data!.open_maintenance !== 1 ? 's' : ''}
                </p>
              ) : <p className="text-xs text-muted-foreground">No open requests</p>}
              <Link to="/tenant/maintenance" className="mt-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400">
                View requests →
              </Link>
            </div>

            {/* Find similar rooms */}
            <div className="rounded-xl border border-border bg-card/80 p-3">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Explore</p>
              <p className="text-xs text-muted-foreground mb-2">Looking for similar rooms in the area?</p>
              <a
                href={`${publicSiteUrl}/hunter${room?.type ? `?type=${encodeURIComponent(room.type)}` : ''}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
              >
                🔍 Find Similar Rooms
              </a>
            </div>
          </div>
        </div>
        )}
      </div>
    </>
  )
}
