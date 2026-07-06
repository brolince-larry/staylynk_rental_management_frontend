// src/features/superadmin/hooks/useBilling.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch } from '@/api/client'
import { QK } from '@/constants/queryKeys'
import type { PaginatedResponse } from '@/types'

export interface BillingFilters {
  org_id?:    number
  status?:    string
  from?:      string
  to?:        string
  page?:      number
  per_page?:  number
}

export function useBillingInvoices(filters: BillingFilters = {}) {
  return useQuery({
    queryKey: QK.saBilling(filters),
    queryFn:  () =>
      apiGet<PaginatedResponse<Record<string, unknown>>>(
        '/superadmin/billing',
        filters as Record<string, unknown>
      ).then(r => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useBillingOverview() {
  return useQuery({
    queryKey: QK.saBillingOverview(),
    queryFn:  () =>
      apiGet<Record<string, unknown>>('/superadmin/billing/overview')
        .then(r => r.data),
    staleTime: Infinity,
  })
}

export function useMarkBillingPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, paid_at }: { id: number; paid_at?: string }) =>
      apiPatch<Record<string, unknown>>(
        `/superadmin/billing/${id}/mark-paid`,
        { paid_at }
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['superadmin', 'billing'] }),
  })
}

export function useVoidBillingInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiPatch<Record<string, unknown>>(
        `/superadmin/billing/${id}/void`,
        { reason }
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['superadmin', 'billing'] }),
  })
}

export function useGenerateMonthlyBilling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billing_month: string) =>
      apiPost<{ generated: number }>(
        '/superadmin/billing/generate-monthly',
        { billing_month }
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['superadmin', 'billing'] }),
  })
}

export function useRevenueSharing(month?: string) {
  return useQuery({
    queryKey: QK.saRevenueSharing(month),
    queryFn:  () =>
      apiGet<Record<string, unknown>>(
        '/superadmin/revenue-sharing',
        month ? { month } : undefined
      ).then(r => r.data),
    staleTime: Infinity,
  })
}