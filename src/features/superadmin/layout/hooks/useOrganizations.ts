// src/features/superadmin/hooks/useOrganizations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/api/client'
import { QK } from '@/constants/queryKeys'
import type { PaginatedResponse } from '@/types'

export interface OrgFilters {
  status?:    string
  plan?:      string
  search?:    string
  sort?:      string
  direction?: 'asc' | 'desc'
  page?:      number
  per_page?:  number
}

export function useOrganizations(filters: OrgFilters = {}) {
  return useQuery({
    queryKey: QK.saOrganizations(filters),
    queryFn:  () =>
      apiGet<PaginatedResponse<Record<string, unknown>>>(
        '/superadmin/organizations',
        filters as Record<string, unknown>
      ).then(r => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: QK.saOrganization(id),
    queryFn:  () =>
      apiGet<Record<string, unknown>>(`/superadmin/organizations/${id}`)
        .then(r => r.data),
    enabled: !!id,
  })
}

export function useOrganizationStats(id: string) {
  return useQuery({
    queryKey: QK.saOrgStats(id),
    queryFn:  () =>
      apiGet<Record<string, unknown>>(`/superadmin/organizations/${id}/stats`)
        .then(r => r.data),
    enabled:   !!id,
    staleTime: Infinity,
  })
}

export function useSuspendOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPatch<Record<string, unknown>>(
        `/superadmin/organizations/${id}/suspend`,
        { reason }
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['superadmin', 'organizations'] }),
  })
}

export function useActivateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiPatch<Record<string, unknown>>(
        `/superadmin/organizations/${id}/activate`
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['superadmin', 'organizations'] }),
  })
}

export function useDeleteOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/superadmin/organizations/${id}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['superadmin', 'organizations'] }),
  })
}