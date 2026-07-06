import React, { useEffect, useState, useCallback } from 'react'
import { Bell, X } from 'lucide-react'
import { remindersApi, type AIReminder } from '@/api/reminders'
import { useAuthStore } from '@/store/auth.store'
import { getEcho } from '@/lib/echo'

interface ReminderToastItem extends AIReminder {
  _dismissed?: boolean
}

export function AIReminderToast(): React.ReactElement | null {
  const { token, user } = useAuthStore()
  const userId = user?.id
  const [toasts, setToasts] = useState<ReminderToastItem[]>([])

  const addToast = useCallback((reminder: AIReminder) => {
    setToasts((prev) => {
      if (prev.some((t) => t.uuid === reminder.uuid)) return prev
      return [...prev, reminder]
    })
  }, [])

  // Poll for due reminders on mount
  useEffect(() => {
    if (!token) return
    remindersApi.list()
      .then((r) => {
        const due = (r.data ?? []).filter((rem) => rem.is_due)
        due.forEach(addToast)
      })
      .catch(() => {})
  }, [token, addToast])

  // Reverb push
  useEffect(() => {
    if (!token || !userId) return
    const echo = getEcho(token)
    if (!echo) return
    const channel = echo.private(`ai.reminders.${userId}`)
    channel.listen('.ai.reminder.due', (data: AIReminder) => {
      addToast(data)
    })
    return () => { channel.stopListening('.ai.reminder.due') }
  }, [token, userId, addToast])

  const dismiss = useCallback(async (uuid: string) => {
    setToasts((prev) => prev.filter((t) => t.uuid !== uuid))
    try { await remindersApi.dismiss(uuid) } catch { /* ignore */ }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.uuid}
          className="pointer-events-auto flex w-[360px] max-w-[90vw] items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xl"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
            <Bell className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">AI Reminder</p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{t.message}</p>
            {t.context_summary && (
              <p className="mt-1 text-[0.65rem] text-muted-foreground/70 line-clamp-1">{t.context_summary}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void dismiss(t.uuid)}
            aria-label="Dismiss reminder"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
