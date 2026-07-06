// src/api/leases.ts
import { apiGet, apiPost, apiPatch } from './client'
import type { PaginatedResponse } from '@/types'

// ─── Filters ─────────────────────────────────────────────────────────────
export interface LeaseFilters {
  property_id?:   number | 'all'
  tenant_id?:     number
  status?:        string
  expiring_soon?: boolean
  search?:        string
  sort?:          string
  direction?:     'asc' | 'desc'
  page?:          number
  per_page?:      number
}

// ─── Payloads ─────────────────────────────────────────────────────────────
export type LeasePaymentMethod = 'cash' | 'bank_transfer' | 'mpesa' | 'card'

export interface LeasePayload {
  property_id?:      number
  room_id:           number
  bed_id?:           number
  tenant_id:         number
  booking_id?:       number
  start_date:        string
  lease_term_months: number
  monthly_rent:      number
  security_deposit?: number
  advance_rent?:     number
  payment_due_day?:  number
  payment_method?:   LeasePaymentMethod
  terms?:            string
}

export interface TerminatePayload {
  reason:            string
  termination_date?: string
}

export interface RenewPayload {
  lease_term_months: number
  monthly_rent?:     number
  payment_due_day?:  number
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

// ─── Response shapes ──────────────────────────────────────────────────────
export interface LeaseSummary {
  total:       number
  active:      number
  expiring_30: number
  expired:     number
  terminated:  number
}

export interface ExpiringLeasesResult {
  count:  number
  leases: Record<string, unknown>[]
}

// ─── API ──────────────────────────────────────────────────────────────────
export const leasesApi = {
  // ── Admin ────────────────────────────────────────────────────────
  adminList: (params: LeaseFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/admin/leases',
      params as Record<string, unknown>
    ),

  adminGet: (id: string) =>
    apiGet<Record<string, unknown>>(`/admin/leases/${id}`),

  adminTerminate: (id: string, data: TerminatePayload) =>
    apiPatch<Record<string, unknown>>(
      `/admin/leases/${id}/terminate`,
      data
    ),

  adminDownload: (id: string) =>
    apiGet<{ url?: string; expires_in?: string }>(`/admin/leases/${id}/download`),

  // ── Manager ──────────────────────────────────────────────────────
  list: (params: LeaseFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/manager/leases',
      stripPropertyId(params) as Record<string, unknown>
    ),

  get: (id: string) =>
    apiGet<Record<string, unknown>>(`/manager/leases/${id}`),

  create: (data: LeasePayload) =>
    apiPost<Record<string, unknown>>('/manager/leases', stripPropertyId(data)),

  terminate: (id: string, data: TerminatePayload) =>
    apiPatch<Record<string, unknown>>(
      `/manager/leases/${id}/terminate`,
      data
    ),

  renew: (id: string, data: RenewPayload) =>
    apiPost<Record<string, unknown>>(
      `/manager/leases/${id}/renew`,
      data
    ),

  download: (id: string) =>
    apiGet<{ url?: string; expires_in?: string }>(`/manager/leases/${id}/download`),

  expiring: (days?: number) =>
    apiGet<ExpiringLeasesResult>(
      '/manager/leases/expiring',
      days ? { days } : undefined
    ),

  summary: () =>
    apiGet<LeaseSummary>('/manager/leases/summary'),

  // ── Tenant ───────────────────────────────────────────────────────
  tenantLease: () =>
    apiGet<Record<string, unknown>>('/tenant/lease'),

  tenantHistory: () =>
    apiGet<Record<string, unknown>[]>('/tenant/lease/history'),

  tenantDownload: () =>
    apiGet<{ url?: string; expires_in?: string }>('/tenant/lease/agreement'),
}
