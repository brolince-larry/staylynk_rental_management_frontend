// src/api/maintenance.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { PaginatedResponse } from '@/types'

// ─── Filters ─────────────────────────────────────────────────────────────
export interface MaintenanceFilters {
  property_id?: string | 'all'
  status?:      string
  priority?:    string
  category?:    string
  assigned_to?: 'me' | number
  unassigned?:  boolean
  search?:      string
  sort?:        string
  direction?:   'asc' | 'desc'
  page?:        number
  per_page?:    number
}

// ─── Payloads ─────────────────────────────────────────────────────────────
export type MaintenanceCategory =
  | 'electrical'
  | 'plumbing'
  | 'furniture'
  | 'appliance'
  | 'structural'
  | 'cleaning'
  | 'pest_control'
  | 'repair'
  | 'other'

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent'

export interface MaintenancePayload {
  property_id?: number | string
  room_id?:     number
  tenant_id?:   number
  title:        string
  description:  string
  category:     MaintenanceCategory
  priority?:    MaintenancePriority
  images?:      string[]
}

export interface ResolvePayload {
  resolution_notes: string
  repair_cost?:     number
}

// ─── Response shapes ──────────────────────────────────────────────────────
export interface MaintenanceSummary {
  open:                  number
  in_progress:           number
  resolved:              number
  rejected:              number
  urgent:                number
  avg_resolution_hours:  number
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

// ─── API ──────────────────────────────────────────────────────────────────
export const maintenanceApi = {
  // ── Manager ──────────────────────────────────────────────────────
  list: (params: MaintenanceFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/manager/maintenance',
      stripPropertyId(params) as Record<string, unknown>
    ),

  get: (id: string) =>
    apiGet<Record<string, unknown>>(`/manager/maintenance/${id}`),

  create: (data: MaintenancePayload) =>
    apiPost<Record<string, unknown>>('/manager/maintenance', stripPropertyId(data)),

  update: (id: string, data: Partial<MaintenancePayload>) =>
    apiPatch<Record<string, unknown>>(`/manager/maintenance/${id}`, stripPropertyId(data)),

  delete: (id: string) =>
    apiDelete(`/manager/maintenance/${id}`),

  assign: (id: string, assigned_to: number) =>
    apiPatch<{ id: number; status: string; assigned_at: string }>(
      `/manager/maintenance/${id}/assign`,
      { assigned_to }
    ),

  startProgress: (id: number) =>
    apiPatch<{ id: number; status: string }>(
      `/manager/maintenance/${id}/progress`
    ),

  resolve: (id: string, data: ResolvePayload) =>
    apiPatch<{ id: number; status: string; resolved_at: string }>(
      `/manager/maintenance/${id}/resolve`,
      data
    ),

  reject: (id: number, reason: string) =>
    apiPatch<{ id: number; status: string }>(
      `/manager/maintenance/${id}/reject`,
      { reason }
    ),

  summary: (params?: { property_id?: string | 'all' }) =>
    apiGet<MaintenanceSummary>(
      '/manager/maintenance/summary',
      params ? stripPropertyId(params) as Record<string, unknown> : undefined
    ),

  // ── Tenant ───────────────────────────────────────────────────────
  tenantList: (params?: { status?: string; page?: number; per_page?: number }) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/tenant/maintenance',
      params as Record<string, unknown>
    ),

  tenantGet: (id: number) =>
    apiGet<Record<string, unknown>>(`/tenant/maintenance/${id}`),

  tenantCreate: (data: {
    title:       string
    description: string
    category:    MaintenanceCategory
    priority?:   Exclude<MaintenancePriority, 'urgent'>
    images?:     string[]
  }) =>
    apiPost<Record<string, unknown>>('/tenant/maintenance', data),
}
