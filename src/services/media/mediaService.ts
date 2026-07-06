import { apiClient, apiDelete, apiGet, apiPatch, apiPost } from '@/api/client'
import type { ApiResponse } from '@/types'
import type { OptimizedUrls } from './cdnService'

export type MediaType =
  | 'property_image'
  | 'room_image'
  | 'organization_logo'
  | 'organization_cover'
  | 'profile_photo'
  | 'tenant_profile_photo'
  | 'public_listing_image'
  | 'maintenance_evidence'
  | 'verification_document'
  | 'ownership_document'
  | 'lease_agreement'
  | 'payment_receipt'
  | 'private_document'

export interface MediaItem {
  uuid: string
  media_type: MediaType
  status?: 'pending' | 'processing' | 'ready' | 'failed' | string
  alt_text?: string | null
  dominant_color?: string | null
  blur_hash?: string | null
  is_cover?: boolean
  sort_order?: number
  optimized_urls?: OptimizedUrls
}

export const MAX_BULK_IMAGES = 25
export const MAX_SINGLE_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_BULK_TOTAL_BYTES = 8 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const

export interface MediaUploadProgress {
  file: string
  progress: number
}

export interface UploadMediaInput {
  file: File
  media_type: MediaType
  entity_type: MediaEntityType
  entity_id: number | string
  is_public?: boolean
  is_cover?: boolean
  alt_text?: string
  sort_order?: number
}

export interface BulkUploadMediaInput extends Omit<UploadMediaInput, 'file' | 'is_cover'> {
  files: File[]
  cover_index?: number
}

export type MediaEntityType =
  | 'property'
  | 'room'
  | 'profile'
  | 'user'
  | 'tenant'
  | 'organization'
  | 'maintenance'

export const MEDIA_SIZE_LIMITS = {
  galleryImage: MAX_SINGLE_IMAGE_BYTES,
  profileImage: MAX_SINGLE_IMAGE_BYTES,
  document: 10 * 1024 * 1024,
  bulkMaxFiles: MAX_BULK_IMAGES,
  bulkTotal: MAX_BULK_TOTAL_BYTES,
}

function isDocumentMedia(mediaType: MediaType): boolean {
  return mediaType.includes('document') || mediaType.includes('agreement') || mediaType.includes('receipt')
}

export function validateMediaFiles(files: File[], mediaType: MediaType): string | null {
  if (files.length === 0) return 'Select at least one file.'

  if (!isDocumentMedia(mediaType) && files.length > 1) {
    return validateBulkImages(files)
  }

  if (!isDocumentMedia(mediaType)) return validateSingleImage(files[0])

  return files.some((file) => file.size > MEDIA_SIZE_LIMITS.document)
    ? `Each selected file must be ${Math.round(MEDIA_SIZE_LIMITS.document / 1024 / 1024)}MB or smaller.`
    : null
}

export function validateBulkImages(files: File[]): string | null {
  if (files.length > MAX_BULK_IMAGES) {
    return 'You can upload a maximum of 25 images.'
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

  if (totalSize > MAX_BULK_TOTAL_BYTES) {
    return 'Bulk upload cannot exceed 8MB combined.'
  }

  const oversized = files.find((file) => file.size > MAX_SINGLE_IMAGE_BYTES)

  if (oversized) {
    return 'Each image must be 5MB or less.'
  }

  const invalid = files.find((file) => !ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number]))

  if (invalid) {
    return 'Only JPG, PNG, WEBP, or HEIC images are allowed.'
  }

  return null
}

export function validateSingleImage(file: File): string | null {
  if (file.size > MAX_SINGLE_IMAGE_BYTES) {
    return 'Image must be 5MB or less.'
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return 'Only JPG, PNG, WEBP, or HEIC images are allowed.'
  }

  return null
}

export function entityIdFromResponse(data: unknown): number | null {
  const record = data as Record<string, unknown> | undefined
  const nested = record?.data as Record<string, unknown> | undefined
  const id = Number(record?.id ?? nested?.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

function appendBaseFields(form: FormData, input: Omit<UploadMediaInput, 'file'>): void {
  form.append('media_type', input.media_type)
  if (input.media_type === 'property_image') return
  form.append('entity_type', input.entity_type)
  form.append('entity_id', String(input.entity_id))
  form.append('is_public', input.is_public ? '1' : '0')
  if (input.alt_text) form.append('alt_text', input.alt_text)
  if (input.sort_order !== undefined) form.append('sort_order', String(input.sort_order))
}

export const mediaService = {
  upload: async (input: UploadMediaInput, onProgress?: (progress: number) => void) => {
    const validation = validateMediaFiles([input.file], input.media_type)
    if (validation) throw new Error(validation)

    const form = new FormData()
    form.append('file', input.file)
    appendBaseFields(form, input)
    if (input.is_cover && input.media_type !== 'property_image') form.append('is_cover', '1')

    const res = await apiClient.post<ApiResponse<MediaItem>>('/media/upload', form, {
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100))
      },
    })
    return res.data
  },

  bulkUpload: async (input: BulkUploadMediaInput, onProgress?: (progress: number) => void) => {
    const validation = validateMediaFiles(input.files, input.media_type)
    if (validation) throw new Error(validation)

    const form = new FormData()
    input.files.forEach((file) => form.append('files[]', file))
    appendBaseFields(form, input)
    if (input.cover_index !== undefined && input.media_type !== 'property_image') form.append('cover_index', String(input.cover_index))

    const res = await apiClient.post<ApiResponse<{ data?: MediaItem[]; items?: MediaItem[] }>>('/media/bulk-upload', form, {
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100))
      },
    })
    return res.data
  },

  privateUrl: (uuid: string, reason?: string) =>
    apiGet<{ url: string }>(`/media/private/${uuid}/url`, reason ? { reason } : undefined),

  reorder: (entityType: string, entityId: number | string, items: Array<{ uuid: string; sort_order: number }>) =>
    apiPatch('/media/reorder', { entity_type: entityType, entity_id: entityId, items }),

  setCover: (uuid: string) =>
    apiPost('/media/set-cover', { uuid }),

  replace: async (uuid: string, file: File, mediaType: MediaType = 'property_image', onProgress?: (progress: number) => void, altText?: string) => {
    const validation = validateMediaFiles([file], mediaType)
    if (validation) throw new Error(validation)

    const form = new FormData()
    form.append('file', file)
    if (altText) form.append('alt_text', altText)

    const res = await apiClient.post<ApiResponse<MediaItem>>(`/media/${uuid}/replace`, form, {
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100))
      },
    })
    return res.data
  },

  delete: (uuid: string) =>
    apiDelete(`/media/${uuid}`),

  uploadFilesForEntity: async (
    input: {
      files: File[]
      media_type: MediaType
      entity_type: MediaEntityType
      entity_id: number | string
      is_public?: boolean
      cover_index?: number
      alt_text?: string
      sort_order?: number
    },
    onProgress?: (progress: MediaUploadProgress) => void,
  ) => {
    if (input.files.length === 0) return null

    if (input.files.length === 1) {
      return mediaService.upload({
        file: input.files[0],
        media_type: input.media_type,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        is_public: input.is_public,
        is_cover: input.cover_index === 0,
        alt_text: input.alt_text,
        sort_order: input.sort_order,
      }, (progress) => onProgress?.({ file: input.files[0].name, progress }))
    }

    return mediaService.bulkUpload({
      files: input.files,
      media_type: input.media_type,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      is_public: input.is_public,
      cover_index: input.cover_index,
      alt_text: input.alt_text,
      sort_order: input.sort_order,
    }, (progress) => onProgress?.({ file: 'Gallery upload', progress }))
  },
}
