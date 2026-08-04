import { apiGet, apiPatch, apiPost } from './client'
import type { MediaItem } from '@/services/media'
import type { PaginatedResponse } from '@/types'

export const PROPERTY_TYPE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Apartments', value: 'apartment' },
  { label: 'Bedsitters', value: 'bedsitter' },
  { label: 'Houses', value: 'house' },
  { label: 'Rooms', value: 'room' },
  { label: 'Single Rooms', value: 'single_room' },
  { label: 'Double Rooms', value: 'double_room' },
  { label: 'Short Let', value: 'short_let' },
  { label: 'Studios', value: 'studio' },
  { label: 'Maisonettes', value: 'maisonette' },
  { label: 'Bungalows', value: 'bungalow' },
  { label: 'Townhouses', value: 'townhouse' },
  { label: 'Villas', value: 'villa' },
] as const

export const HOUSE_TYPE_OPTIONS = PROPERTY_TYPE_OPTIONS.filter((option) => option.value !== '') as Array<{ label: string; value: HouseType }>

export type HouseType =
  | 'apartment'
  | 'bedsitter'
  | 'house'
  | 'room'
  | 'single_room'
  | 'double_room'
  | 'short_let'
  | 'studio'
  | 'maisonette'
  | 'bungalow'
  | 'townhouse'
  | 'villa'

export type ListingHouseType = HouseType
export type SecurityLevel = 'low' | 'standard' | 'high' | 'gated'
export type VerificationStatus = 'unverified' | 'verified' | 'trusted'

export type ListingMediaReference = MediaItem | string | null

export interface ListingVideo {
  id: string | number
  video_url: string | null
  thumbnail_url: string | null
  duration?: number | null
  sort_order?: number
  is_featured?: boolean
  status?: 'queued' | 'processing' | 'ready' | 'failed' | string
  delivery?: 'hls' | 'mp4' | string
}

export interface ListingMediaPayload {
  cover?: ListingMediaReference
  gallery?: ListingMediaReference[]
  videos?: ListingVideo[]
}

export interface PublicListingRoom {
  id: number | string
  room_number?: string | null
  room_type?: string | { name?: string | null } | null
  floor?: string | null
  block?: string | null
  pricing?: {
    monthly_rent?: number | null
  } | null
  capacity?: number | null
  available_beds?: number | null
  amenities?: string[]
  media?: ListingMediaPayload
  cover_image?: ListingMediaReference
  gallery?: ListingMediaReference[]
}

export interface PublicListingUnits {
  rooms?: PublicListingRoom[]
  available?: number
  total?: number
}

export interface ListingFilters {
  status?: string
  house_type?: ListingHouseType | ''
  verified_only?: boolean
  trusted_only?: boolean
  page?: number
  per_page?: number
}

export interface PublicListing {
  uuid: string
  slug: string
  title: string
  city?: string | null
  house_type?: ListingHouseType | 'room' | string | null
  property_type?: string | null
  media?: ListingMediaPayload
  units?: PublicListingUnits
  cover_image?: ListingMediaReference
  gallery?: ListingMediaReference[]
  is_published: boolean
  is_available: boolean
  is_featured: boolean
  available_units: number
  total_units: number
  rent_min?: number | null
  rent_max?: number | null
  currency?: string | null
  verification_status?: string | null
  trust?: {
    verification_status?: string | null
    is_verified?: boolean | null
    is_trusted?: boolean | null
  } | null
  boost_score?: number | null
  published_at?: string | null
  last_synced_at?: string | null
  created_at?: string | null
  property?: { id: number; uuid: string } | null
}

export interface PublicListingsHome {
  featured?: PublicListing[]
  recommended?: PublicListing[]
  listings?: PublicListing[]
  recent?: PublicListing[]
  latest?: PublicListing[]
  data?: PublicListing[] | PaginatedResponse<PublicListing>
  [key: string]: unknown
}

export interface ListingInquiry {
  uuid: string
  title: string
  slug: string
  seeker_name: string
  seeker_email?: string | null
  seeker_phone?: string | null
  message?: string | null
  move_in_date?: string | null
  budget?: number | null
  status: string
  created_at?: string | null
}

export function isTrustedListing(listing: PublicListing): boolean {
  return listing.trust?.is_trusted === true
}

export function isVerifiedOrTrustedListing(listing: PublicListing): boolean {
  return listing.trust?.is_verified === true || listing.trust?.is_trusted === true
}

export const listingsApi = {
  publicList: (params?: Omit<ListingFilters, 'status'>) => {
    const cleanParams = {
      ...params,
      house_type: params?.house_type || undefined,
      verified_only: params?.verified_only || undefined,
      trusted_only: params?.trusted_only || undefined,
    }
    return apiGet<PaginatedResponse<PublicListing>>('/listings', cleanParams as Record<string, unknown>)
  },

  publicHome: () =>
    apiGet<PublicListingsHome>('/listings/home'),

  geocodeProperty: (params: { name?: string; address?: string; city: string; country?: string }) =>
    apiGet<{ latitude: number; longitude: number; display_name: string; map_embed_url: string; maps_url: string }>(
      '/admin/properties/geocode',
      params as Record<string, unknown>
    ),

  publicShow: (slugOrUuid: string) =>
    apiGet<PublicListing>(`/listings/${slugOrUuid}`),

  list: (params?: ListingFilters) => {
    const cleanParams = params?.house_type ? params : { ...params, house_type: undefined }
    return apiGet<PaginatedResponse<PublicListing>>('/admin/listings', cleanParams as Record<string, unknown>)
  },

  publish: (propertyId: number | string, data: { title?: string; description?: string; address_display?: string }) =>
    apiPost(`/admin/listings/publish/${propertyId}`, data),

  unpublish: (uuid: string) =>
    apiPatch(`/admin/listings/${uuid}/unpublish`),

  sync: (uuid: string) =>
    apiPatch<{ available_units: number; is_available: boolean }>(`/admin/listings/${uuid}/sync`),

  feature: (uuid: string, data: { featured: boolean; featured_until?: string; boost_score?: number }) =>
    apiPatch(`/admin/listings/${uuid}/feature`, data),

  inquiries: (params?: { status?: string; page?: number; per_page?: number }) =>
    apiGet<PaginatedResponse<ListingInquiry>>('/admin/listings/inquiries', params as Record<string, unknown>),

  managerList: (params?: ListingFilters) => {
    const cleanParams = params?.house_type ? params : { ...params, house_type: undefined }
    return apiGet<PaginatedResponse<PublicListing>>('/manager/listings', cleanParams as Record<string, unknown>)
  },

  managerPublish: (propertyId: number | string, data: { title?: string; description?: string; address_display?: string }) =>
    apiPost(`/manager/listings/publish/${propertyId}`, data),

  managerUnpublish: (uuid: string) =>
    apiPatch(`/manager/listings/${uuid}/unpublish`),

  managerSync: (uuid: string) =>
    apiPatch<{ available_units: number; is_available: boolean }>(`/manager/listings/${uuid}/sync`),

  managerFeature: (uuid: string, data: { featured: boolean; featured_until?: string; boost_score?: number }) =>
    apiPatch(`/manager/listings/${uuid}/feature`, data),

  managerInquiries: (params?: { status?: string; page?: number; per_page?: number }) =>
    apiGet<PaginatedResponse<ListingInquiry>>('/manager/listings/inquiries', params as Record<string, unknown>),
}
