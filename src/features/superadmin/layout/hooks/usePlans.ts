// src/features/superadmin/hooks/usePlans.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/api/client'
import { QK } from '@/constants/queryKeys'

export type PlanStatusFilter = 'all' | 'active' | 'inactive' | 'archived'

export interface PlanPayload {
  name:           string
  description?:   string
  monthly_price:  number
  annual_price?:  number
  trial_days?:    number
  grace_period_days?: number
  max_properties: number
  max_rooms:      number
  max_tenants:    number
  max_users:      number
  max_units?:     number
  max_admins?:    number
  max_workers?:   number
  max_storage_mb?: number
  max_images?:    number
  max_api_requests_per_day?: number
  limits?:        Record<string, number>
  features?:      string[]
  feature_flags?: Record<string, boolean>
  enable_public_listing?: boolean
  enable_ai_matching?: boolean
  enable_map_listing?: boolean
  enable_websocket?: boolean
  enable_sms?: boolean
  enable_whatsapp?: boolean
  enable_analytics?: boolean
  enable_payroll?: boolean
  enable_multi_admin?: boolean
  enable_worker_module?: boolean
  enable_reports?: boolean
  is_recommended?: boolean
  is_featured?:   boolean
  is_active?:     boolean
  sort_order?:    number
}

export interface PlanListPayload {
  data: Record<string, unknown>[]
  summary: {
    total_plans: number
    active_plans: number
    inactive_plans: number
    archived_plans: number
    current_subscribers: number
    monthly_revenue: number
  }
  filters: {
    status: PlanStatusFilter | string
  }
}

export interface PlanSubscriberFilters {
  status?: string
  billing_cycle?: 'monthly' | 'annual' | string
  search?: string
  plan_id?: number
  page?: number
  per_page?: number
}

export interface PlanSubscribersPayload {
  data: Record<string, unknown>[]
  meta?: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

function invalidatePlanCaches(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: QK.saPlans() })
  void qc.invalidateQueries({ queryKey: QK.saPlanUsage() })
  void qc.invalidateQueries({ queryKey: ['superadmin-plans'] })
  void qc.invalidateQueries({ queryKey: ['admin-subscription-plans'] })
  void qc.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'admin' && query.queryKey[1] === 'subscription',
  })
}

export function usePlans(status: PlanStatusFilter = 'all') {
  return useQuery({
    queryKey: ['superadmin-plans', status],
    queryFn:  () =>
      apiGet<PlanListPayload>('/superadmin/plans', { status, with_stats: 1 })
        .then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
}

export function usePlanSubscribers(filters: PlanSubscriberFilters = {}, scopedPlanId?: number | null, enabled = true) {
  return useQuery({
    queryKey: ['superadmin-plan-subscribers', scopedPlanId ?? 'all', filters],
    queryFn: () => {
      const params = { ...filters, ...(scopedPlanId ? {} : filters.plan_id ? { plan_id: filters.plan_id } : {}) }
      const endpoint = scopedPlanId
        ? `/superadmin/plans/${scopedPlanId}/subscribers`
        : '/superadmin/plans/subscribers'
      return apiGet<PlanSubscribersPayload>(endpoint, params).then(r => r.data)
    },
    enabled,
    placeholderData: (prev) => prev,
  })
}

export function usePlanUsage() {
  return useQuery({
    queryKey: QK.saPlanUsage(),
    queryFn:  () =>
      apiGet<Record<string, unknown>>('/superadmin/plans/usage')
        .then(r => r.data),
    staleTime: Infinity,
  })
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PlanPayload) =>
      apiPost<Record<string, unknown>>('/superadmin/plans', data),
    onSuccess: () => {
      invalidatePlanCaches(qc)
    },
  })
}

export function useUpdatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PlanPayload> }) =>
      apiPatch<Record<string, unknown>>(`/superadmin/plans/${id}`, data),
    onSuccess: () => {
      invalidatePlanCaches(qc)
    },
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiDelete(`/superadmin/plans/${id}`),
    onSuccess: () => {
      invalidatePlanCaches(qc)
    },
  })
}

export function useArchivePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiPatch<Record<string, unknown>>(`/superadmin/plans/${id}/archive`),
    onSuccess: () => {
      invalidatePlanCaches(qc)
    },
  })
}

export function useDeactivatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiPatch<Record<string, unknown>>(`/superadmin/plans/${id}/deactivate`),
    onSuccess: () => {
      invalidatePlanCaches(qc)
    },
  })
}

export function useActivatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiPatch<Record<string, unknown>>(`/superadmin/plans/${id}/activate`),
    onSuccess: () => {
      invalidatePlanCaches(qc)
    },
  })
}

export function useAssignPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orgId, planId, billingCycle, startsAt }: { orgId: number; planId: number; billingCycle: 'monthly' | 'annual'; startsAt?: string }) =>
      apiPost<Record<string, unknown>>(
        `/superadmin/plans/${planId}/assign`,
        { org_id: orgId, billing_cycle: billingCycle, ...(startsAt ? { starts_at: startsAt } : {}) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'organizations'] })
      qc.invalidateQueries({ queryKey: QK.saPlans() })
    },
  })
}
