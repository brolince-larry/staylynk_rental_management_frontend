import React, { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { AlertCircle, BarChart3, Building2, Check, CheckCircle, Clock, CreditCard, Crown, Headphones, Home, Phone, Sparkles, Star, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { Button, FormField, Input, Modal, ToastContainer } from '@/components/forms'
import { EmptyState, PageHeader, StatusBadge, StatCard } from '@/components/ui'
import { usePagination, useToast } from '@/hooks'
import { formatCurrency, formatDate } from '@/utils/format'
import { useAuthStore } from '@/store/auth.store'
import { isApiError } from '@/utils/errors'
import {
  useAdminBillingInvoices,
  useAdminCurrentSubscription,
  useAdminSubscriptionPlans,
  useBillingPaymentStatus,
  useInitiateBillingMpesa,
  useSubscribeToPlan,
} from '../layout/hooks/useBillingPayments'
import type { AdminBillingInvoice, BillingPaymentResult } from '@/api/billingPayments'
import type { BillingCycle, SubscriptionInvoice, SubscriptionPlan } from '@/api/subscriptions'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const phoneSchema = z.object({
  phone_number: z.string().min(10, 'Enter a valid M-Pesa number').max(20),
})
type PhoneForm = z.infer<typeof phoneSchema>

const subscribeSchema = z.object({
  phone_number: z.string().max(20).optional().or(z.literal('')),
})
type SubscribeForm = z.infer<typeof subscribeSchema>

// ─── Constants ───────────────────────────────────────────────────────────────

const COMPLETE_STATUSES = ['completed', 'failed', 'cancelled']

const USAGE_LIMITS: Array<[keyof ReturnType<typeof getUsage>, string, string[]]> = [
  ['properties', 'Properties', ['properties']],
  ['units',      'Units',       ['rooms', 'units']],
  ['tenants',    'Tenants',     ['tenants']],
  ['admins',     'Admins',      ['admins', 'users']],
  ['workers',    'Workers',     ['workers']],
]

const WHY_UPGRADE = [
  { icon: Building2, title: 'More Properties', text: 'List and manage more properties and units' },
  { icon: Users,     title: 'More Tenants',    text: 'Handle more tenants and leases easily' },
  { icon: Home,      title: 'Better Visibility', text: 'Get featured in public listings and search' },
  { icon: BarChart3, title: 'Advanced Reports', text: 'Make data-driven decisions with analytics' },
  { icon: Headphones, title: 'Priority Support', text: 'Faster support when you need it most' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getUsage(current: { usage?: Partial<Record<string, number>> } | undefined) {
  return {
    properties: num(current?.usage?.properties),
    units:      num(current?.usage?.units),
    tenants:    num(current?.usage?.tenants),
    admins:     num(current?.usage?.admins),
    workers:    num(current?.usage?.workers),
  }
}

function planLimit(plan: SubscriptionPlan | null | undefined, keys: string[]): number {
  if (!plan) return -1
  for (const key of keys) {
    const value = plan.limits?.[key]
    if (value !== undefined && value !== null) return num(value, -1)
  }
  return -1
}

function limitLabel(value: number): string {
  return value < 0 ? 'Unlimited' : value.toLocaleString()
}

function planFeatures(plan: SubscriptionPlan): string[] {
  const listed = Array.isArray(plan.features)
    ? plan.features.filter((item): item is string => typeof item === 'string')
    : []
  const caps = plan.capabilities ?? {}
  const enabledCaps = Object.entries(caps)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
  return [...listed, ...enabledCaps]
}

function planIcon(plan: SubscriptionPlan): React.ReactElement {
  const name = plan.name.toLowerCase()
  if (name.includes('enterprise')) return <Crown className="h-5 w-5 text-amber-600" />
  if (plan.is_recommended || name.includes('premium')) return <Star className="h-5 w-5 text-blue-600" />
  return <Home className="h-5 w-5 text-blue-600" />
}

function invoiceFromResult(invoice: SubscriptionInvoice): AdminBillingInvoice {
  return {
    uuid:           invoice.uuid,
    invoice_number: invoice.invoice_number,
    total:          invoice.total,
    status:         invoice.status,
    due_date:       invoice.due_date,
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminBilling(): React.ReactElement {
  const user     = useAuthStore((s) => s.user)
  const currency = user?.org?.currency ?? 'KES'
  const { page, perPage, setPage, setPerPage } = usePagination()

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  // subscribe modal: plan selected, waiting for optional phone confirmation
  const [subscribeTarget, setSubscribeTarget] = useState<SubscriptionPlan | null>(null)
  // pay modal: invoice to pay via STK push
  const [payInvoice, setPayInvoice]       = useState<AdminBillingInvoice | null>(null)
  const [paymentResult, setPaymentResult] = useState<BillingPaymentResult | null>(null)

  const { toasts, success, error: toastError, dismiss } = useToast()
  const { data, isLoading, isError, refetch } = useAdminBillingInvoices({ page, per_page: perPage })
  const { data: plans = [], isLoading: plansLoading } = useAdminSubscriptionPlans()
  const { data: current, isLoading: currentLoading }  = useAdminCurrentSubscription()
  const { mutate: subscribe,      isPending: subscribing }  = useSubscribeToPlan()
  const { mutate: initiateMpesa,  isPending: sending }      = useInitiateBillingMpesa()
  const { data: trackedPayment } = useBillingPaymentStatus(paymentResult?.payment_reference)

  const rows        = data?.data ?? []
  const meta        = data?.meta
  const pendingTotal = rows.reduce((sum, row) => sum + num(row.total), 0)
  const overdueCount = rows.filter((row) => row.status === 'overdue').length
  const usage          = useMemo(() => getUsage(current), [current])
  const currentPlan    = current?.subscription?.plan
  const daysRemaining  = current?.subscription?.days_remaining ??
    (current?.subscription?.ends_at
      ? Math.max(0, Math.ceil((new Date(current.subscription.ends_at).getTime() - Date.now()) / 86_400_000))
      : null)
  const isOnTrial      = (current?.subscription?.is_trial === true) && ((current?.subscription?.trial_days_remaining ?? 0) > 0)
  const trialDaysLeft  = current?.subscription?.trial_days_remaining ?? 0

  const subscribeForm = useForm<SubscribeForm>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: { phone_number: '' },
  })
  const payForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone_number: '' },
  })

  const closeSubscribeModal = () => {
    setSubscribeTarget(null)
    subscribeForm.reset()
  }

  const closePayModal = () => {
    setPayInvoice(null)
    setPaymentResult(null)
    payForm.reset()
  }

  const openPayModal = (invoice: AdminBillingInvoice) => {
    setPayInvoice(invoice)
    setPaymentResult(null)
    payForm.reset()
  }

  const choosePlan = (plan: SubscriptionPlan) => {
    setSubscribeTarget(plan)
    subscribeForm.reset({ phone_number: '' })
  }

  const submitSubscribe = (values: SubscribeForm) => {
    if (!subscribeTarget) return
    const planName = subscribeTarget.name
    subscribe(
      {
        planSlug:     subscribeTarget.slug,
        billingCycle,
        phoneNumber:  isOnTrial ? undefined : (values.phone_number || undefined),
      },
      {
        onSuccess: (response) => {
          closeSubscribeModal()
          const result = response.data
          if (result.trial) {
            if (result.trial_days_remaining !== undefined) {
              const d = result.trial_days_remaining
              success(`Switched to ${planName}. ${d} trial day${d !== 1 ? 's' : ''} remaining.`)
            } else {
              success(
                result.trial_ends_at
                  ? `Trial started! Free until ${formatDate(result.trial_ends_at)}.`
                  : 'Your free trial has started. No payment required yet.'
              )
            }
          } else if (result.payment && result.invoice) {
            // STK push was fired inline (phone was provided)
            setPaymentResult({
              invoice_number:    result.invoice.invoice_number,
              amount:            result.invoice.total,
              payment_reference: result.payment.payment_reference,
              status:            result.payment.status,
              tracking_endpoint: result.payment.tracking_endpoint,
            })
            openPayModal(invoiceFromResult(result.invoice))
          } else if (result.invoice) {
            // Invoice created, need to pay separately
            openPayModal(invoiceFromResult(result.invoice))
          } else {
            success('Subscription updated.')
            void refetch()
          }
        },
        onError: (err) => {
          if (isApiError(err) && err.status === 409) {
            // A payment is already pending for a previous plan change
            const d = err.data as Record<string, unknown> | undefined
            const uuid = d?.invoice_uuid as string | undefined
            if (uuid) {
              closeSubscribeModal()
              openPayModal({
                uuid,
                invoice_number: String(d?.invoice_number ?? ''),
                total:          num(d?.amount),
                status:         String(d?.status ?? 'pending'),
              })
              toastError(err, 'A plan change is already pending — pay the existing invoice to continue')
              return
            }
          }
          toastError(err, 'Unable to select subscription plan')
        },
      }
    )
  }

  const submitPayment = (values: PhoneForm) => {
    if (!payInvoice) return
    initiateMpesa(
      { invoiceUuid: payInvoice.uuid, phone_number: values.phone_number },
      {
        onSuccess: (response) => {
          setPaymentResult(response.data)
          void refetch()
        },
        onError: (err) => toastError(err, 'Unable to initiate payment'),
      }
    )
  }

  const trackedStatus = trackedPayment?.status ?? paymentResult?.status
  const isComplete    = trackedStatus ? COMPLETE_STATUSES.includes(trackedStatus) : false

  // ─── Columns ───────────────────────────────────────────────────────────────

  const columns: ColumnDef<AdminBillingInvoice>[] = [
    {
      key: 'invoice_number', header: 'Invoice #',
      accessor: (row) => (
        <span className="font-mono text-xs text-foreground">{row.invoice_number}</span>
      ),
    },
    {
      key: 'plan_name', header: 'Plan',
      accessor: (row) => (
        <span className="text-xs text-muted-foreground">{row.plan_name ?? 'Subscription'}</span>
      ),
    },
    {
      key: 'total', header: 'Amount', align: 'right',
      accessor: (row) => (
        <span className="text-xs font-semibold text-foreground">{formatCurrency(row.total, currency)}</span>
      ),
    },
    {
      key: 'due_date', header: 'Due Date',
      accessor: (row) => (
        <span className={row.status === 'overdue' ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>
          {row.due_date ? formatDate(row.due_date) : '—'}
        </span>
      ),
    },
    { key: 'status', header: 'Status', accessor: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: '', width: 'w-40',
      accessor: (row) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openPayModal(row)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <CreditCard className="h-3 w-3" /> Pay with M-Pesa
          </button>
        </div>
      ),
    },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Helmet><title>Subscription Billing — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="animate-page-slide-in p-6">
        <PageHeader
          title="Choose the best plan for your business"
          subtitle="Upgrade your plan to unlock more features and grow your business."
        />

        {/* ── Trial banner ── */}
        {!currentLoading && isOnTrial && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">You are on a free trial</span> — {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining.
              {' '}Choose your plan now. No payment needed until the trial ends.
            </p>
          </div>
        )}

        {/* ── Current plan banner ── */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          {currentLoading ? (
            <div className="h-14 animate-pulse rounded bg-muted" />
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Plan</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{currentPlan?.name ?? 'No active plan'}</p>
                    {current?.subscription?.status && <StatusBadge status={current.subscription.status} />}
                  </div>
                  {current?.subscription?.ends_at && (
                    <p className="text-xs text-muted-foreground">
                      {current.subscription.status === 'trial' ? 'Trial ends' : 'Renews'}:{' '}
                      {formatDate(current.subscription.ends_at)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6 text-right">
                {daysRemaining !== null && (
                  <div>
                    <p className="text-xl font-bold tabular-nums text-foreground">{daysRemaining}</p>
                    <p className="text-xs text-muted-foreground">Days remaining</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
          <div>
            {/* ── Billing cycle toggle ── */}
            <div className="mb-5 flex justify-center">
              <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
                {(['monthly', 'annual'] as BillingCycle[]).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${billingCycle === cycle ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {cycle}
                  </button>
                ))}
                <span className="ml-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  Save 17%
                </span>
              </div>
            </div>

            {/* ── Plan cards ── */}
            {plansLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-[460px] animate-pulse rounded-xl border border-border bg-card" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {plans.map((plan) => {
                  const price             = billingCycle === 'annual' ? num(plan.annual_price, num(plan.monthly_price) * 12) : num(plan.monthly_price)
                  const monthlyEquivalent = billingCycle === 'annual' ? Math.round(price / 12) : price
                  const isCurrent         = plan.slug === currentPlan?.slug
                  const currentPrice      = billingCycle === 'annual'
                    ? num(currentPlan?.annual_price, num(currentPlan?.monthly_price) * 12)
                    : num(currentPlan?.monthly_price)
                  const isCustom  = price === 0
                  const action    = isCurrent
                    ? 'Current plan'
                    : isOnTrial
                      ? 'Switch to this plan'
                      : price > currentPrice
                        ? 'Upgrade Plan'
                        : currentPlan
                          ? 'Downgrade Plan'
                          : 'Subscribe'
                  const features  = planFeatures(plan).slice(0, 8)
                  const isHighlight = plan.is_recommended || plan.is_featured

                  return (
                    <article
                      key={plan.slug}
                      className={`relative flex min-h-[460px] flex-col rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md ${isHighlight ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
                    >
                      {isHighlight && (
                        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-md bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                          Most Popular
                        </span>
                      )}

                      {/* Plan header */}
                      <div className="mb-4 flex items-start gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${plan.name.toLowerCase().includes('enterprise') ? 'bg-amber-100 dark:bg-amber-950/40' : 'bg-primary/10'}`}>
                          {planIcon(plan)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-foreground">{plan.name}</h3>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{plan.description ?? 'Perfect for growing businesses.'}</p>
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="mb-4">
                        {isCustom ? (
                          <>
                            <p className="text-2xl font-bold text-foreground">Custom</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Contact us for pricing</p>
                          </>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-foreground">
                              {formatCurrency(price, currency)}
                              <span className="ml-1 text-xs font-medium text-muted-foreground">/{billingCycle === 'annual' ? 'yr' : 'mo'}</span>
                            </p>
                            {billingCycle === 'annual' ? (
                              <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                                ~{formatCurrency(monthlyEquivalent, currency)}/mo · saves {formatCurrency(num(plan.annual_savings), currency)}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {formatCurrency(num(plan.annual_price), currency)}/yr on annual plan
                              </p>
                            )}
                            {plan.trial_days && !isCurrent && (
                              <p className="mt-1 text-[11px] font-medium text-primary">
                                {plan.trial_days}-day free trial
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <div className="mb-4 h-px bg-border" />

                      {/* Features */}
                      <div className="flex-1 space-y-2">
                        {(features.length ? features : [
                          'Property & room management',
                          `${limitLabel(planLimit(plan, ['rooms', 'units']))} units`,
                          `${limitLabel(planLimit(plan, ['tenants']))} tenants`,
                        ]).map((feature) => (
                          <div key={feature} className="flex items-start gap-2 text-xs">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                            <span className="text-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <Button
                        variant={isHighlight ? 'primary' : 'outline'}
                        className="mt-5 w-full"
                        disabled={isCurrent || subscribing}
                        loading={subscribing && subscribeTarget?.slug === plan.slug}
                        onClick={() => choosePlan(plan)}
                      >
                        {action}
                      </Button>
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Why Upgrade?</h2>
              <div className="space-y-4">
                {WHY_UPGRADE.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{title}</p>
                      <p className="text-xs text-muted-foreground">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-xs font-semibold text-foreground">Payment methods</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">M-PESA</span>
                <span className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">VISA</span>
                <span className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-bold text-red-600 dark:bg-red-950/50 dark:text-red-400">Mastercard</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Instant M-Pesa STK push. No card data stored.</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold text-foreground">AI Plan Advisor</p>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Ask the AI assistant "Compare the plans for me" for a personalised recommendation.
              </p>
            </div>
          </aside>
        </div>

        {/* ── Usage section ── */}
        <section className="mb-6 mt-8">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Current Usage</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {USAGE_LIMITS.map(([key, label, keys]) => {
              const used = usage[key]
              const max  = planLimit(currentPlan, keys)
              const pct  = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : used > 0 ? 100 : 0
              const isWarning = pct >= 80
              return (
                <div key={key} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className={`text-xs font-semibold tabular-nums ${isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                      {used}/{limitLabel(max)}
                    </p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${isWarning ? 'bg-amber-500' : 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Invoices section ── */}
        <section>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Open Invoices" value={meta?.total ?? rows.length} icon={<CreditCard className="h-4 w-4 text-primary" />} iconBg="bg-primary/10" loading={isLoading} />
            <StatCard label="Total Due"     value={formatCurrency(pendingTotal, currency)} icon={<Clock className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-50 dark:bg-amber-950/40" loading={isLoading} />
            <StatCard label="Overdue"       value={overdueCount} icon={<AlertCircle className="h-4 w-4 text-destructive" />} iconBg="bg-red-50 dark:bg-red-950/40" loading={isLoading} />
          </div>

          <DataTable
            columns={columns}
            data={rows}
            keyField="uuid"
            loading={isLoading}
            error={isError ? 'Failed to load subscription invoices.' : null}
            empty={
              <EmptyState
                title="No pending invoices"
                description="Your organisation has no outstanding SaaS billing invoices."
              />
            }
            pagination={meta}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
            caption="Subscription invoices"
          />
        </section>
      </div>

      {/* ── Subscribe modal (plan confirmation + optional phone) ── */}
      <Modal
        open={!!subscribeTarget}
        onClose={closeSubscribeModal}
        title={subscribeTarget ? (isOnTrial ? `Switch to ${subscribeTarget.name}` : `Subscribe to ${subscribeTarget.name}`) : 'Subscribe'}
        description={
          subscribeTarget
            ? `${formatCurrency(billingCycle === 'annual' ? num(subscribeTarget.annual_price) : num(subscribeTarget.monthly_price), currency)} / ${billingCycle}`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closeSubscribeModal}>Cancel</Button>
            <Button loading={subscribing} onClick={subscribeForm.handleSubmit(submitSubscribe)}>
              {isOnTrial ? 'Switch Plan' : subscribeForm.watch('phone_number') ? 'Subscribe & Pay Now' : 'Subscribe'}
            </Button>
          </>
        }
      >
        <form onSubmit={subscribeForm.handleSubmit(submitSubscribe)} className="space-y-4">
          {isOnTrial ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Switching plans during your trial</span> — no payment needed.{' '}
                {trialDaysLeft} trial day{trialDaysLeft !== 1 ? 's' : ''} will carry over.
              </p>
            </div>
          ) : (
            <>
              {subscribeTarget?.trial_days && (
                <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-xs text-foreground">
                    <span className="font-semibold">{subscribeTarget.trial_days}-day free trial</span> — no payment required until the trial ends.
                  </p>
                </div>
              )}
              <FormField
                label="M-Pesa Number (optional)"
                htmlFor="sub-phone"
                hint="Enter to pay immediately via STK push. Leave blank to get an invoice instead."
                error={subscribeForm.formState.errors.phone_number?.message}
              >
                <Input
                  id="sub-phone"
                  type="tel"
                  placeholder="0712 345 678"
                  leftIcon={<Phone className="h-3.5 w-3.5" />}
                  {...subscribeForm.register('phone_number')}
                />
              </FormField>
            </>
          )}
        </form>
      </Modal>

      {/* ── Pay invoice modal ── */}
      <Modal
        open={!!payInvoice}
        onClose={closePayModal}
        title="Pay with M-Pesa"
        description={payInvoice ? `${payInvoice.invoice_number} · ${formatCurrency(payInvoice.total, currency)}` : undefined}
        size="sm"
        footer={
          paymentResult ? (
            <Button className="w-full" onClick={() => { closePayModal(); void refetch() }}>
              {isComplete ? 'Done' : 'Close'}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={closePayModal}>Cancel</Button>
              <Button loading={sending} onClick={payForm.handleSubmit(submitPayment)}>
                Send STK Push
              </Button>
            </>
          )
        }
      >
        {paymentResult ? (
          <div className="space-y-3 py-4 text-center">
            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${trackedStatus === 'failed' || trackedStatus === 'cancelled' ? 'bg-red-100 dark:bg-red-950/40' : 'bg-emerald-100 dark:bg-emerald-950/40'}`}>
              {trackedStatus === 'failed' || trackedStatus === 'cancelled'
                ? <AlertCircle className="h-6 w-6 text-destructive" />
                : <CheckCircle className="h-6 w-6 text-emerald-600" />
              }
            </div>
            <p className="text-sm font-semibold text-foreground">
              {isComplete
                ? trackedStatus === 'completed' ? 'Payment successful!' : `Payment ${trackedStatus}`
                : 'Check your phone'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isComplete
                ? `${paymentResult.invoice_number} is ${trackedStatus}.`
                : 'Enter your M-Pesa PIN to complete the payment.'}
            </p>
            <p className="break-all rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
              {paymentResult.payment_reference}
            </p>
            {!isComplete && (
              <p className="text-[11px] text-muted-foreground">Auto-checking every 4 seconds…</p>
            )}
          </div>
        ) : (
          <form onSubmit={payForm.handleSubmit(submitPayment)} className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">Amount due</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {payInvoice ? formatCurrency(payInvoice.total, currency) : '—'}
              </p>
            </div>
            <FormField
              label="M-Pesa Phone Number"
              htmlFor="billing-phone"
              error={payForm.formState.errors.phone_number?.message}
              required
            >
              <Input
                id="billing-phone"
                type="tel"
                placeholder="0712 345 678"
                leftIcon={<Phone className="h-3.5 w-3.5" />}
                error={!!payForm.formState.errors.phone_number}
                {...payForm.register('phone_number')}
              />
            </FormField>
          </form>
        )}
      </Modal>
    </>
  )
}
