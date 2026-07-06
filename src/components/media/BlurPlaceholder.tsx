import React from 'react'

interface BlurPlaceholderProps {
  placeholder?: string | null
  dominantColor?: string | null
  aspectRatio?: string
  className?: string
}

export function BlurPlaceholder({
  placeholder,
  dominantColor,
  aspectRatio = '4 / 3',
  className = '',
}: BlurPlaceholderProps): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{
        aspectRatio,
        backgroundColor: dominantColor || 'hsl(var(--muted))',
      }}
    >
      {placeholder ? (
        <img
          src={placeholder}
          alt=""
          className="h-full w-full scale-105 object-cover blur-xl"
          loading="eager"
          decoding="async"
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-muted motion-reduce:animate-none" />
      )}
    </div>
  )
}
