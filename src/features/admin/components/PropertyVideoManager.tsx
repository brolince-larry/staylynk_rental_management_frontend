import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Eye, Gauge, GripVertical, Save, Star, Trash2, UploadCloud, Video, X, XCircle } from 'lucide-react'
import { Button } from '@/components/forms'
import {
  deletePropertyVideo,
  getPropertyVideos,
  reorderPropertyVideos,
  updatePropertyVideo,
  uploadPropertyVideos,
  type PropertyVideo,
  type PropertyVideoRouteScope,
  type PropertyVideoStatus,
} from '@/api/propertyVideos'
import { useAuthStore } from '@/store/auth.store'
import { propertyVideoMaxUploadKb, resolvePublicMediaUrl } from '@/config/env'
import { getErrorMessage, isApiError, isForbidden, isPayloadTooLarge, isTooManyRequests, isUnprocessable } from '@/utils/errors'

const MAX_VIDEO_BYTES = propertyVideoMaxUploadKb * 1024
const MAX_VIDEOS = 5
const VIDEO_PROCESSING_REFETCH_MS = 15000
const ALLOWED_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm']
const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
]

interface PropertyVideoManagerProps {
  propertyId: string
  scope?: PropertyVideoRouteScope
  title?: string
}

interface PendingVideo {
  id: string
  file: File
  previewUrl: string
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'failed'
  error?: string
}

export function PropertyVideoManager({ propertyId, scope = 'admin', title = 'Property Videos' }: PropertyVideoManagerProps): React.ReactElement {
  const qc = useQueryClient()
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
  const queryKey = useMemo(() => [scope, 'properties', orgId, propertyId, 'videos'], [scope, orgId, propertyId])
  const [pending, setPending] = useState<PendingVideo[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [manualOrder, setManualOrder] = useState<PropertyVideo[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [isUploadActive, setIsUploadActive] = useState(false)
  const [feedStartId, setFeedStartId] = useState<string | null>(null)
  const pendingRef = useRef<PendingVideo[]>([])

  const videosQuery = useQuery({
    queryKey,
    queryFn: () => getPropertyVideos(propertyId, scope),
    enabled: !!propertyId,
    retry: false,
    refetchInterval: (query) => {
      if (isTooManyRequests(query.state.error)) return false
      const videos = query.state.data?.data ?? []
      return videos.some((video) => video.status === 'queued' || video.status === 'processing') ? VIDEO_PROCESSING_REFETCH_MS : false
    },
  })

  const videos = useMemo(() => videosQuery.data?.data ?? [], [videosQuery.data?.data])
  const sortedVideos = useMemo(() => [...videos].sort((a, b) => a.sort_order - b.sort_order), [videos])
  const order = manualOrder ?? sortedVideos
  const meta = videosQuery.data?.meta ?? { total: videos.length, max: MAX_VIDEOS, remaining: Math.max(0, MAX_VIDEOS - videos.length) }
  const remainingSlots = Math.max(0, meta.remaining - pending.filter((item) => item.status !== 'failed').length)

  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  useEffect(() => () => {
    pendingRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
  }, [])

  const updateMutation = useMutation({
    mutationFn: ({ videoId, is_featured }: { videoId: string; is_featured: boolean }) =>
      updatePropertyVideo(propertyId, videoId, { is_featured }, scope),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err) => setMessage(getVideoErrorMessage(err)),
  })

  const reorderMutation = useMutation({
    mutationFn: () => reorderPropertyVideos(
      propertyId,
      order.map((video, index) => ({ id: video.id, sort_order: index })),
      scope
    ),
    onSuccess: () => {
      setMessage('Video order saved.')
      setManualOrder(null)
      void qc.invalidateQueries({ queryKey })
    },
    onError: (err) => setMessage(getVideoErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (videoId: string) => deletePropertyVideo(propertyId, videoId, scope),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err) => setMessage(getVideoErrorMessage(err)),
  })

  const selectFiles = (files: FileList | File[]) => {
    setMessage(null)
    const selected = Array.from(files)
    const validation = validateVideoFiles(selected, remainingSlots)
    if (validation) {
      setMessage(validation)
      return
    }

    const next = selected.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: 'pending' as const,
    }))
    setPending((current) => [...current, ...next])
    void uploadPendingVideos(next)
  }

  const uploadPendingVideos = async (items: PendingVideo[]) => {
    setIsUploadActive(true)
    for (const item of items) {
      setPendingStatus(item.id, { status: 'uploading', progress: 1, error: undefined })
      try {
        await uploadPropertyVideos(propertyId, [item.file], (progress) => {
          setPendingStatus(item.id, { progress })
        }, scope)
        setPendingStatus(item.id, { status: 'done', progress: 100 })
      } catch (err) {
        const uploadError = getVideoErrorMessage(err)
        setPendingStatus(item.id, { status: 'failed', error: uploadError })
        setMessage(uploadError)
      }
    }
    setIsUploadActive(false)
    void qc.invalidateQueries({ queryKey })
  }

  const setPendingStatus = (id: string, patch: Partial<PendingVideo>) => {
    setPending((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const removePending = (id: string) => {
    setPending((current) => {
      const target = current.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((item) => item.id !== id)
    })
  }

  const retryPendingVideo = (item: PendingVideo) => {
    setMessage(null)
    void uploadPendingVideos([item])
  }

  const moveVideo = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    setManualOrder((current) => {
      const activeOrder = current ?? sortedVideos
      const sourceIndex = activeOrder.findIndex((video) => video.id === sourceId)
      const targetIndex = activeOrder.findIndex((video) => video.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return activeOrder

      const next = [...activeOrder]
      const [source] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, source)
      return next
    })
  }

  const feedVideos = useMemo(() => order.filter((video) => video.status === 'ready' && video.video_url), [order])
  const hasUnsavedOrder = order.some((video, index) => sortedVideos[index]?.id !== video.id)
  const disabledUpload = remainingSlots <= 0 || isUploadActive
  const uploadLabel = remainingSlots <= 0 ? 'Video limit reached' : isUploadActive ? 'Uploading videos...' : 'Drop videos here or browse'

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {meta.total} uploaded · max {meta.max} · {Math.max(0, meta.remaining)} slots remaining
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={feedVideos.length === 0}
            onClick={() => setFeedStartId(feedVideos[0]?.id ?? null)}
          >
            <Eye className="h-3.5 w-3.5" /> View Feed
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasUnsavedOrder || reorderMutation.isPending}
            loading={reorderMutation.isPending}
            onClick={() => reorderMutation.mutate()}
          >
            <Save className="h-3.5 w-3.5" /> Save Order
          </Button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {message}
        </div>
      ) : null}

      {videosQuery.isError && isForbidden(videosQuery.error) ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          This plan or role does not currently allow property video management.
        </div>
      ) : (
        <>
          <label
            className={[
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-5 text-center transition-colors',
              disabledUpload ? 'cursor-not-allowed border-border bg-muted/30 opacity-60' : 'border-primary/40 bg-primary/5 hover:bg-primary/10',
            ].join(' ')}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = disabledUpload ? 'none' : 'copy'
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (!disabledUpload) selectFiles(event.dataTransfer.files)
            }}
          >
            <UploadCloud className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium text-foreground">{uploadLabel}</span>
            <span className="text-xs text-muted-foreground">MP4, MOV, AVI, MKV, or WEBM. Up to {formatFileSize(MAX_VIDEO_BYTES)} each.</span>
            <input
              type="file"
              multiple
              accept=".mp4,.mov,.avi,.mkv,.webm,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm"
              className="sr-only"
              disabled={disabledUpload}
              onChange={(event) => {
                if (event.target.files) selectFiles(event.target.files)
                event.currentTarget.value = ''
              }}
            />
          </label>

          {pending.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {pending.map((item) => (
                <div key={item.id} className="grid grid-cols-[88px_1fr_auto] gap-3 rounded-lg border border-border p-3">
                  <video src={item.previewUrl} controls className="h-16 w-24 rounded-md bg-black object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{item.file.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatFileSize(item.file.size)}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${item.progress}%` }} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{getPendingVideoStatusLabel(item)}</span>
                      {item.status === 'failed' ? (
                        <button
                          type="button"
                          onClick={() => void retryPendingVideo(item)}
                          className="font-semibold text-primary hover:underline"
                        >
                          Retry
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePending(item.id)}
                    className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${item.file.name}`}
                  >
                    <XCircle className="mx-auto h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-3">
            {videosQuery.isLoading ? (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Loading videos...</div>
            ) : order.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No property videos uploaded yet.</div>
            ) : (
              order.map((video) => (
                <VideoRow
                  key={video.id}
                  video={video}
                  dragging={draggingId === video.id}
                  deleting={deleteMutation.isPending}
                  featuring={updateMutation.isPending}
                  onDragStart={() => setDraggingId(video.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onDrop={() => {
                    if (draggingId) moveVideo(draggingId, video.id)
                    setDraggingId(null)
                  }}
                  onFeature={() => updateMutation.mutate({ videoId: video.id, is_featured: !video.is_featured })}
                  onView={() => setFeedStartId(video.status === 'ready' && video.video_url ? video.id : feedVideos[0]?.id ?? null)}
                  onDelete={() => {
                    if (window.confirm('Delete this property video?')) deleteMutation.mutate(video.id)
                  }}
                />
              ))
            )}
          </div>
        </>
      )}
      {feedStartId ? (
        <AdminVideoFeed
          key={feedStartId}
          videos={feedVideos}
          startId={feedStartId}
          onClose={() => setFeedStartId(null)}
        />
      ) : null}
    </section>
  )
}

function VideoRow({
  video,
  dragging,
  deleting,
  featuring,
  onDragStart,
  onDragEnd,
  onDrop,
  onFeature,
  onView,
  onDelete,
}: {
  video: PropertyVideo
  dragging: boolean
  deleting: boolean
  featuring: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDrop: () => void
  onFeature: () => void
  onView: () => void
  onDelete: () => void
}): React.ReactElement {
  const isReady = video.status === 'ready' && Boolean(video.video_url)
  const videoUrl = resolvePublicMediaUrl(video.video_url)
  const thumbnailUrl = resolvePublicMediaUrl(video.thumbnail_url)
  const canFeature = video.status === 'ready'

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={[
        'grid gap-3 rounded-lg border border-border bg-background p-3 transition-shadow sm:grid-cols-[24px_120px_1fr_auto]',
        dragging ? 'opacity-60 ring-2 ring-primary/30' : 'hover:shadow-sm',
      ].join(' ')}
    >
      <div className="hidden cursor-grab items-center justify-center text-muted-foreground sm:flex">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="relative overflow-hidden rounded-md bg-black">
        {isReady ? (
          <video src={videoUrl} poster={thumbnailUrl} controls className="aspect-video w-full object-cover" />
        ) : thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
        ) : (
          video.status === 'failed' ? (
            <div className="flex aspect-video w-full items-center justify-center text-muted-foreground">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
          ) : (
            <ProcessingVideoPreview />
          )
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={video.status} />
          {video.is_featured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Star className="h-3 w-3 fill-current" /> Featured
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <span>Duration: {formatDuration(video.duration)}</span>
          <span>Size: {formatFileSize(video.size)}</span>
          <span>Order: {video.sort_order}</span>
        </div>
        {video.uploader?.name ? (
          <p className="text-xs text-muted-foreground">Uploaded by {video.uploader.name}</p>
        ) : null}
        {video.status === 'failed' && video.error_message ? (
          <p className="text-xs text-destructive">{video.error_message}</p>
        ) : video.status === 'queued' || video.status === 'processing' ? (
          <p className="text-xs text-muted-foreground">Video is {video.status === 'queued' ? 'queued' : 'processing'} and will be available when ready.</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
        <Button type="button" variant="outline" size="sm" disabled={!isReady} onClick={onView}>
          <Eye className="h-3.5 w-3.5" /> View
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!canFeature || featuring} onClick={onFeature}>
          <Star className={`h-3.5 w-3.5 ${video.is_featured ? 'fill-current' : ''}`} /> {video.is_featured ? 'Unfeature' : 'Feature'}
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={deleting} onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </article>
  )
}

function ProcessingVideoPreview(): React.ReactElement {
  const [meterPercent, setMeterPercent] = useState(0)

  useEffect(() => {
    const startedAt = window.performance.now()
    const duration = 4800
    const timer = window.setInterval(() => {
      const elapsed = (window.performance.now() - startedAt) % duration
      setMeterPercent(Math.min(100, Math.round((elapsed / (duration * 0.72)) * 100)))
    }, 80)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 px-3 py-2 text-center">
      <div className="relative flex h-8 w-12 items-center justify-center overflow-hidden rounded border border-white/15 bg-white/10 shadow-inner animate-video-compress motion-reduce:animate-none">
        <Video className="h-4 w-4 text-white/80" />
        <span className="absolute inset-x-1 bottom-1 h-0.5 rounded-full bg-white/25" />
      </div>
      <p className="mt-1.5 text-[10px] font-medium leading-none text-white/85">Compressing your video</p>
      <div className="mt-2 w-20">
        <div className="relative mx-auto h-16 w-16 rounded-full bg-white/10">
          <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_-90deg,#ef4444_0deg,#f59e0b_130deg,#22c55e_255deg,#16a34a_360deg)] opacity-25" />
          <div className="absolute inset-0 rounded-full animate-video-meter-sweep motion-reduce:animate-none" />
          <div className="absolute inset-2 rounded-full bg-zinc-950" />
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white">
            {meterPercent}%
          </div>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 animate-video-meter-fill motion-reduce:animate-none" />
        </div>
        <div className="mt-0.5 flex justify-between text-[9px] leading-none text-white/55">
          <span>0</span>
          <span>100</span>
        </div>
      </div>
    </div>
  )
}

function AdminVideoFeed({
  videos,
  startId,
  onClose,
}: {
  videos: PropertyVideo[]
  startId: string
  onClose: () => void
}): React.ReactElement | null {
  const startIndex = Math.max(0, videos.findIndex((video) => video.id === startId))
  const [activeIndex, setActiveIndex] = useState(startIndex)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Array<HTMLElement | null>>([])
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const didScrollToStart = useRef(false)
  const [awaitingSoundPlay, setAwaitingSoundPlay] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    if (didScrollToStart.current) return
    const target = sectionRefs.current[startIndex]
    if (!target) return
    didScrollToStart.current = true
    target.scrollIntoView({ block: 'start' })
  }, [startIndex])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    const observer = new IntersectionObserver((entries) => {
      const activeEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      const nextIndex = Number((activeEntry?.target as HTMLElement | undefined)?.dataset.index)
      if (Number.isInteger(nextIndex)) setActiveIndex(nextIndex)
    }, { root, threshold: [0.65, 0.8, 0.95] })

    sectionRefs.current.forEach((section) => {
      if (section) observer.observe(section)
    })

    return () => observer.disconnect()
  }, [videos.length])

  useEffect(() => {
    videoRefs.current.forEach((node, index) => {
      if (!node) return
      if (index !== activeIndex) {
        node.pause()
        node.currentTime = 0
        return
      }

      node.muted = false
      node.volume = 1
      node.load()
      void node.play()
        .then(() => {
          setAwaitingSoundPlay((current) => ({ ...current, [videos[index]?.id ?? index]: false }))
        })
        .catch(() => {
          setAwaitingSoundPlay((current) => ({ ...current, [videos[index]?.id ?? index]: true }))
        })
    })
  }, [activeIndex, videos])

  const playWithSound = (index: number) => {
    const node = videoRefs.current[index]
    const video = videos[index]
    if (!node || !video) return

    node.muted = false
    node.volume = 1
    void node.play()
      .then(() => {
        setAwaitingSoundPlay((current) => ({ ...current, [video.id]: false }))
      })
      .catch(() => undefined)
  }

  useEffect(() => () => {
    videoRefs.current.forEach((node) => {
      node?.pause()
    })
  }, [])

  if (videos.length === 0) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white">
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Admin Video Feed</p>
          <p className="text-xs text-white/70">{videos.length} ready video{videos.length === 1 ? '' : 's'}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
          aria-label="Close video feed"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="h-full snap-y snap-mandatory overflow-y-auto"
        ref={containerRef}
      >
        {videos.map((video, index) => {
          const isActive = index === activeIndex
          const shouldLoad = isActive || index === activeIndex + 1
          const needsSoundTap = isActive && awaitingSoundPlay[video.id] === true
          const videoUrl = resolvePublicMediaUrl(video.video_url)
          const thumbnailUrl = resolvePublicMediaUrl(video.thumbnail_url)

          return (
          <section
            key={video.id}
            data-index={index}
            ref={(node) => { sectionRefs.current[index] = node }}
            className="relative flex h-screen snap-start items-center justify-center px-3 py-16"
          >
            <div className="relative h-full max-h-[780px] w-full max-w-[430px] overflow-hidden rounded-lg bg-zinc-950 shadow-2xl ring-1 ring-white/10">
              <video
                ref={(node) => { videoRefs.current[index] = node }}
                src={shouldLoad ? videoUrl : undefined}
                poster={thumbnailUrl}
                controls={isActive}
                autoPlay={isActive}
                playsInline
                loop
                preload={isActive ? 'auto' : shouldLoad ? 'metadata' : 'none'}
                className="h-full w-full bg-black object-contain"
              />
              {needsSoundTap ? (
                <button
                  type="button"
                  onClick={() => playWithSound(index)}
                  className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 shadow-2xl transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/80"
                >
                  Play with sound
                </button>
              ) : null}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusPill status={video.status} />
                      {video.is_featured ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-white">
                          <Star className="h-3 w-3 fill-current" /> Featured
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold">Video #{video.sort_order + 1}</p>
                    <p className="mt-1 text-xs text-white/70">
                      {formatDuration(video.duration)} · {formatFileSize(video.size)}
                      {video.uploader?.name ? ` · ${video.uploader.name}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-white/60">{index + 1}/{videos.length}</p>
                </div>
              </div>
            </div>
          </section>
          )
        })}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: PropertyVideoStatus }): React.ReactElement {
  const styles: Record<PropertyVideoStatus, string> = {
    queued: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
    processing: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    failed: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  }
  const icons: Record<PropertyVideoStatus, React.ReactElement> = {
    queued: <Gauge className="h-3 w-3" />,
    processing: <Gauge className="h-3 w-3 animate-pulse" />,
    ready: <CheckCircle2 className="h-3 w-3" />,
    failed: <AlertCircle className="h-3 w-3" />,
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {icons[status]} {status}
    </span>
  )
}

function validateVideoFiles(files: File[], remainingSlots: number): string | null {
  if (files.length === 0) return 'Select at least one video.'
  if (files.length > remainingSlots) return `You can upload ${remainingSlots} more video${remainingSlots === 1 ? '' : 's'}.`

  const oversized = files.find((file) => file.size > MAX_VIDEO_BYTES)
  if (oversized) return `${oversized.name} is larger than the ${formatFileSize(MAX_VIDEO_BYTES)} upload limit.`

  const invalid = files.find((file) => {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    return !ALLOWED_EXTENSIONS.includes(extension) && !ALLOWED_MIME_TYPES.includes(file.type)
  })
  if (invalid) return `${invalid.name} is not a supported video format.`

  return null
}

function getVideoErrorMessage(err: unknown): string {
  if (isForbidden(err)) return 'You do not have permission to manage videos for this property.'
  if (isPayloadTooLarge(err)) return `This video is larger than the ${formatFileSize(MAX_VIDEO_BYTES)} upload limit.`
  if (isUnprocessable(err) && isApiError(err)) {
    if (Array.isArray(err.errors)) return err.errors.join(' ')
    const messages = Object.values(err.errors).flat()
    return messages.length > 0 ? messages.join(' ') : err.message
  }
  return getErrorMessage(err)
}

function getPendingVideoStatusLabel(item: PendingVideo): string {
  if (item.status === 'failed') return item.error ?? 'Upload failed.'
  if (item.status === 'pending') return 'Waiting to upload.'
  if (item.status === 'uploading') return `Uploading ${item.progress}%`
  return 'Upload complete. Processing video for playback.'
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}
