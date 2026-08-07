import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, CheckCheck, X } from 'lucide-react'
import { apiGet, apiPatch, apiPost } from '@/api/client'
import { useRealtime } from '@/providers/realtimeContext'
import { useAuthStore } from '@/store/auth.store'

interface Notification {
  id: number | string
  type: string
  category: string
  title: string
  body?: string | null
  read_at: string | null
  created_at: string
}

type CategoryCounts = Record<string, number>

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  payment:      { label: 'Payments',      icon: '💰' },
  announcement: { label: 'Announcements', icon: '📢' },
  approval:     { label: 'Approvals',     icon: '✅' },
  booking:      { label: 'Bookings',      icon: '📅' },
  rejection:    { label: 'Rejections',    icon: '❌' },
  new_user:     { label: 'New Users',     icon: '👤' },
  message:      { label: 'Messages',      icon: '💬' },
  general:      { label: 'General',       icon: '🔔' },
}

const CATEGORY_ORDER = ['payment', 'announcement', 'approval', 'booking', 'rejection', 'new_user', 'message', 'general']

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
  message:          { icon: '💬', bg: 'bg-cyan-100 dark:bg-cyan-950/40'      },
  system:           { icon: '⚙️', bg: 'bg-slate-100 dark:bg-slate-800'       },
}

function getIconCfg(type: string) {
  const key = Object.keys(TYPE_ICON).find(k => type.toLowerCase().includes(k))
  return key ? TYPE_ICON[key] : { icon: '🔔', bg: 'bg-slate-100 dark:bg-slate-800' }
}

// Where clicking a notification lands, by category — no standalone
// notifications page; the bell is just a shortcut into the feature itself.
function categoryRoute(category: string, role: string): string | null {
  switch (category) {
    case 'announcement':
      return `/${role}/announcements`
    case 'message':
      return role === 'superadmin' ? null : `/${role}/messages`
    case 'payment':
      if (role === 'admin')   return '/admin/invoices'
      if (role === 'manager') return '/manager/payments'
      if (role === 'tenant')  return '/tenant/payments'
      return null
    case 'booking':
      if (role === 'admin')   return '/admin/bookings'
      if (role === 'manager') return '/manager/bookings'
      return null
    default:
      return null
  }
}

export function NotificationPanel({ role }: { role: string }): React.ReactElement {
  const [open, setOpen]       = useState(false)
  const [items, setItems]     = useState<Notification[]>([])
  const [unread, setUnread]   = useState(0)
  const [byCategory, setByCategory] = useState<CategoryCounts>({})
  const [loading, setLoading] = useState(false)
  const [readyToken, setReadyToken] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()

  const { token, user } = useAuthStore()
  const { subscribePrivate } = useRealtime()
  const ready = readyToken === token
  const notificationsChannel = useMemo(() => (
    token && user?.id ? `notifications.${String(user.id)}` : null
  ), [token, user?.id])

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ data: Notification[]; unread_count: number; by_category?: CategoryCounts }>('/notifications?per_page=15')
      setItems(res.data?.data ?? [])
      setUnread(res.data?.unread_count ?? 0)
      if (res.data?.by_category) setByCategory(res.data.by_category)
    } catch { /* non-critical */ }
    finally { setLoading(false) }
  }, [])

  const markAllRead = async () => {
    try {
      await apiPost('/notifications/mark-all-read')
      setUnread(0)
      setByCategory({})
      setItems(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
    } catch { /* non-critical */ }
  }

  // Clicking a notification IS "visiting" it — mark it read and jump straight
  // into the feature it's about (its own list/thread page), rather than a
  // separate notifications page that doesn't exist.
  const openNotification = (n: Notification) => {
    setOpen(false)
    if (!n.read_at) {
      setItems(prev => prev.map(item => item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item))
      setUnread(prev => Math.max(0, prev - 1))
      setByCategory(prev => ({ ...prev, [n.category]: Math.max(0, (prev[n.category] ?? 0) - 1) }))
      void apiPatch(`/notifications/${n.id}/read`).catch(() => { /* non-critical */ })
    }
    const route = categoryRoute(n.category, role)
    if (route) navigate(route)
  }

  useEffect(() => {
    if (!token) return
    const timer = window.setTimeout(() => setReadyToken(token), 1_500)
    return () => window.clearTimeout(timer)
  }, [token])

  // Initial count load (one request on mount)
  useEffect(() => {
    if (!ready) return
    void (async () => {
      try {
        const res = await apiGet<{ unread_count: number; by_category?: CategoryCounts }>('/notifications/unread-count')
        setUnread(res.data?.unread_count ?? 0)
        if (res.data?.by_category) setByCategory(res.data.by_category)
      } catch { /* non-critical */ }
    })()
  }, [ready])

  // Echo WebSocket — stays subscribed regardless of open state, so the badge
  // count and category breakdown update the instant a notification fires,
  // not only while the dropdown happens to be open.
  useEffect(() => {
    if (!ready || !notificationsChannel) return

    return subscribePrivate<Notification>(notificationsChannel, '.new.notification', (data) => {
      setUnread(prev => prev + 1)
      setByCategory(prev => ({ ...prev, [data.category]: (prev[data.category] ?? 0) + 1 }))
      setItems(prev => [{ ...data, read_at: null }, ...prev])
    })
  }, [ready, notificationsChannel, subscribePrivate])

  // Fetch list when panel opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void fetchNotifications()
    })
    return () => { cancelled = true }
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

  const groupedItems = useMemo(() => {
    const groups: Record<string, Notification[]> = {}
    for (const n of items) {
      const cat = n.category && CATEGORY_META[n.category] ? n.category : 'general'
      ;(groups[cat] ??= []).push(n)
    }
    return CATEGORY_ORDER
      .map(cat => ({ cat, notifications: groups[cat] ?? [] }))
      .filter(g => g.notifications.length > 0)
  }, [items])

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
          'relative rounded-lg p-2 text-foreground/65 transition-colors hover:bg-muted hover:text-foreground',
          open ? 'bg-muted text-foreground' : '',
        ].join(' ')}
      >
        <Bell className="h-[1.125rem] w-[1.125rem]" />
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
            {loading && items.length === 0 ? (
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
              groupedItems.map(({ cat, notifications }) => {
                const meta = CATEGORY_META[cat]
                const unreadInGroup = byCategory[cat] ?? notifications.filter(n => !n.read_at).length
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-1.5 border-b border-border bg-muted/30 px-4 py-1.5">
                      <span className="text-xs">{meta.icon}</span>
                      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                      {unreadInGroup > 0 && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.62rem] font-semibold text-primary">
                          {unreadInGroup}
                        </span>
                      )}
                    </div>
                    {notifications.map(n => {
                      const cfg = getIconCfg(n.type)
                      const isUnread = !n.read_at
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => openNotification(n)}
                          className={[
                            'flex w-full gap-3 border-b border-border px-4 py-3.5 text-left last:border-0 transition-colors hover:bg-muted/40',
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
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
