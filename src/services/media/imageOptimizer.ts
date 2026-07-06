import { appendCdnParams, pickImageUrl, srcSetFromUrls, type MediaLike, type OptimizedUrls } from './cdnService'

export type ImageUsage = 'card' | 'gallery' | 'detail' | 'fullscreen'

export function imageTargetForUsage(usage: ImageUsage): keyof OptimizedUrls {
  if (usage === 'card') return 'small'
  if (usage === 'gallery') return 'medium'
  if (usage === 'detail') return 'large'
  return 'fullscreen'
}

export function buildResponsiveImage(
  urls?: OptimizedUrls | MediaLike | string | null,
  usage: ImageUsage = 'card',
  quality = 82,
  fallback?: string,
) {
  const target = imageTargetForUsage(usage)
  const src = appendCdnParams(pickImageUrl(urls, fallback, target), quality)
  return {
    src,
    srcSet: srcSetFromUrls(urls),
  }
}

export function sanitizeAltText(value?: string | null, fallback = 'StayLynk image'): string {
  const text = String(value ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
  return text.slice(0, 160) || fallback
}
