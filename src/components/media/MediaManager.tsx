import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ImageOff, Star, Trash2, UploadCloud } from 'lucide-react'
import { mediaService, type MediaItem, type MediaType } from '@/services/media'
import { pickImageUrl } from '@/services/media'
import { SmartImage } from './SmartImage'

interface MediaManagerProps {
  items?: MediaItem[]
  mediaType: MediaType
  emptyLabel?: string
  onChange?: (items: MediaItem[]) => void
  onRefresh?: () => void
  className?: string
}

export function MediaManager({
  items = [],
  mediaType,
  emptyLabel = 'No images uploaded yet.',
  onChange,
  onRefresh,
  className = '',
}: MediaManagerProps): React.ReactElement {
  const [localItems, setLocalItems] = useState<MediaItem[]>(items)
  const [busyUuid, setBusyUuid] = useState<string | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const [replaceUuid, setReplaceUuid] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setLocalItems(items), 0)
    return () => window.clearTimeout(timer)
  }, [items])

  const sortedItems = useMemo(
    () => [...localItems].sort((a, b) => Number(Boolean(b.is_cover)) - Number(Boolean(a.is_cover)) || Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)),
    [localItems],
  )

  const updateItems = (nextItems: MediaItem[]) => {
    setLocalItems(nextItems)
    onChange?.(nextItems)
  }

  const deleteImage = async (uuid: string) => {
    setBusyUuid(uuid)
    try {
      await mediaService.delete(uuid)
      updateItems(localItems.filter((item) => item.uuid !== uuid))
      onRefresh?.()
    } finally {
      setBusyUuid(null)
    }
  }

  const setCover = async (uuid: string) => {
    setBusyUuid(uuid)
    try {
      await mediaService.setCover(uuid)
      updateItems(localItems.map((item) => ({ ...item, is_cover: item.uuid === uuid })))
      onRefresh?.()
    } finally {
      setBusyUuid(null)
    }
  }

  const replaceImage = async (file: File | undefined) => {
    if (!file || !replaceUuid) return
    setBusyUuid(replaceUuid)
    try {
      const response = await mediaService.replace(replaceUuid, file, mediaType)
      const nextMedia = response.data
      updateItems(localItems.map((item) => item.uuid === replaceUuid ? { ...item, ...nextMedia, status: nextMedia.status ?? 'processing' } : item))
      onRefresh?.()
    } finally {
      setBusyUuid(null)
      setReplaceUuid(null)
      if (replaceInputRef.current) replaceInputRef.current.value = ''
    }
  }

  if (sortedItems.length === 0) {
    return (
      <div className={`rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center ${className}`}>
        <ImageOff className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${className}`}>
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="sr-only"
        onChange={(event) => void replaceImage(event.target.files?.[0])}
      />
      {sortedItems.map((item) => {
        const busy = busyUuid === item.uuid
        const processing = item.status === 'pending' || item.status === 'processing'
        const ready = item.status === 'ready' || (!item.status && !!item.optimized_urls)

        return (
          <div key={item.uuid} className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="relative">
              {processing && !busy ? (
                <div
                  className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-xs font-medium text-muted-foreground"
                >
                  Processing image...
                </div>
              ) : (
                <SmartImage
                  src={item}
                  alt={item.alt_text || 'Property image'}
                  usage="gallery"
                  aspectRatio="4 / 3"
                  sizes="180px"
                  placeholder={ready ? pickImageUrl(item, undefined, 'thumbnail') : undefined}
                  className="object-cover"
                />
              )}
              {item.is_cover && (
                <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Cover
                </span>
              )}
              {busy && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-xs font-medium text-foreground">
                  Updating...
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 p-2">
              <button
                type="button"
                disabled={busy || item.is_cover}
                onClick={() => void setCover(item.uuid)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 disabled:opacity-40"
              >
                <Star className="h-3 w-3" /> Cover
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setReplaceUuid(item.uuid); replaceInputRef.current?.click() }}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-40"
              >
                <UploadCloud className="h-3 w-3" /> Replace
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteImage(item.uuid)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
