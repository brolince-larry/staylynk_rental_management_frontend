import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationApi } from '@/api/verification'
import { QK } from '@/constants/queryKeys'

export function useVerifications(params?: { status?: string; page?: number; per_page?: number }) {
  return useQuery({
    queryKey: QK.saVerifications(params),
    queryFn: () => verificationApi.list(params).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

export function useViewVerificationDocument() {
  return useMutation({
    mutationFn: ({ id, index, reason }: { id: number; index: number; reason: string }) =>
      verificationApi.viewDocument(id, index, reason),
  })
}

export function useApproveVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: verificationApi.approve,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin', 'verifications'] }),
  })
}

export function useRejectVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      verificationApi.reject(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin', 'verifications'] }),
  })
}
