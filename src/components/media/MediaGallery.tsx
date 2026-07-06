import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { MediaItem } from '@/services/media/mediaService'
import { pickImageUrl } from '@/services/media/cdnService'
import { usePrefetchImages } from '@/hooks/media/usePrefetchImages'
import { SmartImage } from './SmartImage'

interface MediaGalleryProps {
  items: MediaItem[]
  title?: string
  className?: string
}

export function MediaGallery({ items, title = 'Property gallery', className = '' }: MediaGalleryProps): React.ReactElement {
  const [index, setIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const parentRef = useRef<HTMLDivElement | null>(null)
  const touchStartX = useRef<number | null>(null)
  const safeItems = useMemo(() => items.filter((item) => item.optimized_urls), [items])
  const active = safeItems[index]
  const count = safeItems.length

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    horizontal: true,
    overscan: 3,
  })

  const goTo = useCallback((nextIndex: number) => {
    if (count === 0) return
    setIndex(Math.min(count - 1, Math.max(0, nextIndex)))
  }, [count])

  const next = useCallback(() => goTo(index + 1), [goTo, index])
  const previous = useCallback(() => goTo(index - 1), [goTo, index])

  usePrefetchImages([
    pickImageUrl(safeItems[index + 1]?.optimized_urls, 'large'),
    pickImageUrl(safeItems[index + 2]?.optimized_urls, 'large'),
  ], count > 1)

  useEffect(() => {
    if (!fullscreen) return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
      if (event.key === 'ArrowRight') next()
      if (event.key === 'ArrowLeft') previous()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen, next, previous])

  if (count === 0) {
    return (
      <div className={`flex aspect-[4/3] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground ${className}`}>
        No images available
      </div>
    )
  }

  return (
    <section aria-label={title} className={className}>
      <div
        className="relative overflow-hidden rounded-lg bg-muted"
        onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }}
        onTouchEnd={(event) => {
          const start = touchStartX.current
          const end = event.changedTouches[0]?.clientX
          if (start === null || end === undefined) return
          if (start - end > 45) next()
          if (end - start > 45) previous()
          touchStartX.current = null
        }}
      >
        <SmartImage
          src={active.optimized_urls}
          alt={active.alt_text || title}
          placeholder={pickImageUrl(active.optimized_urls, 'thumbnail')}
          dominantColor={active.dominant_color}
          usage="detail"
          aspectRatio="16 / 10"
          className="object-cover"
          priority
        />

        <div className="absolute inset-x-3 top-3 flex justify-end">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="rounded-md bg-background/90 p-2 text-foreground shadow-sm"
            aria-label="Open gallery fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {count > 1 && (
          <>
            <button type="button" onClick={previous} disabled={index === 0} className="absolute left-3 top-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-sm disabled:opacity-40" aria-label="Previous image">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={next} disabled={index === count - 1} className="absolute right-3 top-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-sm disabled:opacity-40" aria-label="Next image">
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <div ref={parentRef} className="mt-3 h-24 overflow-x-auto">
        <div className="relative h-full" style={{ width: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const item = safeItems[virtualItem.index]

            return (
              <button
                key={item.uuid}
                type="button"
                onClick={() => goTo(virtualItem.index)}
                className={`absolute top-0 h-20 w-20 overflow-hidden rounded-md border ${virtualItem.index === index ? 'border-primary' : 'border-border'}`}
                style={{ transform: `translateX(${virtualItem.start}px)` }}
                aria-label={`View image ${virtualItem.index + 1}`}
              >
                <SmartImage src={item.optimized_urls} alt={item.alt_text || title} usage="card" aspectRatio="1 / 1" sizes="80px" className="object-cover" />
              </button>
            )
          })}
        </div>
      </div>

      {fullscreen && active && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
        >
          <button type="button" onClick={() => setFullscreen(false)} className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-white" aria-label="Close gallery">
            <X className="h-5 w-5" />
          </button>
          <SmartImage src={active.optimized_urls} alt={active.alt_text || title} usage="fullscreen" aspectRatio="16 / 9" sizes="100vw" className="max-h-[88vh] object-contain" priority />
        </motion.div>
      )}
    </section>
  )
}
