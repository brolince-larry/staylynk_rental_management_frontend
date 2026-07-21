import { apiGet, apiPost, apiPatch, apiDelete } from './client'

// ── Public interfaces ────────────────────────────────────────────────────────

export interface InviteRoom {
  id: number
  number: string
  floor?: string | null
  block?: string | null
  type?: string | null
  rent: number
  amenities?: string[]
}

export interface InviteProperty {
  id: number
  name: string
  address?: string | null
  city?: string | null
}

export interface InviteBranding {
  primary_color?: string | null
  secondary_color?: string | null
  logo_url?: string | null
  tagline?: string | null
  property_name?: string | null
}

export interface InviteTokenData {
  invite: {
    token: string
    expires_at: string
    status: string
  }
  room: InviteRoom
  property: InviteProperty
  branding: InviteBranding
}

export interface RegisterPayload {
  name: string
  email: string
  phone: string
  password: string
  password_confirmation: string
  emergency_name?: string
  emergency_phone?: string
  terms_accepted: boolean
}

export interface RegisterResult {
  token: string
  token_type: string
  user: {
    id: number
    name: string
    email: string
    role: string
    dashboard: string
    room?: InviteRoom
    property?: InviteProperty
  }
}

// ── Admin interfaces ─────────────────────────────────────────────────────────

export interface InviteItem {
  id: string
  registration_url: string
  status: 'pending' | 'used' | 'expired' | 'revoked' | string
  expiry_days: number
  expires_at: string
  is_valid: boolean
  click_count: number
  first_clicked_at?: string | null
  used_at?: string | null
  created_at: string
  room?: {
    id: string
    room_number: string
    floor?: string | null
    block?: string | null
    monthly_rent?: string | null
    status?: string | null
    room_type?: string | null
  } | null
  invited_by?: {
    id: string
    name: string
  } | null
  used_by?: {
    id: string
    name: string
    lease_uuid?: string | null
  } | null
}

export interface InviteListResponse {
  invites: InviteItem[]
  meta: {
    total: number
    current_page: number
    last_page: number
  }
}

export interface InviteAnalytics {
  total: number
  pending: number
  used: number
  expired: number
  revoked: number
  total_clicks: number
  conversion_rate: number
  click_to_register: number
}

export interface InviteExport {
  uuid: string
  property_id: number
  property_name?: string | null
  invite_count: number
  pdf_url: string
  expires_at: string
  created_at: string
}

export interface BulkGenerateResult {
  invite_count: number
  pdf_url: string
  whatsapp_group_link?: string | null
  expires_at: string
  pdf_export_id?: string
  invites: Array<{
    uuid: string
    token: string
    registration_url: string
    room: { id: number; number: string }
  }>
}

// ── Public API ───────────────────────────────────────────────────────────────

export const invitePublicApi = {
  get: (token: string) =>
    apiGet<InviteTokenData>(`/invite/${token}`),

  register: (token: string, data: RegisterPayload) =>
    apiPost<RegisterResult>(`/invite/${token}/register`, data),
}

// ── Admin API ────────────────────────────────────────────────────────────────

export const inviteAdminApi = {
  bulkGenerate: (data: { property_id: string | number; expiry_days: 7 | 14 | 30 | 60 }) =>
    apiPost<BulkGenerateResult>('/admin/rooms/invites/bulk', data),

  list: (params?: { property_id?: string | number; status?: string; page?: number; per_page?: number }) =>
    apiGet<InviteListResponse>('/admin/rooms/invites', params as Record<string, unknown>),

  analytics: (params?: { property_id?: string | number }) =>
    apiGet<InviteAnalytics>('/admin/rooms/invites/analytics', params as Record<string, unknown>),

  revoke: (uuid: string) =>
    apiDelete(`/admin/invites/${uuid}`),

  revokeAll: (property_id: string | number) =>
    apiPost('/admin/invites/revoke-all', { property_id }),

  listExports: () =>
    apiGet<InviteExport[]>('/admin/invites/exports'),

  downloadExport: async (uuid: string): Promise<void> => {
    const res = await apiGet<{ url: string; expires_in: number }>(`/admin/invites/exports/${uuid}/download`)
    if (res.data?.url) {
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    }
  },

  whatsappGroup: (export_uuid: string) =>
    apiPost<{ link: string }>('/admin/invites/whatsapp/group', { export_uuid }),

  whatsappContacts: (data: { export_uuid: string; phones: string[] }) =>
    apiPost<{ links: Record<string, string> }>('/admin/invites/whatsapp/contacts', data),

  updateBranding: (propertyId: string, data: InviteBranding & { property_name?: string }) =>
    apiPatch(`/admin/properties/${propertyId}/invite-branding`, data),
}

// ── Manager API ──────────────────────────────────────────────────────────────

export const inviteManagerApi = {
  bulkGenerate: (data: { property_id: string | number; expiry_days: 7 | 14 | 30 | 60 }) =>
    apiPost<BulkGenerateResult>('/manager/rooms/invites/bulk', data),

  list: (params?: { property_id?: string | number; status?: string; page?: number; per_page?: number }) =>
    apiGet<InviteListResponse>('/manager/rooms/invites', params as Record<string, unknown>),

  analytics: (params?: { property_id?: string | number }) =>
    apiGet<InviteAnalytics>('/manager/rooms/invites/analytics', params as Record<string, unknown>),

  revoke: (uuid: string) =>
    apiDelete(`/manager/invites/${uuid}`),

  revokeAll: (property_id: string | number) =>
    apiPost('/manager/invites/revoke-all', { property_id }),

  listExports: () =>
    apiGet<InviteExport[]>('/manager/invites/exports'),

  downloadExport: async (uuid: string): Promise<void> => {
    const res = await apiGet<{ url: string; expires_in: number }>(`/manager/invites/exports/${uuid}/download`)
    if (res.data?.url) {
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    }
  },

  whatsappGroup: (export_uuid: string) =>
    apiPost<{ link: string }>('/manager/invites/whatsapp/group', { export_uuid }),

  whatsappContacts: (data: { export_uuid: string; phones: string[] }) =>
    apiPost<{ links: Record<string, string> }>('/manager/invites/whatsapp/contacts', data),
}
