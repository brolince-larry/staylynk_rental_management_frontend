import React from 'react'
import { safeImageUrl } from '@/services/media/cdnService'
import { sanitizeAltText } from '@/services/media/imageOptimizer'

export interface ResponsiveImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src: string
  alt?: string | null
  fallback?: string
}

export const ResponsiveImage = React.memo(function ResponsiveImage({
  src,
  alt,
  fallback,
  className = '',
  loading = 'lazy',
  decoding = 'async',
  onError,
  ...props
}: ResponsiveImageProps): React.ReactElement {
  const [currentSrc, setCurrentSrc] = React.useState(() => safeImageUrl(src, fallback))

  React.useEffect(() => {
    setCurrentSrc(safeImageUrl(src, fallback))
  }, [fallback, src])

  return (
    <img
      {...props}
      src={currentSrc}
      alt={sanitizeAltText(alt, 'StayLynk image')}
      loading={loading}
      decoding={decoding}
      referrerPolicy="no-referrer"
      className={className}
      onError={(event) => {
        if (fallback && currentSrc !== fallback) setCurrentSrc(fallback)
        onError?.(event)
      }}
    />
  )
})
