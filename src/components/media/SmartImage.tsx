import React from 'react'
import type { MediaLike, OptimizedUrls } from '@/services/media/cdnService'
import { buildResponsiveImage, sanitizeAltText, type ImageUsage } from '@/services/media/imageOptimizer'
import { ProgressiveImage } from './ProgressiveImage'

export interface SmartImageProps {
  src?: string | OptimizedUrls | MediaLike | null
  alt?: string | null
  sizes?: string
  priority?: boolean
  placeholder?: string | null
  fallback?: string
  aspectRatio?: string
  quality?: number
  objectFit?: React.CSSProperties['objectFit']
  loading?: React.ImgHTMLAttributes<HTMLImageElement>['loading']
  className?: string
  wrapperClassName?: string
  usage?: ImageUsage
  dominantColor?: string | null
}

export const SmartImage = React.memo(function SmartImage({
  src,
  alt,
  sizes = '(max-width: 768px) 92vw, (max-width: 1280px) 50vw, 33vw',
  priority = false,
  placeholder,
  fallback,
  aspectRatio = '4 / 3',
  quality = 82,
  objectFit = 'cover',
  loading,
  className = '',
  wrapperClassName = '',
  usage = 'card',
  dominantColor,
}: SmartImageProps): React.ReactElement {
  const isOptimized = typeof src === 'object' && src !== null
  const image = isOptimized
    ? buildResponsiveImage(src, usage, quality, fallback)
    : buildResponsiveImage(null, usage, quality, src ?? fallback)

  return (
    <ProgressiveImage
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      alt={sanitizeAltText(alt, 'StayLynk image')}
      priority={priority}
      placeholder={placeholder}
      dominantColor={dominantColor}
      fallback={fallback}
      aspectRatio={aspectRatio}
      loading={loading}
      wrapperClassName={wrapperClassName}
      className={className}
      style={{ objectFit }}
    />
  )
})
