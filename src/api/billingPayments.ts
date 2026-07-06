import { apiGet, apiPost } from './client'
import type { PaginatedResponse } from '@/types'

export interface AdminBillingInvoice {
  uuid: string
  invoice_number: string
  total: number
  status: 'pending' | 'overdue' | string
  due_date?: string | null
  paid_at?: string | null
  plan_name?: string | null
}

export interface BillingPaymentResult {
  invoice_number: string
  amount: number
  payment_reference: string
  status: string
  tracking_endpoint: string
}

export interface BillingPaymentStatus {
  payment_reference: string
  status: 'initiated' | 'pending' | 'completed' | 'failed' | 'cancelled' | string
  amount: number
  created_at?: string
}

export const billingPaymentsApi = {
  pendingInvoices: (params?: { page?: number; per_page?: number }) =>
    apiGet<PaginatedResponse<AdminBillingInvoice>>(
      '/admin/billing/invoices',
      params as Record<string, unknown>
    ),

  initiateMpesa: (data: {
    invoice_uuid: string
    method: 'mpesa'
    phone_number: string
    idempotency_key?: string
  }) => apiPost<BillingPaymentResult>('/admin/billing/payments/initiate', data),

  status: (paymentReference: string) =>
    apiGet<BillingPaymentStatus>(`/admin/billing/payments/${paymentReference}`),
}
