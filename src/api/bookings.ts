// src/api/bookings.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { PaginatedResponse } from '@/types'

export interface BookingHunter {
  name: string
  email: string
  phone: string | null
  message: string | null
}

export interface BookingFilters {
  property_id?: string | 'all'
  tenant_id?: number
  status?: string
  source?: 'admin' | 'public'
  from?: string
  to?: string
  search?: string
  sort?: string
  direction?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

export interface BookingPayload {
  property_id?: number | string
  room_id: number
  bed_id?: number
  tenant_id: number
  check_in_date: string
  check_out_date?: string
  amount: number
  deposit_paid?: number
  notes?: string
}

export interface BookingConfirmResponse {
  id: number
  status: string
  cancelled_count?: number
}

export interface BookingCheckInResponse {
  id: number
  status: string
  actual_check_in: string
  tenant_created?: boolean
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

export const bookingsApi = {
  list: (params: BookingFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/admin/bookings', params as Record<string, unknown>),

  managerList: (params: BookingFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/manager/bookings', stripPropertyId(params) as Record<string, unknown>),

  get: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/admin/bookings/${id}`),

  create: (data: BookingPayload) =>
    apiPost<Record<string, unknown>>('/admin/bookings', stripPropertyId(data)),

  update: (id: string | number, data: Partial<BookingPayload>) =>
    apiPatch<Record<string, unknown>>(`/admin/bookings/${id}`, stripPropertyId(data)),

  confirm: (id: string | number) =>
    apiPatch<BookingConfirmResponse>(`/admin/bookings/${id}/confirm`),

  reject: (id: string | number, rejection_reason: string) =>
    apiPatch<{ id: number; status: string }>(`/admin/bookings/${id}/reject`, { rejection_reason }),

  checkIn: (id: string | number) =>
    apiPatch<BookingCheckInResponse>(`/admin/bookings/${id}/check-in`),

  checkOut: (id: string | number) =>
    apiPatch<{ id: number; status: string; actual_check_out: string }>(`/admin/bookings/${id}/check-out`),

  cancel: (id: string | number, reason: string) =>
    apiPatch<{ id: number; status: string }>(`/admin/bookings/${id}/cancel`, { reason }),

  noShow: (id: string | number) =>
    apiPatch<{ id: number; status: string }>(`/admin/bookings/${id}/no-show`),

  clearRejected: () =>
    apiDelete<{ deleted: number }>('/admin/bookings/rejected'),

  // Manager actions
  managerConfirm: (id: string | number) =>
    apiPatch<BookingConfirmResponse>(`/manager/bookings/${id}/confirm`),

  managerReject: (id: string | number, rejection_reason: string) =>
    apiPatch<{ id: number; status: string }>(`/manager/bookings/${id}/reject`, { rejection_reason }),

  managerNoShow: (id: string | number) =>
    apiPatch<{ id: number; status: string }>(`/manager/bookings/${id}/no-show`),

  managerCancel: (id: string | number, reason: string) =>
    apiPatch<{ id: number; status: string }>(`/manager/bookings/${id}/cancel`, { reason }),

  managerClearRejected: () =>
    apiDelete<{ deleted: number }>('/manager/bookings/rejected'),

  summary: (params?: { property_id?: string | 'all' }) =>
    apiGet<Record<string, number>>('/admin/bookings/summary', params as Record<string, unknown>),

  // Manager check-in/out
  checkInOutList: (params?: { type?: string; property_id?: string | 'all' }) =>
    apiGet<{ date: string; count: number; bookings: Record<string, unknown>[] }>('/manager/check-in-out', params ? stripPropertyId(params) as Record<string, unknown> : undefined),

  managerCheckIn: (id: string | number) =>
    apiPatch<{ id: number; actual_check_in: string }>(`/manager/check-in-out/${id}/in`),

  managerCheckOut: (id: string | number) =>
    apiPatch<{ id: number; actual_check_out: string }>(`/manager/check-in-out/${id}/out`),
}
