import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellOff, CheckCheck, X } from 'lucide-react'
import { apiGet, apiPost } from '@/api/client'
import { getEcho } from '@/lib/echo'
import { useAuthStore } from '@/store/auth.store'

interface Notification {
  id: number | string
  type: string
  title: string
  body?: string | null
  read_at: string | null
  created_at: string
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const TYPE_ICON: Record<string, { icon: string; bg: string }> = {
  payment:          { icon: '💰', bg: 'bg-emerald-100 dark:bg-emerald-950/40' },
  booking:          { icon: '📅', bg: 'bg-violet-100 dark:bg-violet-950/40'  },
  lease:            { icon: '📃', bg: 'bg-blue-100 dark:bg-blue-950/40'      },
  invoice:          { icon: '🧾', bg: 'bg-indigo-100 dark:bg-indigo-950/40'  },
  alert:            { icon: '⚠️', bg: 'bg-amber-100 dark:bg-amber-950/40'    },
  maintenance:      { icon: '🔧', bg: 'bg-orange-100 dark:bg-orange-950/40'  },
  move_out_notice:  { icon: '🚪', bg: 'bg-rose-100 dark:bg-rose-950/40'      },
  system:           { icon: '⚙️', bg: 'bg-slate-100 dark:bg-slate-800'       },
}

function getIconCfg(type: string) {
  const key = Object.keys(TYPE_ICON).find(k => type.toLowerCase().includes(k))
  return key ? TYPE_ICON[key] : { icon: '🔔', bg: 'bg-slate-100 dark:bg-slate-800' }
}

export function NotificationPanel({ role }: { role: string }): React.ReactElement {
  const [open, setOpen]       = useState(false)
  const [items, setItems]     = useState<Notification[]>([])
  const [unread, setUnread]   = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)

  const { token, user } = useAuthStore()

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ data: Notification[]; unread_count: number }>('/notifications?per_page=15')
      setItems(res.data?.data ?? [])
      setUnread(res.data?.unread_count ?? 0)
    } catch { /* non-critical */ }
    finally { setLoading(false) }
  }, [])

  const markAllRead = async () => {
    try {
      await apiPost('/notifications/mark-all-read')
      setUnread(0)
      setItems(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
    } catch { /* non-critical */ }
  }

  // Initial count load (one request on mount)
  useEffect(() => {
    void (async () => {
      try {
        const res = await apiGet<{ unread_count: number }>('/notifications/unread-count')
        setUnread(res.data?.unread_count ?? 0)
      } catch { /* non-critical */ }
    })()
  }, [])

  // Echo WebSocket — push updates to unread count
  useEffect(() => {
    if (!token || !user?.id) return

    const userUuid = typeof user.id === 'string' ? user.id : String(user.id)
    const echo = getEcho(token)
    if (!echo) return

    const channel = echo.private(`notifications.${userUuid}`)
    channel.listen('.new.notification', (data: Notification) => {
      setUnread(prev => prev + 1)
      setItems(prev => [{ ...data, read_at: null }, ...prev])
    })

    return () => {
      echo.leave(`notifications.${userUuid}`)
    }
  }, [token, user?.id])

  // Fetch list when panel opens
  useEffect(() => {
    if (open) void fetchNotifications()
  }, [open, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ''}`}
        className={[
          'relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          open ? 'bg-muted text-foreground' : '',
        ].join(' ')}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-bold leading-none text-white ring-2 ring-card"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-black/10 dark:shadow-black/40"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              {unread > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.68rem] font-semibold text-primary">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {unread > 0 && (
                <button
                  onClick={() => void markAllRead()}
                  title="Mark all as read"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <>
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-3 border-b border-border px-4 py-3.5 last:border-0">
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-muted animate-pulse" />
                    <div className="flex-1 space-y-1.5 pt-0.5">
                      <div className="h-2.5 rounded-full bg-muted animate-pulse" />
                      <div className="h-2 w-3/4 rounded-full bg-muted animate-pulse" />
                    </div>
                  </div>
                ))}
              </>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <BellOff className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-semibold text-foreground">All caught up</p>
                <p className="mt-0.5 text-xs text-muted-foreground">No new notifications</p>
              </div>
            ) : (
              items.map(n => {
                const cfg = getIconCfg(n.type)
                const isUnread = !n.read_at
                return (
                  <div
                    key={n.id}
                    className={[
                      'flex gap-3 border-b border-border px-4 py-3.5 last:border-0 transition-colors hover:bg-muted/40',
                      isUnread ? 'bg-primary/[0.03]' : '',
                    ].join(' ')}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${cfg.bg}`}>
                      {cfg.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[0.8rem] leading-snug ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                          {n.title}
                        </p>
                        {isUnread && (
                          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-[0.72rem] text-muted-foreground">{n.body}</p>
                      )}
                      <p className="mt-1 text-[0.68rem] text-muted-foreground/60">{relTime(n.created_at)}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {!loading && items.length > 0 && (
            <div className="border-t border-border px-4 py-2.5">
              <a
                href={`/${role}/notifications`}
                onClick={() => setOpen(false)}
                className="block text-center text-xs font-medium text-primary transition-colors hover:text-primary/75"
              >
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
