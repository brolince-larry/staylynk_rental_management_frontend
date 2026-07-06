import React from 'react'
import { motion } from 'framer-motion'
import { useLazyImage } from '@/hooks/media/useLazyImage'
import { ResponsiveImage, type ResponsiveImageProps } from './ResponsiveImage'
import { BlurPlaceholder } from './BlurPlaceholder'
import { ImageSkeleton } from './ImageSkeleton'

export interface LazyImageProps extends ResponsiveImageProps {
  priority?: boolean
  placeholder?: string | null
  dominantColor?: string | null
  aspectRatio?: string
  showSkeleton?: boolean
  wrapperClassName?: string
}

export function LazyImage({
  src,
  srcSet,
  sizes,
  alt,
  priority = false,
  placeholder,
  dominantColor,
  aspectRatio = '4 / 3',
  showSkeleton = true,
  wrapperClassName = '',
  className = '',
  fallback,
  ...props
}: LazyImageProps): React.ReactElement {
  const { ref, shouldLoad, status, retry, canRetry } = useLazyImage<HTMLDivElement>({
    src,
    srcSet,
    priority,
  })
  const isLoaded = status === 'loaded'

  return (
    <div ref={ref} className={`relative overflow-hidden bg-muted ${wrapperClassName}`} style={{ aspectRatio }}>
      {!isLoaded && (
        placeholder || dominantColor
          ? <BlurPlaceholder placeholder={placeholder} dominantColor={dominantColor} aspectRatio={aspectRatio} />
          : showSkeleton
            ? <ImageSkeleton aspectRatio={aspectRatio} className="absolute inset-0" />
            : null
      )}

      {shouldLoad && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="absolute inset-0 motion-reduce:transition-none"
        >
          <ResponsiveImage
            {...props}
            src={src}
            srcSet={srcSet}
            sizes={sizes}
            alt={alt}
            fallback={fallback}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            className={`h-full w-full ${className}`}
          />
        </motion.div>
      )}

      {status === 'error' && canRetry && (
        <button
          type="button"
          onClick={retry}
          className="absolute bottom-2 right-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm"
        >
          Retry
        </button>
      )}
    </div>
  )
}
