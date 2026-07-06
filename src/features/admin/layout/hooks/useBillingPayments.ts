import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingPaymentsApi } from '@/api/billingPayments'
import { subscriptionsApi, type BillingCycle } from '@/api/subscriptions'
import { QK } from '@/constants/queryKeys'
import { useAuthStore } from '@/store/auth.store'

function useOrgId() {
  return useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
}

export function useAdminBillingInvoices(params?: { page?: number; per_page?: number }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.adminBillingInvoices(orgId, params),
    queryFn: () => billingPaymentsApi.pendingInvoices(params).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

export function useAdminSubscriptionPlans() {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.adminSubscriptionPlans(orgId),
    queryFn: () => subscriptionsApi.plans().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminCurrentSubscription() {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.adminSubscriptionCurrent(orgId),
    queryFn: () => subscriptionsApi.current().then((r) => r.data),
  })
}

export function useSubscribeToPlan() {
  const qc = useQueryClient()
  const orgId = useOrgId()
  return useMutation({
    mutationFn: ({
      planSlug,
      billingCycle,
      phoneNumber,
    }: {
      planSlug: string
      billingCycle: BillingCycle
      phoneNumber?: string
    }) =>
      subscriptionsApi.subscribe({
        plan_slug: planSlug,
        billing_cycle: billingCycle,
        phone_number: phoneNumber || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.adminSubscriptionCurrent(orgId) })
      void qc.invalidateQueries({ queryKey: QK.adminBillingInvoices(orgId) })
      void qc.invalidateQueries({ queryKey: QK.adminDashboard(orgId) })
    },
  })
}

export function useInitiateBillingMpesa() {
  const qc = useQueryClient()
  const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ invoiceUuid, phone_number }: { invoiceUuid: string; phone_number: string }) =>
      billingPaymentsApi.initiateMpesa({
        invoice_uuid: invoiceUuid,
        method: 'mpesa',
        phone_number,
        idempotency_key: `${invoiceUuid}-${Date.now()}`,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.adminBillingInvoices(orgId) })
      void qc.invalidateQueries({ queryKey: QK.adminDashboard(orgId) })
    },
  })
}

export function useBillingPaymentStatus(paymentReference?: string) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.adminBillingPayment(orgId, paymentReference ?? 'none'),
    queryFn: () => billingPaymentsApi.status(paymentReference as string).then((r) => r.data),
    enabled: Boolean(paymentReference),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && ['completed', 'failed', 'cancelled'].includes(status) ? false : 4_000
    },
  })
}
