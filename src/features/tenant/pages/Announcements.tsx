import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Megaphone, Pin, Globe, Users, ChevronRight, Bell } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { useAuthStore } from '@/store/auth.store'
import { useTenantAnnouncements, useMarkAnnouncementRead, type Announcement } from '@/features/admin/layout/hooks/useAnnouncements'
import { formatDatetime } from '@/utils/format'

const STORAGE_KEY = (orgId: string) => `ann_read_${orgId}`

function getReadIds(orgId: string): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(orgId))
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
  } catch {
    return new Set()
  }
}

function markRead(orgId: string, ids: number[]): void {
  const current = getReadIds(orgId)
  ids.forEach((id) => current.add(id))
  try {
    localStorage.setItem(STORAGE_KEY(orgId), JSON.stringify([...current]))
  } catch { /* storage full — ignore */ }
}

const CATEGORY_COLORS: Record<string, string> = {
  urgent:      'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400',
  maintenance: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400',
  event:       'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/20 dark:text-blue-400',
  general:     'border-border bg-muted/40 text-muted-foreground',
}

function AnnouncementCard({ item, isUnread, onRead }: {
  item: Announcement
  isUnread: boolean
  onRead: (item: Announcement) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Mark as read when scrolled into view
  useEffect(() => {
    if (!isUnread) return
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { onRead(item); obs.disconnect() }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [isUnread, item, onRead])

  return (
    <div
      ref={ref}
      className={`relative rounded-xl border p-4 transition-all ${
        isUnread
          ? 'border-violet-200 bg-violet-50/40 dark:border-violet-800/40 dark:bg-violet-950/20'
          : 'border-border bg-card'
      }`}
    >
      {isUnread && (
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-white dark:ring-card" />
      )}
      {item.is_pinned && (
        <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-amber-600">
          <Pin className="h-3 w-3" /> Pinned
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{item.content}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.category && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.general}`}>
            {item.category}
          </span>
        )}
        {item.property && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
            <Globe className="h-2.5 w-2.5" />{item.property.name}
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {item.published_at ? formatDatetime(item.published_at) : ''}
        </span>
      </div>
    </div>
  )
}

export default function TenantAnnouncementsPage(): React.ReactElement {
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? '')

  // Cursor pagination
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [cursorIdx, setCursorIdx]     = useState(0)
  const currentCursor = cursorStack[cursorIdx]

  const { data, isLoading } = useTenantAnnouncements({
    per_page: 20,
    ...(currentCursor ? { cursor: currentCursor } : {}),
  })

  const rows = useMemo(() => data?.data ?? [], [data])
  const meta = data?.meta

  // Unread tracking
  const [readIds, setReadIds] = useState<Set<number>>(() => getReadIds(orgId))
  const { mutate: markAnnouncementRead } = useMarkAnnouncementRead()

  const handleRead = useCallback((item: Announcement) => {
    setReadIds((prev) => {
      if (prev.has(item.id)) return prev
      const next = new Set(prev)
      next.add(item.id)
      markRead(orgId, [item.id])
      return next
    })
    // Also clear the bell-notification entry server-side — the sidebar/
    // localStorage tracking above is a separate, client-only mechanism.
    markAnnouncementRead(item.uuid)
  }, [orgId, markAnnouncementRead])

  // Count unread in current page
  const unreadCount = useMemo(
    () => rows.filter((r) => !readIds.has(r.id)).length,
    [rows, readIds],
  )

  const pinnedRows = useMemo(() => rows.filter((r) => r.is_pinned), [rows])
  const normalRows = useMemo(() => rows.filter((r) => !r.is_pinned), [rows])

  const goNext = () => {
    if (!meta?.next_cursor) return
    const next = [...cursorStack.slice(0, cursorIdx + 1), meta.next_cursor]
    setCursorStack(next)
    setCursorIdx(next.length - 1)
  }

  const goPrev = () => {
    if (cursorIdx === 0) return
    setCursorIdx((i) => i - 1)
  }

  return (
    <>
      <Helmet><title>Announcements — StayLynk</title></Helmet>

      <div className="p-6">
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              Announcements
              {unreadCount > 0 && (
                <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </span>
          }
          subtitle="Stay up to date with notices from your property manager."
        />

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Megaphone className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No announcements yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Your property manager hasn't posted anything yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pinnedRows.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pinned</p>
                {pinnedRows.map((item) => (
                  <AnnouncementCard
                    key={item.id}
                    item={item}
                    isUnread={!readIds.has(item.id)}
                    onRead={handleRead}
                  />
                ))}
                {normalRows.length > 0 && (
                  <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Latest</p>
                )}
              </>
            )}
            {normalRows.map((item) => (
              <AnnouncementCard
                key={item.id}
                item={item}
                isUnread={!readIds.has(item.id)}
                onRead={handleRead}
              />
            ))}
          </div>
        )}

        {(cursorIdx > 0 || meta?.has_more) && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={goPrev}
              disabled={cursorIdx === 0}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={goNext}
              disabled={!meta?.has_more}
              className="flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              Load more <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
