// src/api/rooms.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { ListingHouseType } from './listings'
import type { PaginatedResponse } from '@/types'

// ─── Filters ─────────────────────────────────────────────────────────────
export interface RoomFilters {
  property_id?: number | string
  status?:       string
  room_type_id?: number | string
  house_type?:   ListingHouseType | ''
  floor?:        string
  block?:        string
  search?:       string
  sort?:         string
  direction?:    'asc' | 'desc'
  page?:         number
  per_page?:     number
}

// ─── Payloads ─────────────────────────────────────────────────────────────
export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'reserved'

export interface RoomPayload {
  property_id?: number | string
  room_type_id?:     number
  house_type?:       ListingHouseType | string
  property_type?:    ListingHouseType | string
  room_type?:        number | string | { id?: number | string; name?: string }
  roomType?:         number | string | { id?: number | string; name?: string }
  roomTypeId?:       number | string
  room_number:       string
  number_of_rooms?:  number | string
  rooms_per_floor?:  number | string
  roomNumber?:       string
  number?:           string | number
  floor?:            string
  block?:            string
  monthly_rent?:     number | string
  monthlyRent?:      number | string
  rent?:             number | string
  security_deposit?: number | string
  securityDeposit?:  number | string
  deposit?:          number | string
  capacity?:         number
  status?:           RoomStatus | string
  amenities?:        string[]
  notes?:            string
}

export interface RoomTypePayload {
  name:         string
  description?: string
  base_price?:  number
  capacity?:    number
  amenities?:   string[]
}

// ─── Response shapes ──────────────────────────────────────────────────────
export interface RoomAvailability {
  is_available:        boolean
  conflicting_lease:   Record<string, unknown> | null
  conflicting_booking: Record<string, unknown> | null
}

export interface RoomType {
  id:          number
  value?:      number
  label?:      string
  name:        string
  description: string | null
  base_price:  number | null
  capacity:    number | null
  amenities:   string[]
  is_active?:  boolean
}

export interface RoomTypeOptionsResponse {
  data: RoomType[]
  meta: {
    total: number
    active_only: boolean
  }
}

type RoomPayloadInput = Partial<RoomPayload> & Record<string, unknown>

function withoutPropertyId<T extends { property_id?: unknown }>(params: T): Record<string, unknown> {
  const {
    property_id: _propertyId,
    property_uuid: _propertyUuid,
    property_name: _propertyName,
    property: _property,
    ...payload
  } = params as T & {
    property_uuid?: unknown
    property_name?: unknown
    property?: unknown
  }
  return payload
}

function parseMoney(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  const cleaned = String(value).replace(/[^0-9.-]/g, '')
  if (!cleaned) return undefined
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parsePositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function normalizeRoomType(value: unknown): { room_type_id?: number; room_type?: string | number } {
  if (value === undefined || value === null || value === '') return {}
  if (typeof value === 'object') {
    const item = value as { id?: unknown; value?: unknown; name?: unknown; label?: unknown }
    const id = parsePositiveInt(item.id ?? item.value)
    if (id) return { room_type_id: id }
    const name = item.name ?? item.label
    return typeof name === 'string' && name.trim() ? { room_type: name.trim() } : {}
  }
  const id = parsePositiveInt(value)
  return id ? { room_type_id: id } : { room_type: String(value).trim() }
}

function normalizeRoomPayload(data: RoomPayloadInput, creating = false): RoomPayloadInput {
  const roomNumber = data.room_number ?? data.roomNumber ?? data.number
  const rawHouseType = data.house_type ?? data.property_type
  const houseType = typeof rawHouseType === 'string' ? rawHouseType.trim() : undefined
  const roomType = normalizeRoomType(data.room_type_id ?? data.roomTypeId ?? data.room_type ?? data.roomType ?? houseType)
  const monthlyRent = parseMoney(data.monthly_rent ?? data.monthlyRent ?? data.rent)
  const securityDeposit = parseMoney(data.security_deposit ?? data.securityDeposit ?? data.deposit)
  const capacity = parsePositiveInt(data.capacity) ?? (creating ? 1 : undefined)
  const numberOfRooms = creating ? (parsePositiveInt(data.number_of_rooms) ?? 1) : undefined
  const roomsPerFloor = creating ? parsePositiveInt(data.rooms_per_floor) : undefined
  const status = typeof data.status === 'string'
    ? data.status.trim().toLowerCase().replace(/\s+/g, '_')
    : undefined

  return {
    ...roomType,
    ...(roomNumber !== undefined && roomNumber !== null ? { room_number: String(roomNumber).trim() } : {}),
    ...(numberOfRooms !== undefined ? { number_of_rooms: numberOfRooms } : {}),
    ...(roomsPerFloor !== undefined ? { rooms_per_floor: roomsPerFloor } : {}),
    ...(monthlyRent !== undefined ? { monthly_rent: monthlyRent } : {}),
    ...(securityDeposit !== undefined ? { security_deposit: securityDeposit } : {}),
    ...(capacity !== undefined ? { capacity } : {}),
    ...(houseType ? { house_type: houseType } : {}),
    ...(status ? { status } : {}),
    ...(data.block !== undefined ? { block: data.block } : {}),
    ...(data.floor !== undefined && !roomsPerFloor ? { floor: data.floor } : {}),
    ...(Array.isArray(data.amenities) ? { amenities: data.amenities } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
  }
}

// ─── API ──────────────────────────────────────────────────────────────────
export const roomsApi = {
  // ── Rooms ────────────────────────────────────────────────────────
  list: (params: RoomFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/admin/rooms',
      params as Record<string, unknown>
    ),

  get: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/admin/rooms/${id}`),

  create: (data: RoomPayloadInput) =>
    apiPost<Record<string, unknown>>('/admin/rooms', normalizeRoomPayload(data, true)),

  update: (id: string | number, data: RoomPayloadInput) =>
    apiPatch<Record<string, unknown>>(`/admin/rooms/${id}`, normalizeRoomPayload(data)),

  delete: (id: string | number) =>
    apiDelete(`/admin/rooms/${id}`),

  updateStatus: (id: string | number, status: RoomStatus) =>
    apiPatch<{ id: number; status: RoomStatus }>(
      `/admin/rooms/${id}/status`,
      { status }
    ),

  nextNumber: () =>
    apiGet<{ next_room_number: string }>('/admin/rooms/next-number'),

  managerList: (params: RoomFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>(
      '/manager/rooms',
      params as Record<string, unknown>
    ),

  managerGet: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/manager/rooms/${id}`),

  managerCreate: (data: RoomPayloadInput) =>
    apiPost<Record<string, unknown>>('/manager/rooms', normalizeRoomPayload(data, true)),

  managerUpdate: (id: string | number, data: RoomPayloadInput) =>
    apiPatch<Record<string, unknown>>(`/manager/rooms/${id}`, normalizeRoomPayload(data)),

  managerDelete: (id: string | number) =>
    apiDelete(`/manager/rooms/${id}`),

  managerUpdateStatus: (id: string | number, status: RoomStatus) =>
    apiPatch<{ id: string | number; status: RoomStatus }>(
      `/manager/rooms/${id}/status`,
      { status }
    ),

  managerAddBeds: (id: string | number, beds: string[]) =>
    apiPost<Record<string, unknown>[]>(`/manager/rooms/${id}/beds`, { beds }),

  managerNextNumber: () =>
    apiGet<{ next_room_number: string }>('/manager/rooms/next-number'),

  managerRemoveBed: (roomId: string, bedId: string) =>
    apiDelete(`/manager/rooms/${roomId}/beds/${bedId}`),

  availability: (id: string | number, from: string, to: string) =>
    apiGet<RoomAvailability>(
      `/admin/rooms/${id}/availability`,
      { from, to }
    ),

  addBeds: (id: string | number, beds: string[]) =>
    apiPost<Record<string, unknown>[]>(
      `/admin/rooms/${id}/beds`,
      { beds }
    ),

  removeBed: (roomId: string, bedId: string) =>
    apiDelete(`/admin/rooms/${roomId}/beds/${bedId}`),

  // ── Tenant — view own room ───────────────────────────────────────
  tenantRoom: () =>
    apiGet<Record<string, unknown>>('/tenant/room'),

  // ── Room types ───────────────────────────────────────────────────
  roomTypes: (params?: { active_only?: 0 | 1 | boolean; search?: string }) =>
    apiGet<RoomTypeOptionsResponse>(
      '/admin/room-types/options',
      params as Record<string, unknown>
    ),

  createRoomType: (data: RoomTypePayload) =>
    apiPost<RoomType>('/admin/room-types', data),

  updateRoomType: (id: number, data: Partial<RoomTypePayload>) =>
    apiPatch<RoomType>(`/admin/room-types/${id}`, data),

  deleteRoomType: (id: number) =>
    apiDelete(`/admin/room-types/${id}`),
}
