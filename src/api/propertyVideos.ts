import { apiClient } from './client'

export type PropertyVideoStatus =
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed'

export interface PropertyVideo {
  id: string
  property_id: number
  video_url: string | null
  thumbnail_url: string | null
  duration: number
  size: number
  sort_order: number
  is_featured: boolean
  status: PropertyVideoStatus
  error_message: string | null
  processed_at: string | null
  created_at: string | null
  uploader?: {
    id: number
    name: string
  } | null
}

export interface PropertyVideoListResponse {
  success: boolean
  message: string
  data: {
    data: PropertyVideo[]
    meta: {
      total: number
      max: number
      remaining: number
    }
  }
}

export interface PropertyVideoResponse {
  success: boolean
  message: string
  data: PropertyVideo
}

export type PropertyVideoUpdatePayload = Partial<Pick<PropertyVideo, 'sort_order' | 'is_featured'>>
export type PropertyVideoOrderPayload = Array<{ id: string; sort_order: number }>
export type PropertyVideoRouteScope = 'admin' | 'manager'

function propertyVideoPath(scope: PropertyVideoRouteScope, propertyId: string, suffix = '') {
  return `/${scope}/properties/${propertyId}/videos${suffix}`
}

export async function getPropertyVideos(propertyId: string, scope: PropertyVideoRouteScope = 'admin') {
  const { data } = await apiClient.get<PropertyVideoListResponse>(
    propertyVideoPath(scope, propertyId)
  )

  return data.data
}

export async function getPropertyVideo(
  propertyId: string,
  videoId: string,
  scope: PropertyVideoRouteScope = 'admin'
) {
  const { data } = await apiClient.get<PropertyVideoResponse>(
    propertyVideoPath(scope, propertyId, `/${videoId}`)
  )

  return data.data
}

export async function uploadPropertyVideos(
  propertyId: string,
  files: File[],
  onProgress?: (percent: number) => void,
  scope: PropertyVideoRouteScope = 'admin'
) {
  const formData = new FormData()
  files.forEach((file) => formData.append('videos[]', file))

  const { data } = await apiClient.post(
    propertyVideoPath(scope, propertyId),
    formData,
    {
      onUploadProgress: (event) => {
        if (!event.total) return
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      },
    }
  )

  return data
}

export async function updatePropertyVideo(
  propertyId: string,
  videoId: string,
  payload: PropertyVideoUpdatePayload,
  scope: PropertyVideoRouteScope = 'admin'
) {
  const { data } = await apiClient.patch(
    propertyVideoPath(scope, propertyId, `/${videoId}`),
    payload
  )

  return data
}

export async function reorderPropertyVideos(
  propertyId: string,
  videos: PropertyVideoOrderPayload,
  scope: PropertyVideoRouteScope = 'admin'
) {
  const { data } = await apiClient.patch(
    propertyVideoPath(scope, propertyId, '/reorder'),
    { videos }
  )

  return data
}

export async function deletePropertyVideo(
  propertyId: string,
  videoId: string,
  scope: PropertyVideoRouteScope = 'admin'
) {
  const { data } = await apiClient.delete(
    propertyVideoPath(scope, propertyId, `/${videoId}`)
  )

  return data
}
