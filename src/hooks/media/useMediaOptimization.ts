import { useMemo } from 'react'
import type { OptimizedUrls } from '@/services/media/cdnService'
import { buildResponsiveImage, sanitizeAltText, type ImageUsage } from '@/services/media/imageOptimizer'

interface UseMediaOptimizationOptions {
  urls?: OptimizedUrls | null
  src?: string | null
  alt?: string | null
  fallbackAlt?: string
  usage?: ImageUsage
  quality?: number
}

export function useMediaOptimization({
  urls,
  src,
  alt,
  fallbackAlt,
  usage = 'card',
  quality,
}: UseMediaOptimizationOptions) {
  return useMemo(() => {
    const optimized = urls
      ? buildResponsiveImage(urls, usage, quality)
      : { src: src ?? '', srcSet: undefined }

    return {
      src: optimized.src,
      srcSet: optimized.srcSet,
      alt: sanitizeAltText(alt, fallbackAlt),
    }
  }, [alt, fallbackAlt, quality, src, urls, usage])
}
