// src/api/payments.ts
import { apiClient, apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { ApiResponse } from '@/types'
import type { PaginatedResponse } from '@/types'

// ─── Filters ─────────────────────────────────────────────────────────────
export interface PaymentFilters {
  property_id?: string | 'all'
  tenant_id?:   number
  method?:      string
  status?:      string
  from?:        string
  to?:          string
  search?:      string
  sort?:        string
  direction?:   'asc' | 'desc'
  page?:        number
  per_page?:    number
}

export interface RentFilters {
  property_id?: string | 'all'
  month?:       string
  status?:      string
  search?:      string
  page?:        number
  per_page?:    number
}

// ─── Payloads ─────────────────────────────────────────────────────────────
export type PaymentMethod = 'bank_transfer' | 'mpesa' | 'card' | 'cheque' | 'cash'

export interface PaymentPayload {
  invoice_id:      number
  tenant_id:       number
  amount:          number
  method:          PaymentMethod
  transaction_id?: string
  phone_number?:   string
  paid_at?:        string
  notes?:          string
}

// ─── Bank Transfer ────────────────────────────────────────────────────────
export interface BankInfo {
  bank_name:      string
  account_name:   string
  account_number: string
  branch?:        string | null
  swift_code?:    string | null
  instructions?:  string | null
}

// ─── Response shapes ──────────────────────────────────────────────────────
export interface PaymentSummary {
  total_collected:   number
  total_reversed:    number
  total_pending:     number
  transaction_count: number
}

export interface RentSummary {
  expected:        number
  collected:       number
  pending:         number
  overdue:         number
  collection_rate: number
}

export interface RecordRentResult {
  payment_reference: string
  amount:            number
  invoice_status:    string
}

export interface MpesaInitiateResult {
  payment: {
    id: string | number
    payment_reference: string
    amount: number
    method: 'mpesa'
    status: 'pending' | string
    checkout_request_id?: string | null
  }
  provider: {
    name: 'mpesa'
    action: 'await_stk_push' | string
    phone_number: string
  }
}

// ─── API ──────────────────────────────────────────────────────────────────
export const paymentsApi = {
  // ── Admin payments ───────────────────────────────────────────────
  list: (params: PaymentFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/admin/payments',
      params as Record<string, unknown>
    ),

  get: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/admin/payments/${id}`),

  create: (data: PaymentPayload) =>
    apiPost<Record<string, unknown>>('/admin/payments', data),

  reverse: (id: string | number) =>
    apiDelete<{ id: string | number; status: string; invoice_balance: number }>(
      `/admin/payments/${id}`
    ),

  receipt: (id: string | number) =>
    apiGet<{ url?: string; expires_in?: string }>(`/admin/payments/${id}/receipt`),

  summary: (params?: { property_id?: string | 'all'; month?: string }) =>
    apiGet<PaymentSummary>(
      '/admin/payments/summary',
      params as Record<string, unknown>
    ),

  // ── Admin rent collection ────────────────────────────────────────
  rentList: (params: RentFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/admin/rent',
      params as Record<string, unknown>
    ),

  recordRent: (
    invoiceId: number,
    data: {
      amount:          number
      method:          PaymentMethod
      transaction_id?: string
      phone_number?:   string
      notes?:          string
    }
  ) =>
    apiPost<RecordRentResult>(
      `/admin/rent/${invoiceId}/payment`,
      data
    ),

  rentSummary: (params?: { month?: string; property_id?: number }) =>
    apiGet<RentSummary>(
      '/admin/rent/summary',
      params ?? undefined
    ),

  // ── Manager ──────────────────────────────────────────────────────
  managerList: (params: PaymentFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/manager/payments',
      params as Record<string, unknown>
    ),

  managerCreate: (data: PaymentPayload) =>
    apiPost<Record<string, unknown>>('/manager/payments', data),

  managerReceipt: (id: string | number) =>
    apiGet<{ url?: string; expires_in?: string }>(`/manager/payments/${id}/receipt`),

  // ── Tenant ───────────────────────────────────────────────────────
  tenantList: (params?: { page?: number; per_page?: number }) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/tenant/payments',
      params as Record<string, unknown>
    ),

  tenantReceipt: (id: string | number) =>
    apiGet<{ url?: string; expires_in?: string }>(`/tenant/payments/${id}/receipt`),

  initiateMpesa: (invoiceId: number, phone_number: string, amount?: number) =>
    apiPost<MpesaInitiateResult>(
      '/tenant/payments/initiate',
      { invoice_id: invoiceId, method: 'mpesa', phone_number, ...(amount ? { amount } : {}) }
    ),

  tenantBankInfo: () =>
    apiGet<BankInfo>('/tenant/payments/bank-info'),

  tenantBankTransfer: async (data: FormData, onProgress?: (percent: number) => void) => {
    const res = await apiClient.post<ApiResponse<{ payment: { id: number; payment_reference: string; status: string } }>>(
      '/tenant/payments/bank-transfer',
      data,
      {
        onUploadProgress: (event) => {
          if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100))
        },
      }
    )
    return res.data
  },

  // ── Bank transfer review (admin) ─────────────────────────────────
  adminApproveBankTransfer: (id: string | number) =>
    apiPatch<Record<string, unknown>>(`/admin/payments/${id}/approve`, {}),

  adminRejectBankTransfer: (id: string | number, reason: string) =>
    apiPatch<Record<string, unknown>>(`/admin/payments/${id}/reject`, { reason }),

  adminBankReceipt: (id: string | number) =>
    apiGet<{ url: string; expires_in?: string }>(`/admin/payments/${id}/bank-receipt`),

  // ── Bank transfer review (manager) ───────────────────────────────
  managerApproveBankTransfer: (id: string | number) =>
    apiPatch<Record<string, unknown>>(`/manager/payments/${id}/approve`, {}),

  managerRejectBankTransfer: (id: string | number, reason: string) =>
    apiPatch<Record<string, unknown>>(`/manager/payments/${id}/reject`, { reason }),

  managerBankReceipt: (id: string | number) =>
    apiGet<{ url: string; expires_in?: string }>(`/manager/payments/${id}/bank-receipt`),
}
