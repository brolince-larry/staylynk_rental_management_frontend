// src/api/invoices.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { PaginatedResponse } from '@/types'

// ─── Filters ─────────────────────────────────────────────────────────────
export interface InvoiceFilters {
  property_id?:   number | 'all'
  tenant_id?:     number
  status?:        string
  invoice_month?: string
  from?:          string
  to?:            string
  search?:        string
  sort?:          string
  direction?:     'asc' | 'desc'
  page?:          number
  per_page?:      number
}

// ─── Payloads ─────────────────────────────────────────────────────────────
export interface InvoicePayload {
  lease_id:         number
  invoice_month:    string
  due_date:         string
  rent_amount:      number
  late_fee?:        number
  utility_charges?: number
  other_charges?:   number
  discount?:        number
  notes?:           string
}

// ─── Response shapes ──────────────────────────────────────────────────────
export interface InvoiceSummary {
  total_count:    number
  total_amount:   number
  paid_amount:    number
  pending_amount: number
  overdue_count:  number
  overdue_amount: number
  void_count:     number
}

export interface GenerateMonthlyResult {
  generated:     number
  invoice_month: string
  skipped:       number
  errors:        string[]
}

// ─── API ──────────────────────────────────────────────────────────────────
export const invoicesApi = {
  // ── Admin ────────────────────────────────────────────────────────
  list: (params: InvoiceFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/admin/invoices',
      params as Record<string, unknown>
    ),

  get: (id: string) =>
    apiGet<Record<string, unknown>>(`/admin/invoices/${id}`),

  create: (data: InvoicePayload) =>
    apiPost<Record<string, unknown>>('/admin/invoices', data),

  update: (id: string, data: Partial<InvoicePayload>) =>
    apiPatch<Record<string, unknown>>(`/admin/invoices/${id}`, data),

  delete: (id: string) =>
    apiDelete(`/admin/invoices/${id}`),

  generateMonthly: (invoice_month: string) =>
    apiPost<GenerateMonthlyResult>(
      '/admin/invoices/generate-monthly',
      { invoice_month }
    ),

  void: (id: string, reason: string) =>
    apiPatch<{ id: string; status: string }>(
      `/admin/invoices/${id}/void`,
      { reason }
    ),

  send: (id: string) =>
    apiPost<{ id: string; sent_at: string }>(
      `/admin/invoices/${id}/send`
    ),

  download: (id: string) =>
    apiGet<{ url?: string; expires_in?: string }>(`/admin/invoices/${id}/download`),

  summary: (params?: { property_id?: number | 'all'; month?: string }) =>
    apiGet<InvoiceSummary>(
      '/admin/invoices/summary',
      params as Record<string, unknown>
    ),

  // ── Manager ──────────────────────────────────────────────────────
  managerList: (params: InvoiceFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/manager/invoices',
      params as Record<string, unknown>
    ),

  // ── Tenant ───────────────────────────────────────────────────────
  tenantList: (params?: { status?: string; page?: number; per_page?: number }) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/tenant/invoices',
      params as Record<string, unknown>
    ),

  tenantGet: (id: string) =>
    apiGet<Record<string, unknown>>(`/tenant/invoices/${id}`),

  tenantDownload: (id: string) =>
    apiGet<{ url?: string; expires_in?: string }>(`/tenant/invoices/${id}/download`),
}
