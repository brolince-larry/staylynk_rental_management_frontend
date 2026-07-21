import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type { PaginatedResponse, PaymentCredential, PaymentProvider } from '@/types'

export interface PaymentCredentialFilters {
  org_id?: string
  provider?: PaymentProvider
  page?: number
  per_page?: number
}

export interface PaymentCredentialPayload {
  org_id: string
  property_name?: string | null
  provider: PaymentProvider
  environment?: 'sandbox' | 'production'
  display_name: string
  shortcode?: string | null
  consumer_key?: string
  consumer_secret?: string
  passkey?: string
  callback_url?: string | null
  is_active?: boolean
}

export interface PaymentCredentialApproval {
  approval_id: string
  status: 'pending_approval'
  expires_at?: string | null
  email_sent?: boolean
}

export type PaymentCredentialMutationResult = PaymentCredential | PaymentCredentialApproval

export const paymentCredentialsApi = {
  list: (params: PaymentCredentialFilters = {}) =>
    apiGet<PaginatedResponse<PaymentCredential>>(
      '/superadmin/payment-credentials',
      params as Record<string, unknown>
    ),

  create: (data: PaymentCredentialPayload) =>
    apiPost<PaymentCredentialMutationResult>('/superadmin/payment-credentials', data),

  update: (uuid: string, data: Partial<PaymentCredentialPayload>) =>
    apiPatch<PaymentCredentialMutationResult>(`/superadmin/payment-credentials/${uuid}`, data),

  disable: (uuid: string) =>
    apiDelete(`/superadmin/payment-credentials/${uuid}`),
}
