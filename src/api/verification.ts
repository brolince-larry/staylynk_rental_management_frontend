import { apiClient, apiGet, apiPatch } from './client'
import type { ApiResponse, PaginatedResponse } from '@/types'

export type VerificationStatusValue = 'none' | 'pending' | 'rejected' | 'trusted'
export type VerificationApiStatusValue = VerificationStatusValue | 'approved'

export interface VerificationStatus {
  phone_verified: boolean
  email_verified: boolean
  trusted_status: VerificationApiStatusValue
  submitted_types: string[]
  submitted_at?: string
  reviewed_at?: string
  rejection_reason?: string | null
  badge_earned: boolean
}

export interface VerificationSubmitPayload {
  document_type?: string
  document?: File
  organization_email?: string
  organization_phone?: string
  email?: string
  phone?: string
}

export interface VerificationReviewItem {
  id: number
  org_id: number
  landlord_name: string
  landlord_email: string
  status: VerificationApiStatusValue
  document_count: number
  document_types: string[]
  documents?: Array<{ name?: string | null; type?: string | null; index?: number | null }>
  submitted_at?: string | null
}

export interface DocumentAccess {
  url: string
  type: string
  expires_in: string
  audit_note: string
}

export const verificationApi = {
  status: () =>
    apiGet<VerificationStatus>('/admin/verification/status'),

  submit: async (data: VerificationSubmitPayload) => {
    const hasDocument = Boolean(data.document && data.document_type)
    const payload = hasDocument ? new FormData() : {
      organization_email: data.organization_email ?? data.email,
      organization_phone: data.organization_phone ?? data.phone,
    }

    if (payload instanceof FormData) {
      payload.append('document_type', data.document_type ?? '')
      if (data.document) payload.append('document', data.document)
      if (data.organization_email ?? data.email) payload.append('organization_email', data.organization_email ?? data.email ?? '')
      if (data.organization_phone ?? data.phone) payload.append('organization_phone', data.organization_phone ?? data.phone ?? '')
    }

    const res = await apiClient.post<ApiResponse<{ document_type?: string; status: VerificationApiStatusValue }>>(
      '/admin/verification/submit',
      payload
    )
    return res.data
  },

  list: (params?: { status?: string; page?: number; per_page?: number }) =>
    apiGet<PaginatedResponse<VerificationReviewItem>>(
      '/superadmin/verifications',
      params as Record<string, unknown>
    ),

  viewDocument: (id: number, index: number, reason: string) =>
    apiGet<DocumentAccess>(
      `/superadmin/verifications/${id}/document/${index}`,
      { reason }
    ),

  approve: (id: number) =>
    apiPatch(`/superadmin/verifications/${id}/approve`),

  reject: (id: number, reason: string) =>
    apiPatch<{ reason: string }>(`/superadmin/verifications/${id}/reject`, { reason }),
}
