import React from 'react'

interface ImageSkeletonProps {
  aspectRatio?: string
  className?: string
}

export function ImageSkeleton({ aspectRatio = '4 / 3', className = '' }: ImageSkeletonProps): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-muted ${className}`}
      style={{ aspectRatio }}
    >
      <div className="absolute inset-0 -translate-x-full animate-[media-shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/35 to-transparent motion-reduce:animate-none" />
    </div>
  )
}
