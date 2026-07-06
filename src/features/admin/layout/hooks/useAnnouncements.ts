import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/api/client'
import { useAuthStore } from '@/store/auth.store'

export interface Announcement {
  id:           number
  uuid:         string
  title:        string
  content:      string
  audience:     'all' | 'tenants' | 'managers' | 'admins' | string
  category:     string | null
  is_pinned:    boolean
  is_published: boolean
  is_expired:   boolean
  published_at: string | null
  expires_at:   string | null
  property:     { id: number; name: string } | null
  created_by:   { id: number; name: string } | null
  created_at:   string
}

export interface AnnouncementCursorMeta {
  per_page:    number
  next_cursor: string | null
  prev_cursor: string | null
  has_more:    boolean
}

interface AnnouncementListData {
  data: Announcement[]
  meta: AnnouncementCursorMeta
}

type Role = 'admin' | 'manager'

const base = (role: Role) => `/${role}/announcements`

export function useAnnouncements(role: Role, params?: Record<string, unknown>) {
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
  return useQuery({
    queryKey: [role, 'announcements', orgId, params],
    queryFn: () => apiGet<AnnouncementListData>(base(role), params).then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useCreateAnnouncement(role: Role) {
  const qc    = useQueryClient()
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost<Announcement>(base(role), data).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [role, 'announcements', orgId] }),
  })
}

export function useUpdateAnnouncement(role: Role) {
  const qc    = useQueryClient()
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiPatch<Announcement>(`${base(role)}/${id}`, data).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [role, 'announcements', orgId] }),
  })
}

export function useDeleteAnnouncement(role: Role) {
  const qc    = useQueryClient()
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
  return useMutation({
    mutationFn: (id: number) => apiDelete(`${base(role)}/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [role, 'announcements', orgId] }),
  })
}

export function usePublishAnnouncement(role: Role) {
  const qc    = useQueryClient()
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
  return useMutation({
    mutationFn: (id: number) => apiPatch(`${base(role)}/${id}/publish`, {}).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [role, 'announcements', orgId] }),
  })
}

export function useUnpublishAnnouncement(role: Role) {
  const qc    = useQueryClient()
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
  return useMutation({
    mutationFn: (id: number) => apiPatch(`${base(role)}/${id}/unpublish`, {}).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [role, 'announcements', orgId] }),
  })
}

// ── Tenant ──────────────────────────────────────────────────────────────────

export function useTenantAnnouncements(params?: Record<string, unknown>) {
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
  return useQuery({
    queryKey: ['tenant', 'announcements', orgId, params],
    queryFn: () => apiGet<AnnouncementListData>('/tenant/announcements', params).then((r) => r.data),
    staleTime: 60_000,
  })
}
