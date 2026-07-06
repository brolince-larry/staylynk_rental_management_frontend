const DEFAULT_PROPERTY_VIDEO_MAX_UPLOAD_KB = 102400
const DEFAULT_API_BASE_URL = 'http://127.0.0.1'
const API_VERSION_PREFIX = '/api/v1'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function readNumber(value: unknown): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeApiBaseUrl(value: string): string {
  const trimmed = trimTrailingSlash(value)
  if (trimmed.endsWith(API_VERSION_PREFIX)) return trimmed
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`

  try {
    const parsed = new URL(trimmed)
    if (parsed.pathname === '' || parsed.pathname === '/') {
      parsed.pathname = API_VERSION_PREFIX
      return trimTrailingSlash(parsed.toString())
    }
  } catch {
    if (trimmed === '' || trimmed === '/') return API_VERSION_PREFIX
    if (!trimmed.startsWith('/')) return trimmed
  }

  return trimmed
}

export const apiBaseUrl = normalizeApiBaseUrl(
  readString(import.meta.env.VITE_API_BASE_URL) ?? DEFAULT_API_BASE_URL,
)

const configuredMediaCdnUrl = readString(import.meta.env.VITE_MEDIA_CDN_URL)
export const mediaCdnUrl = configuredMediaCdnUrl ? trimTrailingSlash(configuredMediaCdnUrl) : undefined

export const propertyVideoMaxUploadKb =
  readNumber(import.meta.env.VITE_PROPERTY_VIDEO_MAX_UPLOAD_KB) ??
  readNumber(import.meta.env.PROPERTY_VIDEO_MAX_UPLOAD_KB) ??
  DEFAULT_PROPERTY_VIDEO_MAX_UPLOAD_KB

export const reverbConfig = {
  host: readString(import.meta.env.VITE_REVERB_HOST) ?? (typeof window !== 'undefined' ? window.location.hostname : ''),
  port: readNumber(import.meta.env.VITE_REVERB_PORT) ?? (typeof window !== 'undefined' && window.location.protocol === 'https:' ? 443 : 80),
  scheme: readString(import.meta.env.VITE_REVERB_SCHEME) ?? (typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http'),
}

/** Base URL of the public house-hunter frontend (staylynk-public). */
export const publicSiteUrl = trimTrailingSlash(
  readString(import.meta.env.VITE_PUBLIC_SITE_URL) ?? '',
)

export function resolvePublicMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  if (!url.startsWith('/')) return url

  const base = mediaCdnUrl ?? apiBaseUrl
  return base ? `${base}${url}` : url
}
