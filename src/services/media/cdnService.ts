import fallbackImage from '@/assets/hero.png'

const FALLBACK_IMAGE = fallbackImage

export interface OptimizedUrls {
  thumbnail?: string | null
  small?: string | null
  medium?: string | null
  large?: string | null
  fullscreen?: string | null
  original?: string | null
  [key: string]: string | null | undefined
}

export interface MediaLike {
  optimized_urls?: OptimizedUrls | null
  placeholder?: { dominant_color?: string | null } | null
  dominant_color?: string | null
}

export type ImageSize = keyof OptimizedUrls

export function isSafePublicImageUrl(url?: string | null): url is string {
  if (!url) return false
  if (url.startsWith('/')) return true

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function isLegacyImageUrl(url?: string | null): url is string {
  if (!url) return false
  if (url.startsWith('/')) return true

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function safeImageUrl(url?: string | null, fallback = FALLBACK_IMAGE): string {
  return isSafePublicImageUrl(url) ? url : fallback
}

export function getOptimizedUrls(media?: MediaLike | OptimizedUrls | string | null): OptimizedUrls | null {
  if (!media || typeof media === 'string') return null
  if ('optimized_urls' in media) {
    const urls = media.optimized_urls
    return urls && typeof urls === 'object' ? urls : null
  }
  return media as OptimizedUrls
}

export function pickImageUrl(
  media?: MediaLike | OptimizedUrls | string | null,
  fallbackOrSize?: string,
  size: ImageSize = 'medium',
): string {
  const legacySizeCall = fallbackOrSize && ['thumbnail', 'small', 'medium', 'large', 'fullscreen', 'original'].includes(fallbackOrSize)
  const fallback = legacySizeCall ? undefined : fallbackOrSize
  const target = (legacySizeCall ? fallbackOrSize : size) as ImageSize
  const urls = getOptimizedUrls(media)

  if (!urls) {
    if (typeof media === 'string' && isLegacyImageUrl(media)) return media
    return isLegacyImageUrl(fallback) ? fallback : FALLBACK_IMAGE
  }

  const preferred = urls[target]
  const optimized = safeImageUrl(
    preferred ||
    urls.small ||
    urls.thumbnail ||
    urls.medium ||
    urls.large ||
    urls.fullscreen ||
    urls.original
  )

  if (optimized !== FALLBACK_IMAGE) return optimized
  return isLegacyImageUrl(fallback) ? fallback : FALLBACK_IMAGE
}

export function srcSetFromUrls(media?: MediaLike | OptimizedUrls | string | null): string | undefined {
  const urls = getOptimizedUrls(media)
  if (!urls) return undefined

  const entries = [
    [urls.thumbnail, '300w'],
    [urls.small, '600w'],
    [urls.medium, '1200w'],
    [urls.large, '1920w'],
  ].filter(([url]) => isSafePublicImageUrl(url as string | null))

  return entries.length
    ? entries.map(([url, width]) => `${url} ${width}`).join(', ')
    : undefined
}

export function appendCdnParams(url: string, quality?: number, format = 'webp'): string {
  if (!isSafePublicImageUrl(url)) return isLegacyImageUrl(url) ? url : safeImageUrl(url)
  if (url.startsWith('/')) return url

  const parsed = new URL(url)
  if (quality) parsed.searchParams.set('q', String(Math.min(100, Math.max(1, quality))))
  if (format) parsed.searchParams.set('fm', format)
  return parsed.toString()
}
