import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentCredentialsApi, type PaymentCredentialFilters, type PaymentCredentialPayload } from '@/api/paymentCredentials'
import { QK } from '@/constants/queryKeys'

function isPendingApprovalResponse(response: Awaited<ReturnType<typeof paymentCredentialsApi.create>>): boolean {
  return (response.data as unknown as Record<string, unknown> | null)?.status === 'pending_approval'
}

export function usePaymentCredentials(filters: PaymentCredentialFilters = {}) {
  return useQuery({
    queryKey: QK.saPaymentCredentials(filters),
    queryFn: () => paymentCredentialsApi.list(filters).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

export function useCreatePaymentCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PaymentCredentialPayload) => paymentCredentialsApi.create(data),
    onSuccess: (response) => {
      if (isPendingApprovalResponse(response)) return
      void qc.invalidateQueries({ queryKey: ['superadmin', 'payment-credentials'] })
    },
  })
}

export function useUpdatePaymentCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PaymentCredentialPayload> }) =>
      paymentCredentialsApi.update(id, data),
    onSuccess: (response) => {
      if (isPendingApprovalResponse(response)) return
      void qc.invalidateQueries({ queryKey: ['superadmin', 'payment-credentials'] })
    },
  })
}

export function useDisablePaymentCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => paymentCredentialsApi.disable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin', 'payment-credentials'] }),
  })
}
