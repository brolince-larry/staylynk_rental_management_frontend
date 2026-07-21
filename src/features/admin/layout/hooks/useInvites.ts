import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inviteAdminApi, type InviteExport } from '@/api/invites'
import { QK } from '@/constants/queryKeys'
import { useAuthStore } from '@/store/auth.store'

// The exports endpoint sometimes comes back paginated (`{ data: [...] }`)
// instead of a bare array — normalise either shape defensively.
function exportRows(value: unknown): InviteExport[] {
  if (Array.isArray(value)) return value
  const data = (value as { data?: unknown } | undefined)?.data
  return Array.isArray(data) ? (data as InviteExport[]) : []
}

function useOrgId() {
  return useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
}

export function useAdminInvites(params?: { property_id?: string | number; status?: string; page?: number; per_page?: number }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.adminInvites(orgId, params),
    queryFn: () => inviteAdminApi.list(params).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

export function useAdminInviteAnalytics(params?: { property_id?: string | number }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.adminInviteAnalytics(orgId, params),
    queryFn: () => inviteAdminApi.analytics(params).then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useAdminInviteExports() {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.adminInviteExports(orgId),
    queryFn: () => inviteAdminApi.listExports().then((r) => exportRows(r.data)),
  })
}

export function useBulkGenerateInvites() {
  const qc = useQueryClient()
  const orgId = useOrgId()
  return useMutation({
    mutationFn: inviteAdminApi.bulkGenerate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'invites', orgId] })
    },
  })
}

export function useRevokeInvite() {
  const qc = useQueryClient()
  const orgId = useOrgId()
  return useMutation({
    mutationFn: (uuid: string) => inviteAdminApi.revoke(uuid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'invites', orgId] })
    },
  })
}

export function useRevokeAllInvites() {
  const qc = useQueryClient()
  const orgId = useOrgId()
  return useMutation({
    mutationFn: (property_id: string | number) => inviteAdminApi.revokeAll(property_id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'invites', orgId] })
    },
  })
}

export function useUpdateInviteBranding() {
  return useMutation({
    mutationFn: ({ propertyId, data }: { propertyId: number; data: Parameters<typeof inviteAdminApi.updateBranding>[1] }) =>
      inviteAdminApi.updateBranding(propertyId, data),
  })
}
