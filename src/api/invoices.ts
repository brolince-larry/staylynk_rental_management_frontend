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
  month:            string
  total_invoices:   number
  total_expected:   number
  total_collected:  number
  total_pending:    number
  collection_rate:  number
  by_status: {
    paid:    number
    partial: number
    pending: number
    overdue: number
  }
  by_property: Array<{
    property_id:     number
    property_name:   string
    invoices:        number
    expected:        number
    collected:       number
    pending:         number
    collection_rate: number
  }>
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

  get: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/admin/invoices/${id}`),

  create: (data: InvoicePayload) =>
    apiPost<Record<string, unknown>>('/admin/invoices', data),

  update: (id: string | number, data: Partial<InvoicePayload>) =>
    apiPatch<Record<string, unknown>>(`/admin/invoices/${id}`, data),

  delete: (id: string | number) =>
    apiDelete(`/admin/invoices/${id}`),

  generateMonthly: (invoice_month: string) =>
    apiPost<GenerateMonthlyResult>(
      '/admin/invoices/generate-monthly',
      { invoice_month }
    ),

  void: (id: string | number, reason: string) =>
    apiPatch<{ id: string | number; status: string }>(
      `/admin/invoices/${id}/void`,
      { reason }
    ),

  send: (id: string | number) =>
    apiPost<{ id: string | number; sent_at: string }>(
      `/admin/invoices/${id}/send`
    ),

  download: (id: string | number) =>
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

  tenantGet: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/tenant/invoices/${id}`),

  tenantDownload: (id: string | number) =>
    apiGet<{ url?: string; expires_in?: string }>(`/tenant/invoices/${id}/download`),
}
