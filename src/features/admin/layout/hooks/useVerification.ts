import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationApi } from '@/api/verification'
import { QK } from '@/constants/queryKeys'
import { useAuthStore } from '@/store/auth.store'

function useOrgId() {
  return useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
}

export function useLandlordVerificationStatus() {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.adminVerificationStatus(orgId),
    queryFn: () => verificationApi.status().then((r) => r.data),
  })
}

export function useSubmitLandlordVerification() {
  const qc = useQueryClient()
  const orgId = useOrgId()
  return useMutation({
    mutationFn: verificationApi.submit,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.adminVerificationStatus(orgId) }),
  })
}
