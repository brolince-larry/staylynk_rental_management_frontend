// src/features/superadmin/hooks/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/api/client'
import { QK } from '@/constants/queryKeys'
import type { PaginatedResponse } from '@/types'

export interface SAUserFilters {
  role?:      string
  status?:    string
  org_id?:    number
  search?:    string
  page?:      number
  per_page?:  number
}

export interface SACreateAdminPayload {
  org_id: string
  name: string
  email: string
  password: string
  role: 'admin'
  status: 'active' | 'suspended'
}

export function useSAUsers(filters: SAUserFilters = {}) {
  return useQuery({
    queryKey: QK.saUsers(filters),
    queryFn:  () =>
      apiGet<PaginatedResponse<Record<string, unknown>>>(
        '/superadmin/users',
        filters as Record<string, unknown>
      ).then(r => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useSAUserStats() {
  return useQuery({
    queryKey: QK.saUserStats(),
    queryFn:  () =>
      apiGet<Record<string, unknown>>('/superadmin/users/stats')
        .then(r => r.data),
    staleTime: Infinity,
  })
}

export function useCreateSAAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SACreateAdminPayload) =>
      apiPost<Record<string, unknown>>('/superadmin/users', data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['superadmin', 'users'] }),
  })
}

export function useChangeSAUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiPatch<Record<string, unknown>>(
        `/superadmin/users/${id}/change-role`,
        { role }
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['superadmin', 'users'] }),
  })
}

export function useRevokeSAUserSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/superadmin/users/${id}/sessions`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['superadmin', 'users'] }),
  })
}

export function useDeleteSAUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/superadmin/users/${id}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['superadmin', 'users'] }),
  })
}

export function useSAUpdateUser(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string; status?: string }) =>
      apiPatch<Record<string, unknown>>(
        `/superadmin/users/${id}`,
        data
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['superadmin', 'users'] }),
  })
}

export function useSAAuditLogs(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: QK.saAuditLogs(filters),
    queryFn:  () =>
      apiGet<Record<string, unknown>>(
        '/superadmin/audit-logs',
        filters
      ).then(r => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useSAAuditSummary() {
  return useQuery({
    queryKey: QK.saAuditSummary(),
    queryFn:  () =>
      apiGet<Record<string, unknown>>('/superadmin/audit-logs/summary')
        .then(r => r.data),
    staleTime: Infinity,
  })
}
