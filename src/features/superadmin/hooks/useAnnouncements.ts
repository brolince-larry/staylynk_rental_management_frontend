import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/api/client'

const BASE = '/superadmin/announcements'
const QK   = ['superadmin', 'announcements']

export interface SAnnouncement {
  id:           number
  title:        string
  content:      string
  audience:     string
  org_id:       number | null
  is_pinned:    boolean
  published_at: string | null
  expires_at:   string | null
  created_by:   { id: number; name: string } | null
  created_at:   string
}

export function useSAnnouncements(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...QK, params],
    queryFn: () => apiGet<{ data: SAnnouncement[]; meta: Record<string, unknown> }>(BASE, params).then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useCreateSAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<SAnnouncement>(BASE, data).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK }),
  })
}

export function useUpdateSAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiPatch<SAnnouncement>(`${BASE}/${id}`, data).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK }),
  })
}

export function useDeleteSAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete(`${BASE}/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK }),
  })
}

export function usePublishSAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiPatch(`${BASE}/${id}/publish`, {}).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK }),
  })
}

export function useUnpublishSAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiPatch(`${BASE}/${id}/unpublish`, {}).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK }),
  })
}
