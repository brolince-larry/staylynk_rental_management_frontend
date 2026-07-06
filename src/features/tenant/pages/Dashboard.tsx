// src/features/tenant/pages/Dashboard.tsx — Image 4
import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { PieChart, Pie, Cell } from 'recharts'
import { useTenantDashboard } from '../hooks/useDashboard'
import { useAuthStore } from '@/store/auth.store'
import { SectionCard, StatusBadge, PageHeader, EmptyState, SkeletonTable, ViewAllLink } from '@/components/ui'
import { ToastContainer } from '@/components/forms'
import { useToast } from '@/hooks'
import { openSignedDocument } from '@/api/documentDownloads'
import { publicSiteUrl } from '@/config/env'

function fmt(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(iso: string): string {
  try { return format(new Date(iso), 'MMM d, yyyy') } catch { return iso }
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
          title="Dashboard"
          subtitle={`Welcome back, ${user?.name?.split(' ')[0] ?? 'there'}! 👋 Here's what's happening with your stay.`}
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

        {/* ── Top 4 info cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {/* Room */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/50 text-xl shrink-0">🛏</div>
              <div>
                <p className="text-xs text-muted-foreground">Room</p>
                {isLoading ? <div className="h-6 w-12 bg-muted rounded animate-pulse mt-0.5" /> : (
                  <p className="text-2xl font-bold text-foreground leading-tight">{room?.room_number ?? '—'}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{room?.type ?? 'N/A'}</p>
                <p className="text-xs text-muted-foreground">Block {room?.block}, {room?.floor} Floor</p>
              </div>
            </div>
          </div>

          {/* Monthly rent */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-xl shrink-0">💰</div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Rent</p>
                {isLoading ? <div className="h-6 w-20 bg-muted rounded animate-pulse mt-0.5" /> : (
                  <p className="text-xl font-bold text-foreground">{fmt(lease?.monthly_rent ?? 0, orgCurrency)}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Due on {lease?.payment_due_day ?? 1}st of each month
                </p>
              </div>
            </div>
          </div>

          {/* Next payment */}
          <div className={`rounded-xl border bg-card p-4 ${next?.is_first_payment ? 'border-violet-400 dark:border-violet-700' : next?.days_until_due != null && next.days_until_due < 0 ? 'border-red-400 dark:border-red-700' : next?.days_until_due != null && next.days_until_due <= 5 ? 'border-amber-400 dark:border-amber-700' : 'border-border'}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl shrink-0 ${next?.is_first_payment ? 'bg-violet-100 dark:bg-violet-950/50' : 'bg-amber-100 dark:bg-amber-950/50'}`}>
                {next?.is_first_payment ? '🏠' : '📅'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">Next Payment Due</p>
                  {next?.is_first_payment && (
                    <span className="rounded-full bg-violet-100 dark:bg-violet-950/50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">First Payment</span>
                  )}
                </div>
                {isLoading ? <div className="h-6 w-24 bg-muted rounded animate-pulse mt-0.5" /> : (
                  <p className="text-xl font-bold text-foreground leading-tight">
                    {next?.due_date ? fmtDate(next.due_date) : 'N/A'}
                  </p>
                )}
                {next && next.due_date && !next.is_first_payment && (
                  <p className={`text-xs font-medium mt-0.5 ${(next.days_until_due ?? 0) < 0 ? 'text-red-600' : (next.days_until_due ?? 0) <= 5 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {(next.days_until_due ?? 0) < 0
                      ? `${Math.abs(next.days_until_due ?? 0)} days overdue`
                      : `${next.days_until_due} days remaining`}
                  </p>
                )}
                {next && next.amount > 0 && (
                  <p className="text-xs font-bold text-primary mt-1">{fmt(next.amount, orgCurrency)}</p>
                )}
                {next?.is_first_payment ? (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Rent: {fmt(next.base_rent, orgCurrency)}</p>
                    {(next.deposit_amount ?? 0) > 0 && (
                      <p className="text-[10px] text-violet-600">+ {fmt(next.deposit_amount ?? 0, orgCurrency)} deposit</p>
                    )}
                  </div>
                ) : next && (next.arrears > 0 || next.penalty > 0) && (
                  <div className="mt-1.5 space-y-0.5">
                    {next.arrears > 0 && <p className="text-[10px] text-orange-600">+ {fmt(next.arrears, orgCurrency)} arrears</p>}
                    {next.penalty > 0 && <p className="text-[10px] text-red-600">+ {fmt(next.penalty, orgCurrency)} penalty</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lease status */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-xl shrink-0">✅</div>
              <div>
                <p className="text-xs text-muted-foreground">Lease Status</p>
                {isLoading ? <div className="h-6 w-16 bg-muted rounded animate-pulse mt-0.5" /> : (
                  <p className="text-xl font-bold text-emerald-600 capitalize">{lease?.status ?? 'N/A'}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ends {lease?.end_date ? fmtDate(lease.end_date) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

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
                  ['Lease ID', lease.lease_number],
                  ['Start Date', fmtDate(lease.start_date)],
                  ['End Date', fmtDate(lease.end_date)],
                  ['Lease Term', `${lease.term_months} Months`],
                  ['Monthly Rent', fmt(lease.monthly_rent, orgCurrency)],
                  ['Security Deposit', fmt(lease.security_deposit, orgCurrency)],
                  ['Payment Due Date', `${(lease as Record<string, unknown>).payment_due_day ?? 1}st Of Each Month`],
                  ['Payment Method', lease.payment_method?.replace(/_/g, ' ')],
                  ...(lease.last_paid_date ? [['Last Payment', `${fmtDate(lease.last_paid_date)} — ${fmt((lease as Record<string, unknown>).last_paid_amount as number ?? 0, orgCurrency)}`]] : []),
                  ...((lease as Record<string, unknown>).arrears_balance as number > 0 ? [['Arrears Balance', fmt((lease as Record<string, unknown>).arrears_balance as number, orgCurrency)]] : []),
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground">{label as string}</span>
                    <span className="text-xs font-medium text-foreground text-right capitalize">{value as string}</span>
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
              <div className="text-center py-2">
                <p className="text-xs text-muted-foreground mb-1">Total Outstanding</p>
                <p className="text-4xl font-bold text-emerald-600">{fmt(balance?.total_outstanding ?? 0, orgCurrency)}</p>
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

            {/* Quick actions */}
            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold text-foreground">Quick Actions</p>
              {[
                { icon: '💳', bg: 'bg-violet-100 dark:bg-violet-950/50', title: 'Make a Payment', sub: 'Pay your rent securely', href: '/tenant/invoices' },
                { icon: '⬇️', bg: 'bg-emerald-100 dark:bg-emerald-950/50', title: 'Download Receipt', sub: 'Get your payment receipt', href: '/tenant/payments' },
                { icon: '🔧', bg: 'bg-amber-100 dark:bg-amber-950/50', title: 'Maintenance Request', sub: 'Report an issue', href: '/tenant/maintenance' },
                { icon: '💬', bg: 'bg-blue-100 dark:bg-blue-950/50', title: 'Contact Management', sub: 'Get in touch', href: '/tenant/messages' },
              ].map((a) => (
                <Link key={a.title} to={a.href}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm ${a.bg}`}>{a.icon}</div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.sub}</p>
                    </div>
                  </div>
                  <span className="text-muted-foreground text-sm">›</span>
                </Link>
              ))}
            </div>
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
                        {inv.status === 'paid' ? (
                          <button type="button" onClick={() => downloadReceipt(String(inv.id))}
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
              <div className="w-28 h-22 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-2xl shrink-0 overflow-hidden" style={{ height: 88 }}>
                🖼
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Room {room?.room_number ?? '—'}</p>
                <p className="text-xs text-muted-foreground mb-3">{room?.type ?? 'N/A'}</p>
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
                <span className="font-medium">{lease?.lease_number ?? '—'}</span>
                <span className="text-muted-foreground">Start Date</span>
                <span>{lease?.start_date ? fmtDate(lease.start_date) : '—'}</span>
                <span className="text-muted-foreground">End Date</span>
                <span>{lease?.end_date ? fmtDate(lease.end_date) : '—'}</span>
                <span className="text-muted-foreground">Days Remaining</span>
                <span className="text-emerald-600 font-semibold">{lease?.days_remaining ?? 0} days</span>
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

        {/* ── AI Insights ───────────────────────────────────────────── */}
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
      </div>
    </>
  )
}
