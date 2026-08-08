// src/api/properties.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { HouseType, SecurityLevel, VerificationStatus } from './listings'
import type { PaginatedResponse } from '@/types'

export interface PropertyFilters {
  status?: string
  search?: string
  sort?: string
  direction?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

export interface PropertyListingInput {
  title?: string
  description?: string
  house_types?: HouseType[]
  rent_min?: number
  rent_max?: number
  currency?: string
  bedrooms_min?: number
  bedrooms_max?: number
  bathrooms_min?: number
  bathrooms_max?: number
  neighbourhood?: string
  address_display?: string
  country?: string
  city?: string
  latitude?: number
  longitude?: number
  amenities?: string[]
  nearby_places?: Record<string, unknown>
  water_available?: boolean
  internet_available?: boolean
  parking_available?: boolean
  security_level?: SecurityLevel
  is_family_friendly?: boolean
  is_student_friendly?: boolean
  is_quiet_environment?: boolean
  pets_allowed?: boolean
  is_available?: boolean
}

export interface PropertyInput {
  name: string
  address: string
  city: string
  county?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
  phone?: string | null
  email?: string | null
  description?: string | null
  total_floors?: number | null
  latitude?: number | null
  longitude?: number | null
  status?: 'active' | 'inactive' | 'maintenance'
  settings?: Record<string, unknown>
  facilities?: string[]
  house_rules?: string[]
  listing?: PropertyListingInput
}

export interface Property {
  [key: string]: unknown
  id: number
  uuid: string
  name: string
  slug: string
  address: string
  city: string
  county?: string | null
  status: string
  state?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  description?: string | null
  total_floors?: number | null
  total_rooms?: number | null
  occupied_rooms?: number | null
  active_leases?: number | null
  occupancy_rate?: number | null
  created_at?: string | null
  cover_image?: unknown
  media?: unknown
  images?: unknown[]
  banner_url?: string | null
  listing?: {
    uuid: string
    slug: string
    title: string
    description?: string | null
    house_types?: HouseType[]
    rent_min: number
    rent_max: number
    currency: string
    bedrooms_min: number
    bedrooms_max: number
    bathrooms_min: number
    bathrooms_max: number
    neighbourhood?: string | null
    amenities: string[]
    water_available: boolean
    internet_available: boolean
    parking_available: boolean
    security_level?: SecurityLevel | null
    verification_status: VerificationStatus
    is_available: boolean
    is_published: boolean
  } | null
}

export type PropertyPayload = PropertyInput
export type PropertyOption = Pick<Property, 'id' | 'uuid' | 'name' | 'slug'> & Record<string, unknown>

export interface DeletedProperty {
  id: string
  name: string
  address: string | null
  city: string | null
  deleted_at: string | null
  scheduled_purge_at: string | null
  can_restore: boolean
}

export const propertiesApi = {
  list: (params: PropertyFilters = {}) =>
    apiGet<PaginatedResponse<Property>>('/admin/properties', params as Record<string, unknown>),

  get: (id: string | number) =>
    apiGet<Property>(`/admin/properties/${id}`),

  create: (data: PropertyInput) =>
    apiPost<Property>('/admin/properties', data),

  update: (id: string | number, data: Partial<PropertyInput>) =>
    apiPatch<Property>(`/admin/properties/${id}`, data),

  delete: (id: string | number) =>
    apiDelete(`/admin/properties/${id}`),

  verifyDeletion: (approvalId: string, code: string) =>
    apiPost(`/admin/properties/deletions/${approvalId}/verify`, { code }),
  restore: (uuid: string) =>
    apiPost(`/admin/properties/${uuid}/restore`),
  listDeleted: () =>
    apiGet<{ data: DeletedProperty[] }>('/admin/properties/deleted'),

  stats: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/admin/properties/${id}/stats`),

  updateStatus: (id: string | number, status: string) =>
    apiPatch<{ id: number; status: string }>(`/admin/properties/${id}/status`, { status }),

  options: () =>
    apiGet<PropertyOption[] | PaginatedResponse<PropertyOption>>('/admin/properties/options'),

  setCurrent: (id: string | number) =>
    apiPost<Record<string, unknown>>(`/admin/properties/${id}/current`),

  managerList: (params: PropertyFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/manager/properties', params as Record<string, unknown>),

  managerGet: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/manager/properties/${id}`),

  managerOptions: () =>
    apiGet<PropertyOption[] | PaginatedResponse<PropertyOption>>('/manager/properties/options'),

  managerUpdateStatus: (id: string | number, status: string) =>
    apiPatch<{ id: string | number; status: string }>(`/manager/properties/${id}/status`, { status }),

  managerSetCurrent: (id: string | number) =>
    apiPost<Record<string, unknown>>(`/manager/properties/${id}/current`),

  syncFacilities: (id: string | number, facilities: string[]) =>
    apiPost<Record<string, unknown>[]>(`/admin/properties/${id}/facilities`, { facilities }),

  syncHouseRules: (id: string | number, rules: string[]) =>
    apiPost<string[]>(`/admin/properties/${id}/house-rules`, { rules }),
}

// ── src/api/rooms.ts ──────────────────────────────────────────────────────
export interface RoomFilters {
  property_id?: number
  status?: string
  room_type_id?: number
  floor?: string
  block?: string
  search?: string
  page?: number
  per_page?: number
}

export interface RoomPayload {
  property_id: number
  room_type_id: number
  room_number: string
  floor?: string
  block?: string
  monthly_rent: number
  security_deposit?: number
  capacity: number
  status?: string
  amenities?: string[]
  notes?: string
  beds?: string[]
}

export const roomsApi = {
  list: (params: RoomFilters = {}) =>
    apiGet<PaginatedResponse<Record<string, unknown>>>('/admin/rooms', params as Record<string, unknown>),

  get: (id: string | number) =>
    apiGet<Record<string, unknown>>(`/admin/rooms/${id}`),

  create: (data: RoomPayload) =>
    apiPost<Record<string, unknown>>('/admin/rooms', data),

  update: (id: string | number, data: Partial<RoomPayload>) =>
    apiPatch<Record<string, unknown>>(`/admin/rooms/${id}`, data),

  delete: (id: string | number) =>
    apiDelete(`/admin/rooms/${id}`),

  updateStatus: (id: string | number, status: string) =>
    apiPatch<{ id: number; status: string }>(`/admin/rooms/${id}/status`, { status }),

  availability: (id: number, from: string, to: string) =>
    apiGet<{ is_available: boolean; conflicting_lease: unknown; conflicting_booking: unknown }>(
      `/admin/rooms/${id}/availability`, { from, to }
    ),

  addBeds: (id: string | number, beds: string[]) =>
    apiPost<Record<string, unknown>[]>(`/admin/rooms/${id}/beds`, { beds }),

  removeBed: (roomId: string, bedId: string) =>
    apiDelete(`/admin/rooms/${roomId}/beds/${bedId}`),

  roomTypes: () =>
    apiGet<Record<string, unknown>[]>('/admin/room-types'),
}
