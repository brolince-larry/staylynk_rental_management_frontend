import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Brain, Check, X, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { knowledgeApi, type KBQuestion } from '@/api/knowledge'
import { useAuthStore } from '@/store/auth.store'
import { useRealtime } from '@/providers/realtimeContext'

const CATEGORY_COLORS: Record<string, string> = {
  financial:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  safety:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  amenities:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  legal:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  utilities:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
}

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat.toLowerCase()] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
}

export function KnowledgeWidget(): React.ReactElement | null {
  const { token, user } = useAuthStore()
  const orgId = user?.org?.id
  const { subscribePrivate } = useRealtime()
  const [open, setOpen] = useState(false)
  const [readyToken, setReadyToken] = useState<string | null>(null)
  const ready = readyToken === token
  const [badge, setBadge] = useState(0)
  const [items, setItems] = useState<KBQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const ref = useRef<HTMLDivElement>(null)
  const kbReviewChannel = useMemo(() => (
    token && orgId ? `ai.kb-review.${String(orgId)}` : null
  ), [token, orgId])

  useEffect(() => {
    if (!token) return
    const timer = window.setTimeout(() => setReadyToken(token), 1_500)
    return () => window.clearTimeout(timer)
  }, [token])

  // Load stats badge
  useEffect(() => {
    if (!ready || !token) return
    knowledgeApi.stats()
      .then((r) => setBadge((r.data?.pending ?? 0) + (r.data?.ai_generated ?? 0)))
      .catch(() => {})
  }, [ready, token])

  // Load questions when dropdown opens
  useEffect(() => {
    if (!open || !token) return
    knowledgeApi.list({ per_page: 5 })
      .then((r) => {
        const list = r.data?.data ?? []
        setItems(list)
        setAnswers(
          Object.fromEntries(list.map((q) => [q.uuid, q.ai_suggested_answer ?? '']))
        )
      })
      .catch(() => {})
  }, [open, token])

  // Reverb real-time push
  useEffect(() => {
    if (!ready || !open || !kbReviewChannel) return
    return subscribePrivate<KBQuestion>(kbReviewChannel, '.ai.question.unanswered', (data) => {
      setBadge((b) => b + 1)
      setItems((prev) => [data, ...prev].slice(0, 5))
      setAnswers((prev) => ({ [data.uuid]: data.ai_suggested_answer ?? '', ...prev }))
    })
  }, [ready, open, kbReviewChannel, subscribePrivate])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const removeItem = (uuid: string) => {
    setItems((prev) => prev.filter((q) => q.uuid !== uuid))
    setBadge((b) => Math.max(0, b - 1))
  }

  const handleApprove = async (uuid: string) => {
    const answer = (answers[uuid] ?? '').trim()
    if (!answer) return
    setProcessing((p) => ({ ...p, [uuid]: true }))
    try {
      await knowledgeApi.approve(uuid, answer)
      removeItem(uuid)
    } catch { /* ignore */ } finally {
      setProcessing((p) => ({ ...p, [uuid]: false }))
    }
  }

  const handleDismiss = async (uuid: string) => {
    setProcessing((p) => ({ ...p, [uuid]: true }))
    try {
      await knowledgeApi.dismiss(uuid)
      removeItem(uuid)
    } catch { /* ignore */ } finally {
      setProcessing((p) => ({ ...p, [uuid]: false }))
    }
  }

  if (!token) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="AI Knowledge Base"
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Brain className="h-4 w-4" />
        {badge > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[0.6rem] font-bold text-white ring-2 ring-card">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-semibold text-foreground">AI Knowledge Review</span>
              {badge > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {badge} pending
                </span>
              )}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[480px] overflow-y-auto divide-y divide-border">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No pending questions
              </div>
            ) : (
              items.map((q) => (
                <div key={q.uuid} className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground line-clamp-2">{q.question}</p>
                    <span className="shrink-0 text-[0.65rem] text-muted-foreground">×{q.asked_count}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold capitalize ${categoryColor(q.category)}`}>
                      {q.category}
                    </span>
                    {q.ai_suggested_answer && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[0.65rem] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                        AI drafted
                      </span>
                    )}
                  </div>
                  <textarea
                    value={answers[q.uuid] ?? ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.uuid]: e.target.value }))}
                    rows={2}
                    placeholder={q.ai_suggested_answer ? 'AI Suggested Answer (edit to refine)' : 'Type your answer…'}
                    className="w-full resize-none rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 dark:focus:ring-violet-400/20"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={!answers[q.uuid]?.trim() || processing[q.uuid]}
                      onClick={() => void handleApprove(q.uuid)}
                      className="flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={processing[q.uuid]}
                      onClick={() => void handleDismiss(q.uuid)}
                      className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border px-4 py-2.5">
            <Link
              to="/admin/ai-knowledge"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between text-xs font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400"
            >
              See all questions
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
