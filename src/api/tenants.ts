// src/api/tenants.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { PaginatedResponse } from '@/types'

export interface TenantFilters {
  property_id?: string | 'all'
  room_id?: number
  status?: string
  lease_status?: string
  is_verified?: boolean
  search?: string
  page?: number
  per_page?: number
}

export interface TenantPayload {
  name: string
  email: string
  phone_number: string
  alternative_phone?: string
  property_id?: number | string
  room_id?: number
  room_uuid?: string
  room_number?: string
  move_in_date?: string
  first_payment_due_date?: string
  lease_status?: 'pending' | 'active' | 'expired' | 'terminated' | 'cancelled'
  password?: string
  emergency_name?: string
  emergency_phone?: string
  emergency_relationship?: string
  notes?: string
}

function stripPropertyId<T extends { property_id?: unknown }>(data: T): Record<string, unknown> {
  const {
    property_id: _propertyId,
    property_uuid: _propertyUuid,
    property_name: _propertyName,
    property: _property,
    ...payload
  } = data as T & {
    property_uuid?: unknown
    property_name?: unknown
    property?: unknown
  }
  return payload
}

export const tenantsApi = {
  list: (params: TenantFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/admin/tenants', params as Record<string, unknown>),

  get: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/admin/tenants/${id}`),

  create: (data: TenantPayload) =>
    apiPost<Record<string, unknown>>('/admin/tenants', data),

  update: (id: string | number, data: Partial<TenantPayload & { status?: string }>) =>
    apiPatch<Record<string, unknown>>(`/admin/tenants/${id}`, data),

  delete: (id: string | number) =>
    apiDelete(`/admin/tenants/${id}`),

  history: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/admin/tenants/${id}/history`),

  verify: (id: string | number) =>
    apiPatch<{ id: number; is_verified: boolean; verified_at: string }>(`/admin/tenants/${id}/verify`),

  updateStatus: (id: string | number, status: string, reason?: string) =>
    apiPatch<{ id: number; status: string }>(`/admin/tenants/${id}/status`, { status, reason }),

  managerList: (params: TenantFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/manager/tenants', params as Record<string, unknown>),

  managerCreate: (data: TenantPayload) =>
    apiPost<Record<string, unknown>>('/manager/tenants', data),

  managerUpdate: (id: string | number, data: Partial<TenantPayload & { status?: string }>) =>
    apiPatch<Record<string, unknown>>(`/manager/tenants/${id}`, data),

  managerDelete: (id: string | number) =>
    apiDelete(`/manager/tenants/${id}`),

  managerVerify: (id: string | number) =>
    apiPatch<{ id: number; is_verified: boolean; verified_at: string }>(`/manager/tenants/${id}/verify`),

  managerUpdateStatus: (id: string | number, status: string, reason?: string) =>
    apiPatch<{ id: number; status: string }>(`/manager/tenants/${id}/status`, { status, reason }),

  updatePropertyPenalty: (propertyId: string, data: {
    penalty_enabled: boolean; penalty_type?: string; penalty_amount?: number; penalty_grace_days?: number
  }) =>
    apiPatch<Record<string, unknown>>(`/admin/properties/${propertyId}/penalty`, data),
}

// ── src/api/invoices.ts ───────────────────────────────────────────────────
export interface InvoiceFilters {
  property_id?: number | string
  tenant_id?: number
  status?: string
  invoice_month?: string
  from?: string
  to?: string
  search?: string
  page?: number
  per_page?: number
}

export interface InvoicePayload {
  lease_id: number
  invoice_month: string
  due_date: string
  rent_amount: number
  late_fee?: number
  utility_charges?: number
  other_charges?: number
  discount?: number
  notes?: string
}

export const invoicesApi = {
  list: (params: InvoiceFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/admin/invoices', params as Record<string, unknown>),

  get: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/admin/invoices/${id}`),

  create: (data: InvoicePayload) =>
    apiPost<Record<string, unknown>>('/admin/invoices', data),

  update: (id: string | number, data: Partial<InvoicePayload>) =>
    apiPatch<Record<string, unknown>>(`/admin/invoices/${id}`, data),

  delete: (id: string | number) =>
    apiDelete(`/admin/invoices/${id}`),

  generateMonthly: (invoice_month: string, property_id?: number) =>
    apiPost<{ generated: number; invoice_month: string; errors: string[] }>(
      '/admin/invoices/generate-monthly', { invoice_month, property_id }
    ),

  void: (id: string | number, reason: string) =>
    apiPatch<{ id: number; status: string }>(`/admin/invoices/${id}/void`, { reason }),

  send: (id: string | number) =>
    apiPost<{ id: number; sent_at: string }>(`/admin/invoices/${id}/send`),

  summary: (params?: { property_id?: number; month?: string }) =>
    apiGet<Record<string, unknown>>('/admin/invoices/summary', params as Record<string, unknown>),

  // Manager
  managerList: (params: InvoiceFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/manager/invoices', params as Record<string, unknown>),

  // Tenant
  tenantList: (params?: { status?: string; page?: number; per_page?: number }) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/tenant/invoices', params as Record<string, unknown>),

  tenantGet: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/tenant/invoices/${id}`),
}

// ── src/api/payments.ts ───────────────────────────────────────────────────
export interface PaymentFilters {
  property_id?: number | string
  tenant_id?: number
  method?: string
  status?: string
  from?: string
  to?: string
  search?: string
  page?: number
  per_page?: number
}

export interface PaymentPayload {
  invoice_id: number
  tenant_id: number
  amount: number
  method: 'bank_transfer' | 'mpesa' | 'card' | 'cheque'
  transaction_id?: string
  phone_number?: string
  paid_at?: string
  notes?: string
}

export const paymentsApi = {
  list: (params: PaymentFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/admin/payments', params as Record<string, unknown>),

  get: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/admin/payments/${id}`),

  create: (data: PaymentPayload) =>
    apiPost<Record<string, unknown>>('/admin/payments', data),

  reverse: (id: string | number) =>
    apiDelete<{ id: number; status: string; invoice_balance: number }>(`/admin/payments/${id}`),

  receipt: (id: string | number) =>
    apiGet<{ url?: string; receipt?: Record<string, unknown> }>(`/admin/payments/${id}/receipt`),

  summary: (params?: { property_id?: number; month?: string }) =>
    apiGet<Record<string, unknown>>('/admin/payments/summary', params as Record<string, unknown>),

  // Rent collection
  rentList: (params?: { property_id?: number; month?: string; status?: string; page?: number }) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/admin/rent', params as Record<string, unknown>),

  recordRent: (invoiceId: number, data: Omit<PaymentPayload, 'invoice_id' | 'tenant_id'>) =>
    apiPost<{ payment_reference: string; amount: number; invoice_status: string }>(
      `/admin/rent/${invoiceId}/payment`, data
    ),

  rentSummary: (month?: string) =>
    apiGet<Record<string, unknown>>('/admin/rent/summary', month ? { month } : undefined),

  recordLastPayment: (leaseId: string, data: { last_paid_date: string; last_paid_amount: number; notes?: string }) =>
    apiPatch<{ last_paid_date: string; last_paid_amount: number; arrears_balance: number }>(
      `/admin/rent/leases/${leaseId}/record-payment`, data
    ),

  leasePaymentStatus: (leaseId: string) =>
    apiGet<Record<string, unknown>>(`/admin/rent/leases/${leaseId}/payment-status`),

  updatePropertyPenalty: (propertyId: string, data: {
    penalty_enabled: boolean; penalty_type?: string; penalty_amount?: number; penalty_grace_days?: number
  }) =>
    apiPatch<Record<string, unknown>>(`/admin/properties/${propertyId}/penalty`, data),

  // Manager payments
  managerList: (params: PaymentFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/manager/payments', params as Record<string, unknown>),

  managerCreate: (data: PaymentPayload) =>
    apiPost<Record<string, unknown>>('/manager/payments', data),

  // Tenant
  tenantList: (params?: { page?: number; per_page?: number }) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/tenant/payments', params as Record<string, unknown>),

  tenantReceipt: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/tenant/payments/${id}/receipt`),
}

// ── src/api/leases.ts ─────────────────────────────────────────────────────
export interface LeaseFilters {
  property_id?: number | string
  tenant_id?: number
  status?: string
  expiring_soon?: boolean
  search?: string
  page?: number
  per_page?: number
}

export interface LeasePayload {
  property_id: number | string
  room_id: number
  bed_id?: number
  tenant_id: number
  booking_id?: number
  start_date: string
  lease_term_months: number
  monthly_rent: number
  security_deposit?: number
  advance_rent?: number
  payment_due_day?: number
  payment_method?: string
  terms?: string
}

export const leasesApi = {
  // Admin
  adminList: (params: LeaseFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/admin/leases', params as Record<string, unknown>),
  adminGet: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/admin/leases/${id}`),
  adminTerminate: (id: string | number, data: { reason: string; termination_date?: string }) =>
    apiPatch<Record<string, unknown>>(`/admin/leases/${id}/terminate`, data),
  adminDownload: (id: string | number) =>
    apiGet<{ url?: string; expires_in?: string }>(`/admin/leases/${id}/download`),

  // Manager
  list: (params: LeaseFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/manager/leases', params as Record<string, unknown>),

  get: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/manager/leases/${id}`),

  create: (data: LeasePayload) =>
    apiPost<Record<string, unknown>>('/manager/leases', data),

  terminate: (id: string | number, data: { reason: string; termination_date?: string }) =>
    apiPatch<Record<string, unknown>>(`/manager/leases/${id}/terminate`, data),

  renew: (id: string | number, data: { lease_term_months: number; monthly_rent?: number; payment_due_day?: number }) =>
    apiPost<Record<string, unknown>>(`/manager/leases/${id}/renew`, data),

  download: (id: string | number) =>
    apiGet<{ url?: string; expires_in?: string }>(`/manager/leases/${id}/download`),

  expiring: (days?: number) =>
    apiGet<{ count: number; leases: Record<string, unknown>[] }>('/manager/leases/expiring', days ? { days } : undefined),

  summary: () =>
    apiGet<Record<string, number>>('/manager/leases/summary'),

  // Tenant
  tenantLease: () =>
    apiGet<Record<string, unknown>>('/tenant/lease'),

  tenantHistory: () =>
    apiGet<Record<string, unknown>[]>('/tenant/lease/history'),

  tenantDownload: () =>
    apiGet<{ url?: string; expires_in?: string }>('/tenant/lease/agreement'),
}

// ── src/api/maintenance.ts ────────────────────────────────────────────────
export interface MaintenanceFilters {
  property_id?: number | string
  status?: string
  priority?: string
  category?: string
  assigned_to?: 'me' | number
  unassigned?: boolean
  search?: string
  page?: number
  per_page?: number
}

export interface MaintenancePayload {
  property_id: number | string
  room_id?: number
  tenant_id?: number
  title: string
  description: string
  category: string
  priority?: string
  images?: string[]
}

export const maintenanceApi = {
  // Manager
  list: (params: MaintenanceFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/manager/maintenance', params as Record<string, unknown>),

  get: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/manager/maintenance/${id}`),

  create: (data: MaintenancePayload) =>
    apiPost<Record<string, unknown>>('/manager/maintenance', data),

  assign: (id: string | number, assigned_to: number) =>
    apiPatch<{ id: number; status: string; assigned_at: string }>(`/manager/maintenance/${id}/assign`, { assigned_to }),

  startProgress: (id: string | number) =>
    apiPatch<{ id: number; status: string }>(`/manager/maintenance/${id}/progress`),

  resolve: (id: number, data: { resolution_notes: string; repair_cost?: number }) =>
    apiPatch<{ id: number; status: string; resolved_at: string }>(`/manager/maintenance/${id}/resolve`, data),

  reject: (id: number, reason: string) =>
    apiPatch<{ id: number; status: string }>(`/manager/maintenance/${id}/reject`, { reason }),

  delete: (id: string | number) =>
    apiDelete(`/manager/maintenance/${id}`),

  summary: (params?: { property_id?: number }) =>
    apiGet<Record<string, unknown>>('/manager/maintenance/summary', params as Record<string, unknown>),

  // Tenant
  tenantList: (params?: { status?: string; page?: number; per_page?: number }) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/tenant/maintenance', params as Record<string, unknown>),

  tenantGet: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/tenant/maintenance/${id}`),

  tenantCreate: (data: Pick<MaintenancePayload, 'title' | 'description' | 'category' | 'images'> & { priority?: string }) =>
    apiPost<Record<string, unknown>>('/tenant/maintenance', data),
}
