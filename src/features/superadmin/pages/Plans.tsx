import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Archive, Check, Crown, Package, Plus, Search, Sparkles, Users } from 'lucide-react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useActivatePlan,
  useArchivePlan,
  useCreatePlan,
  useDeactivatePlan,
  usePlans,
  usePlanSubscribers,
  useUpdatePlan,
  type PlanStatusFilter,
  type PlanPayload,
} from '../hooks/usePlans'
import { usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { Modal, Button, FormField, Input, Select, Textarea, ToastContainer } from '@/components/forms'
import { EmptyState, PageHeader, StatCard, StatusBadge } from '@/components/ui'
import { formatCurrency, formatDate } from '@/utils/format'

type Plan = Record<string, unknown>

const planSchema = z.object({
  name: z.string().min(2, 'Plan name is required').max(120),
  monthly_price: z.coerce.number().min(0),
  annual_price: z.coerce.number().min(0),
  trial_days: z.coerce.number().int().min(0),
  grace_period_days: z.coerce.number().int().min(0),
  max_properties: z.coerce.number().int().min(-1),
  max_rooms: z.coerce.number().int().min(-1),
  max_tenants: z.coerce.number().int().min(-1),
  max_users: z.coerce.number().int().min(-1),
  max_units: z.coerce.number().int().min(-1),
  max_admins: z.coerce.number().int().min(-1),
  max_workers: z.coerce.number().int().min(-1),
  max_storage_mb: z.coerce.number().int().min(-1),
  max_images: z.coerce.number().int().min(-1),
  max_api_requests_per_day: z.coerce.number().int().min(-1),
  sort_order: z.coerce.number().int().min(0),
  description: z.string().max(500).optional(),
  features_text: z.string().optional(),
  enable_public_listing: z.boolean(),
  enable_ai_matching: z.boolean(),
  enable_map_listing: z.boolean(),
  enable_websocket: z.boolean(),
  enable_sms: z.boolean(),
  enable_whatsapp: z.boolean(),
  enable_analytics: z.boolean(),
  enable_payroll: z.boolean(),
  enable_multi_admin: z.boolean(),
  enable_worker_module: z.boolean(),
  enable_reports: z.boolean(),
  is_recommended: z.boolean(),
  is_featured: z.boolean(),
  is_active: z.boolean(),
})

type PlanForm = z.infer<typeof planSchema>

const DEFAULTS: PlanForm = {
  name: '',
  monthly_price: 0,
  annual_price: 0,
  trial_days: 0,
  grace_period_days: 0,
  max_properties: -1,
  max_rooms: -1,
  max_tenants: -1,
  max_users: -1,
  max_units: -1,
  max_admins: -1,
  max_workers: -1,
  max_storage_mb: -1,
  max_images: -1,
  max_api_requests_per_day: -1,
  sort_order: 0,
  description: '',
  features_text: '',
  enable_public_listing: false,
  enable_ai_matching: false,
  enable_map_listing: false,
  enable_websocket: false,
  enable_sms: false,
  enable_whatsapp: false,
  enable_analytics: false,
  enable_payroll: false,
  enable_multi_admin: false,
  enable_worker_module: false,
  enable_reports: false,
  is_recommended: false,
  is_featured: false,
  is_active: true,
}

const PLAN_ACCENTS = [
  'border-t-blue-500',
  'border-t-emerald-500',
  'border-t-violet-500',
  'border-t-amber-500',
  'border-t-rose-500',
]

const PLAN_STATUSES: Array<{ label: string; value: PlanStatusFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Archived', value: 'archived' },
]

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function limit(value: unknown): string {
  const n = num(value, -1)
  return n === -1 ? 'Unlimited' : n.toLocaleString()
}

function featuresFromPlan(plan: Plan): string[] {
  return Array.isArray(plan.features)
    ? plan.features.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function labelize(value: string): string {
  return value.replace(/^enable_/, '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function planLimit(plan: Plan, key: string, fallback = -1): number {
  const limits = (plan.limits ?? {}) as Record<string, unknown>
  return num(limits[key] ?? plan[key], fallback)
}

function planFlag(plan: Plan, key: string): boolean {
  const flags = (plan.feature_flags ?? {}) as Record<string, unknown>
  return Boolean(flags[key] ?? plan[`enable_${key}`] ?? plan[key])
}

function subscribers(plan: Plan): number {
  return num(plan.subscribers_count ?? plan.active_subscriptions_count ?? plan.active_subscribers, 0)
}

function text(value: unknown, fallback = '-'): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function payloadFromForm(values: PlanForm): PlanPayload {
  return {
    name: values.name,
    description: values.description?.trim() || undefined,
    monthly_price: values.monthly_price,
    annual_price: values.annual_price,
    trial_days: values.trial_days,
    grace_period_days: values.grace_period_days,
    max_properties: values.max_properties,
    max_rooms: values.max_rooms,
    max_tenants: values.max_tenants,
    max_users: values.max_users,
    max_units: values.max_units,
    max_admins: values.max_admins,
    max_workers: values.max_workers,
    max_storage_mb: values.max_storage_mb,
    max_images: values.max_images,
    max_api_requests_per_day: values.max_api_requests_per_day,
    limits: {
      max_properties: values.max_properties,
      max_units: values.max_units,
      max_rooms: values.max_rooms,
      max_tenants: values.max_tenants,
      max_users: values.max_users,
      max_admins: values.max_admins,
      max_workers: values.max_workers,
      max_storage_mb: values.max_storage_mb,
      max_images: values.max_images,
      max_api_requests_per_day: values.max_api_requests_per_day,
    },
    sort_order: values.sort_order,
    is_active: values.is_active,
    feature_flags: {
      public_listing: values.enable_public_listing,
      ai_matching: values.enable_ai_matching,
      map_listing: values.enable_map_listing,
      websocket: values.enable_websocket,
      sms: values.enable_sms,
      whatsapp: values.enable_whatsapp,
      analytics: values.enable_analytics,
      payroll: values.enable_payroll,
      multi_admin: values.enable_multi_admin,
      worker_module: values.enable_worker_module,
      reports: values.enable_reports,
    },
    enable_public_listing: values.enable_public_listing,
    enable_ai_matching: values.enable_ai_matching,
    enable_map_listing: values.enable_map_listing,
    enable_websocket: values.enable_websocket,
    enable_sms: values.enable_sms,
    enable_whatsapp: values.enable_whatsapp,
    enable_analytics: values.enable_analytics,
    enable_payroll: values.enable_payroll,
    enable_multi_admin: values.enable_multi_admin,
    enable_worker_module: values.enable_worker_module,
    enable_reports: values.enable_reports,
    is_recommended: values.is_recommended,
    is_featured: values.is_featured,
    features: (values.features_text ?? '')
      .split('\n')
      .map((feature) => feature.trim())
      .filter(Boolean),
  }
}

function formFromPlan(plan: Plan): PlanForm {
  const limits = (plan.limits ?? {}) as Record<string, unknown>
  return {
    name: String(plan.name ?? ''),
    monthly_price: num(plan.monthly_price ?? plan.price, 0),
    annual_price: num(plan.annual_price, 0),
    trial_days: num(plan.trial_days, 0),
    grace_period_days: num(plan.grace_period_days, 0),
    max_properties: num(limits.max_properties ?? plan.max_properties, -1),
    max_rooms: num(limits.max_rooms ?? plan.max_rooms, -1),
    max_tenants: num(limits.max_tenants ?? plan.max_tenants, -1),
    max_users: num(limits.max_users ?? plan.max_users, -1),
    max_units: num(limits.max_units ?? plan.max_units, -1),
    max_admins: num(limits.max_admins ?? plan.max_admins, -1),
    max_workers: num(limits.max_workers ?? plan.max_workers, -1),
    max_storage_mb: num(limits.max_storage_mb ?? plan.max_storage_mb, -1),
    max_images: num(limits.max_images ?? plan.max_images, -1),
    max_api_requests_per_day: num(limits.max_api_requests_per_day ?? plan.max_api_requests_per_day, -1),
    sort_order: num(plan.sort_order, 0),
    description: String(plan.description ?? ''),
    features_text: featuresFromPlan(plan).join('\n'),
    enable_public_listing: planFlag(plan, 'public_listing'),
    enable_ai_matching: planFlag(plan, 'ai_matching'),
    enable_map_listing: planFlag(plan, 'map_listing'),
    enable_websocket: planFlag(plan, 'websocket'),
    enable_sms: planFlag(plan, 'sms'),
    enable_whatsapp: planFlag(plan, 'whatsapp'),
    enable_analytics: planFlag(plan, 'analytics'),
    enable_payroll: planFlag(plan, 'payroll'),
    enable_multi_admin: planFlag(plan, 'multi_admin'),
    enable_worker_module: planFlag(plan, 'worker_module'),
    enable_reports: planFlag(plan, 'reports'),
    is_recommended: Boolean(plan.is_recommended),
    is_featured: Boolean(plan.is_featured),
    is_active: Boolean(plan.is_active),
  }
}

export default function Plans(): React.ReactElement {
  const [modalOpen, setModalOpen] = useState(false)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [status, setStatus] = useState<PlanStatusFilter>('all')
  const [subscribersPlan, setSubscribersPlan] = useState<Plan | null | undefined>(undefined)
  const [subscriberStatus, setSubscriberStatus] = useState('')
  const [subscriberCycle, setSubscriberCycle] = useState('')
  const [subscriberSearch, setSubscriberSearch] = useState('')
  const { page: subscriberPage, perPage: subscriberPerPage, setPage: setSubscriberPage, setPerPage: setSubscriberPerPage } = usePagination(1, 20)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data: plansData, isLoading } = usePlans(status)
  const { mutate: createPlan, isPending: creating } = useCreatePlan()
  const { mutate: updatePlan, isPending: updating } = useUpdatePlan()
  const { mutate: deactivatePlan, isPending: deactivating } = useDeactivatePlan()
  const { mutate: activatePlan, isPending: activating } = useActivatePlan()
  const { mutate: archivePlan, isPending: archiving } = useArchivePlan()
  const subscribersOpen = subscribersPlan !== undefined
  const scopedSubscriberPlanId = subscribersPlan ? num(subscribersPlan.id) : null
  const { data: subscribersData, isLoading: subscribersLoading, isError: subscribersError } = usePlanSubscribers({
    status: subscriberStatus || undefined,
    billing_cycle: subscriberCycle || undefined,
    search: subscriberSearch || undefined,
    page: subscriberPage,
    per_page: subscriberPerPage,
  }, scopedSubscriberPlanId, subscribersOpen)

  const plans = plansData?.data ?? []
  const summary = plansData?.summary
  const subscriberRows = subscribersData?.data ?? []
  const subscriberMeta = subscribersData?.meta

  const form = useForm<PlanForm>({
    resolver: zodResolver(planSchema) as Resolver<PlanForm>,
    defaultValues: DEFAULTS,
  })

  const openCreate = () => {
    setEditPlan(null)
    form.reset(DEFAULTS)
    setModalOpen(true)
  }

  const openEdit = (plan: Plan) => {
    setEditPlan(plan)
    form.reset(formFromPlan(plan))
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditPlan(null)
    form.reset(DEFAULTS)
  }

  const savePlan = (values: PlanForm) => {
    const payload = payloadFromForm(values)
    if (editPlan) {
      updatePlan({ id: editPlan.id as number, data: payload }, {
        onSuccess: () => { success('Plan updated'); closeModal() },
        onError: (err) => toastError(err, 'Failed to update plan'),
      })
      return
    }

    createPlan(payload, {
      onSuccess: () => { success('Plan created'); closeModal() },
      onError: (err) => toastError(err, 'Failed to create plan'),
    })
  }

  const openSubscribers = (plan?: Plan | null) => {
    setSubscribersPlan(plan ?? null)
    setSubscriberPage(1)
  }

  const subscriberColumns: ColumnDef<Record<string, unknown>>[] = [
    {
      key: 'organization', header: 'Organization',
      accessor: (row) => (
        <div>
          <p className="text-xs font-semibold text-foreground">{text(row.organization_name ?? (row.organization as Record<string, unknown> | undefined)?.name ?? row.org_name)}</p>
          <p className="text-xs text-muted-foreground">{text(row.email ?? row.organization_email)}</p>
        </div>
      ),
    },
    {
      key: 'phone', header: 'Phone',
      accessor: (row) => <span className="text-xs text-muted-foreground">{text(row.phone ?? row.organization_phone)}</span>,
    },
    {
      key: 'plan', header: 'Plan',
      accessor: (row) => <span className="text-xs font-medium text-foreground">{text(row.plan_name ?? (row.plan as Record<string, unknown> | undefined)?.name)}</span>,
    },
    {
      key: 'status', header: 'Status',
      accessor: (row) => <StatusBadge status={text(row.status, 'unknown')} />,
    },
    {
      key: 'billing_cycle', header: 'Cycle',
      accessor: (row) => <span className="text-xs capitalize text-muted-foreground">{text(row.billing_cycle)}</span>,
    },
    {
      key: 'amount', header: 'Amount', align: 'right',
      accessor: (row) => <span className="text-xs font-semibold text-foreground">{formatCurrency(num(row.amount))}</span>,
    },
    {
      key: 'starts_at', header: 'Start Date',
      accessor: (row) => <span className="text-xs text-muted-foreground">{row.starts_at ? formatDate(String(row.starts_at)) : '-'}</span>,
    },
    {
      key: 'ends_at', header: 'End Date',
      accessor: (row) => <span className="text-xs text-muted-foreground">{row.ends_at ? formatDate(String(row.ends_at)) : '-'}</span>,
    },
    {
      key: 'days_remaining', header: 'Days',
      accessor: (row) => <span className="text-xs font-medium text-foreground">{num(row.days_remaining, 0)}</span>,
    },
  ]

  return (
    <>
      <Helmet><title>Subscription Plans - StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Subscription Plans"
          subtitle="Configure SaaS packages, limits, pricing, and included features."
          actions={
            <>
              <Button variant="outline" onClick={() => openSubscribers(null)}>
                <Users className="h-3.5 w-3.5" /> Subscribers
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" /> New Plan
              </Button>
            </>
          }
        />

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Plans" value={summary?.total_plans ?? plans.length} icon={<Package className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-100" loading={isLoading} />
          <StatCard label="Active Plans" value={summary?.active_plans ?? 0} icon={<Package className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-100" loading={isLoading} />
          <StatCard label="Archived Plans" value={summary?.archived_plans ?? 0} icon={<Archive className="h-4 w-4 text-slate-600" />} iconBg="bg-slate-100" loading={isLoading} />
          <StatCard label="Total Subscribers" value={summary?.current_subscribers ?? 0} icon={<Users className="h-4 w-4 text-violet-600" />} iconBg="bg-violet-100" loading={isLoading} />
          <StatCard label="Monthly Revenue" value={formatCurrency(summary?.monthly_revenue ?? 0)} icon={<Crown className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-100" loading={isLoading} />
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {PLAN_STATUSES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setStatus(item.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${status === item.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-5">
                <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="mb-5 h-8 w-40 animate-pulse rounded bg-muted" />
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((j) => <div key={j} className="h-3 animate-pulse rounded bg-muted" />)}
                </div>
              </div>
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState title="No subscription plans" description="Create a plan to make it available for organisations." action={<Button onClick={openCreate}>Create Plan</Button>} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan, index) => {
              const features = featuresFromPlan(plan)
              const isActive = Boolean(plan.is_active)
              const isArchived = Boolean(plan.is_archived)
              const monthly = num(plan.monthly_price ?? plan.price, 0)
              const annual = num(plan.annual_price, 0)
              const accent = PLAN_ACCENTS[index % PLAN_ACCENTS.length]

              return (
                <div key={plan.id as number} className={`flex min-h-[420px] flex-col rounded-lg border border-border border-t-4 ${isArchived ? 'border-t-slate-400 opacity-80' : accent} bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <h2 className="truncate text-lg font-bold text-foreground">{plan.name as string}</h2>
                        {(Boolean(plan.is_recommended) || Boolean(plan.is_featured) || index === 0) && <Sparkles className="h-4 w-4 text-amber-500" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{plan.description as string || 'No description set.'}</p>
                    </div>
                    <StatusBadge status={isArchived ? 'archived' : isActive ? 'active' : 'inactive'} />
                  </div>

                  <div className="mb-5 rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-3xl font-bold tracking-tight text-foreground">
                      {formatCurrency(monthly)}
                      <span className="ml-1 text-xs font-medium text-muted-foreground">/ month</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {annual > 0 ? `${formatCurrency(annual)} annual billing` : 'Annual price not configured'}
                    </p>
                  </div>

                  <div className="mb-5 grid grid-cols-2 gap-2 text-xs">
                    {[
                      ['Properties', planLimit(plan, 'max_properties')],
                      ['Units', planLimit(plan, 'max_units')],
                      ['Rooms', planLimit(plan, 'max_rooms')],
                      ['Tenants', planLimit(plan, 'max_tenants')],
                      ['Admins', planLimit(plan, 'max_admins')],
                      ['Workers', planLimit(plan, 'max_workers')],
                      ['Storage MB', planLimit(plan, 'max_storage_mb')],
                      ['Images', planLimit(plan, 'max_images')],
                    ].map(([label, value]) => (
                      <div key={label as string} className="rounded-md border border-border px-3 py-2">
                        <p className="text-muted-foreground">{label as string}</p>
                        <p className="font-semibold text-foreground">{limit(value)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-5 flex items-center justify-between border-y border-border py-3 text-xs">
                    <span className="text-muted-foreground">Active orgs</span>
                    <span className="font-semibold text-foreground">{subscribers(plan)}</span>
                  </div>

                  <div className="min-h-[104px] flex-1 space-y-2">
                    {(features.length ? features : ['No features listed yet']).slice(0, 6).map((feature) => (
                      <div key={feature} className="flex items-start gap-2 text-xs">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <Check className="h-3 w-3" />
                        </span>
                        <span className={features.length ? 'text-foreground' : 'text-muted-foreground'}>{labelize(feature)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openEdit(plan)}
                      className="rounded-lg border border-border py-2 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      View / Edit
                    </button>
                    <button
                      onClick={() => openSubscribers(plan)}
                      className="rounded-lg border border-border py-2 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      Subscribers
                    </button>
                    {isArchived && (
                      <button
                        disabled={activating}
                        onClick={() => activatePlan(plan.id as number, {
                          onSuccess: () => success('Plan activated'),
                          onError: (err) => toastError(err, 'Failed to activate plan'),
                        })}
                        className="rounded-lg border border-emerald-200 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Activate
                      </button>
                    )}
                    {!isArchived && isActive && (
                      <button
                        disabled={deactivating}
                        onClick={() => deactivatePlan(plan.id as number, {
                          onSuccess: () => success('Plan deactivated'),
                          onError: (err) => toastError(err, 'Failed to deactivate plan'),
                        })}
                        className="rounded-lg border border-red-200 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    )}
                    {!isArchived && !isActive && (
                      <button
                        disabled={activating}
                        onClick={() => activatePlan(plan.id as number, {
                          onSuccess: () => success('Plan activated'),
                          onError: (err) => toastError(err, 'Failed to activate plan'),
                        })}
                        className="rounded-lg border border-emerald-200 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Activate
                      </button>
                    )}
                    {!isArchived && (
                      <button
                        disabled={archiving}
                        onClick={() => archivePlan(plan.id as number, {
                          onSuccess: () => success('Plan archived'),
                          onError: (err) => toastError(err, 'Failed to archive plan'),
                        })}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-200 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      >
                        <Archive className="h-3 w-3" /> Archive
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button loading={creating || updating} onClick={form.handleSubmit(savePlan)}>
              {editPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(savePlan)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Plan Name" htmlFor="pname" error={form.formState.errors.name?.message} required>
            <Input id="pname" placeholder="Professional" error={!!form.formState.errors.name} {...form.register('name')} />
          </FormField>
          <FormField label="Sort Order" htmlFor="psort">
            <Input id="psort" type="number" min={0} {...form.register('sort_order')} />
          </FormField>
          <FormField label="Monthly Price" htmlFor="pmonthly" error={form.formState.errors.monthly_price?.message} required>
            <Input id="pmonthly" type="number" min={0} step="0.01" error={!!form.formState.errors.monthly_price} {...form.register('monthly_price')} />
          </FormField>
          <FormField label="Annual Price" htmlFor="pannual" error={form.formState.errors.annual_price?.message}>
            <Input id="pannual" type="number" min={0} step="0.01" error={!!form.formState.errors.annual_price} {...form.register('annual_price')} />
          </FormField>
          <FormField label="Trial Days" htmlFor="ptrial" error={form.formState.errors.trial_days?.message}>
            <Input id="ptrial" type="number" min={0} error={!!form.formState.errors.trial_days} {...form.register('trial_days')} />
          </FormField>
          <FormField label="Grace Period Days" htmlFor="pgrace" error={form.formState.errors.grace_period_days?.message}>
            <Input id="pgrace" type="number" min={0} error={!!form.formState.errors.grace_period_days} {...form.register('grace_period_days')} />
          </FormField>
          <FormField label="Max Properties" htmlFor="pmaxp" hint="-1 means unlimited">
            <Input id="pmaxp" type="number" min={-1} {...form.register('max_properties')} />
          </FormField>
          <FormField label="Max Rooms" htmlFor="pmaxr" hint="-1 means unlimited">
            <Input id="pmaxr" type="number" min={-1} {...form.register('max_rooms')} />
          </FormField>
          <FormField label="Max Tenants" htmlFor="pmaxt" hint="-1 means unlimited">
            <Input id="pmaxt" type="number" min={-1} {...form.register('max_tenants')} />
          </FormField>
          <FormField label="Max Users" htmlFor="pmaxu" hint="-1 means unlimited">
            <Input id="pmaxu" type="number" min={-1} {...form.register('max_users')} />
          </FormField>
          <FormField label="Max Units" htmlFor="pmaxunits" hint="-1 means unlimited">
            <Input id="pmaxunits" type="number" min={-1} {...form.register('max_units')} />
          </FormField>
          <FormField label="Max Admins" htmlFor="pmaxadmins" hint="-1 means unlimited">
            <Input id="pmaxadmins" type="number" min={-1} {...form.register('max_admins')} />
          </FormField>
          <FormField label="Max Workers" htmlFor="pmaxworkers" hint="-1 means unlimited">
            <Input id="pmaxworkers" type="number" min={-1} {...form.register('max_workers')} />
          </FormField>
          <FormField label="Max Storage MB" htmlFor="pmaxstorage" hint="-1 means unlimited">
            <Input id="pmaxstorage" type="number" min={-1} {...form.register('max_storage_mb')} />
          </FormField>
          <FormField label="Max Images" htmlFor="pmaximages" hint="-1 means unlimited">
            <Input id="pmaximages" type="number" min={-1} {...form.register('max_images')} />
          </FormField>
          <FormField label="Daily API Requests" htmlFor="pmaxapi" hint="-1 means unlimited">
            <Input id="pmaxapi" type="number" min={-1} {...form.register('max_api_requests_per_day')} />
          </FormField>
          <FormField label="Description" htmlFor="pdesc" className="sm:col-span-2">
            <Input id="pdesc" placeholder="Best for growing property operators" {...form.register('description')} />
          </FormField>
          <FormField label="Features" htmlFor="pfeatures" hint="One feature per line" className="sm:col-span-2">
            <Textarea id="pfeatures" rows={6} placeholder={'Online rent collection\nTenant portal\nAdvanced reporting'} {...form.register('features_text')} />
          </FormField>
          <div className="grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-2">
            {[
              ['enable_public_listing', 'Public Listing'],
              ['enable_ai_matching', 'AI Matching'],
              ['enable_map_listing', 'Map Listing'],
              ['enable_websocket', 'Realtime Websocket'],
              ['enable_sms', 'SMS'],
              ['enable_whatsapp', 'WhatsApp'],
              ['enable_analytics', 'Analytics'],
              ['enable_payroll', 'Payroll'],
              ['enable_multi_admin', 'Multi Admin'],
              ['enable_worker_module', 'Worker Module'],
              ['enable_reports', 'Reports'],
              ['is_recommended', 'Recommended'],
              ['is_featured', 'Featured'],
              ['is_active', 'Active plan'],
            ].map(([name, label]) => (
              <label key={name} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-primary"
                  {...form.register(name as keyof PlanForm)}
                />
                {label}
              </label>
            ))}
          </div>
        </form>
      </Modal>

      <Modal
        open={subscribersOpen}
        onClose={() => setSubscribersPlan(undefined)}
        title={subscribersPlan ? `${text(subscribersPlan.name)} Subscribers` : 'Plan Subscribers'}
        size="xl"
      >
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            value={subscriberSearch}
            onChange={(event) => { setSubscriberSearch(event.target.value); setSubscriberPage(1) }}
            placeholder="Search organization"
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
          <Select
            value={subscriberStatus}
            onChange={(event) => { setSubscriberStatus(event.target.value); setSubscriberPage(1) }}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'trial', label: 'Trial' },
              { value: 'grace', label: 'Grace' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <Select
            value={subscriberCycle}
            onChange={(event) => { setSubscriberCycle(event.target.value); setSubscriberPage(1) }}
            options={[
              { value: '', label: 'All cycles' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'annual', label: 'Annual' },
            ]}
          />
          <Button variant="outline" onClick={() => { setSubscriberSearch(''); setSubscriberStatus(''); setSubscriberCycle(''); setSubscriberPage(1) }}>
            Clear
          </Button>
        </div>
        <DataTable
          columns={subscriberColumns}
          data={subscriberRows}
          keyField="id"
          loading={subscribersLoading}
          error={subscribersError ? 'Failed to load subscribers.' : null}
          emptyTitle="No subscribers"
          emptyDescription="No organisations match these subscriber filters."
          pagination={subscriberMeta}
          onPageChange={setSubscriberPage}
          onPerPageChange={setSubscriberPerPage}
          caption="Plan subscribers"
          compact
        />
      </Modal>
    </>
  )
}
