// src/components/ai/AIAssistant.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Home,
  Images,
  Loader2,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  MessageSquare,
  Navigation,
  Phone,
  Play,
  RotateCcw,
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  UsersRound,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { AgentChart as AgentChartRenderer } from '@/components/charts/AgentChart'
import { AIResponseCard } from './AIResponseCards'
import { useAIStore } from '@/store/ai.store'
import { aiApi, aiPaymentApi, sendAIMessage, getHunterSession, type AIVisual, type AIAction, type AIChatContext, type AIChatMeta, type AIMediaItem, type ActionIntent, type AITable } from '@/api/ai'
import { apiPost } from '@/api/client'
import { useAuthStore } from '@/store/auth.store'
import { getErrorMessage, isApiError } from '@/utils/errors'
import aiOrb from '@/assets/ai-orb.png'

interface Props {
  role: string
  variant?: 'orb' | 'page'
}

const DOMAIN_ASSISTANT_MESSAGE = 'I specialize in property and rental-related assistance.'

const ROLE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  superadmin: { label: 'Executive Advisor', bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300' },
  admin:      { label: 'Property Admin',    bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300' },
  manager:    { label: 'Caretaker Assist',  bg: 'bg-teal-100 dark:bg-teal-900/40',     text: 'text-teal-700 dark:text-teal-300' },
  tenant:     { label: 'Tenant Assist',     bg: 'bg-blue-100 dark:bg-blue-900/40',     text: 'text-blue-700 dark:text-blue-300' },
}

const QUICK_CHIPS: Record<string, string[]> = {
  superadmin: ['Platform Summary', 'Revenue This Month', 'Overdue Rent', 'Vacancy Rate', 'Top Properties', 'Audit Logs', 'Active Admins'],
  admin:      ['My Portfolio', "Who Hasn't Paid", 'Vacant Rooms', 'Maintenance', 'Pending Bookings', 'Monthly Income', 'Add Tenant'],
  manager:    ["Today's Tasks", 'Vacant Rooms', 'Open Maintenance', 'Tenant Messages', 'Mark Inspection Done'],
  tenant:     ['My Rent Balance', 'Pay Now', 'My Receipts', 'Report Issue', 'My Lease', 'Contact Manager'],
}

// ── Task progress helpers (module-level, stable) ──────────────────────────────

function detectActionCommand(msg: string): string | null {
  const m = msg.toLowerCase()
  if (/\b(create|add|make|build|setup)\b/.test(m) &&
      /\b(room|bedsitter|single\s+room|double\s+room|studio|apartment)\b/.test(m)) return 'room_create'
  if (/\b(set|mark|put)\s+rooms?\b/.test(m) ||
      /\brooms?\s+(to\s+)?(maintenance|available)\b/.test(m) ||
      /\b(update|change|increase|decrease|reduce|set|adjust)\s+rent\b/.test(m)) return 'room_update'
  if (/\b(announce|announcement|notify\s+(tenant|all|everyone)|send\s+notice|post\s+notice|broadcast|send\s+announcement)\b/.test(m)) return 'announcement'
  if (/\b(log|record|add)\s+(expense|bill|cost)\b/.test(m) ||
      /\b(expense|bill)\s+(of|kes|ksh)\b/.test(m) ||
      (/\b(log|record)\b/.test(m) && /\b(electricity|water|internet|repair|plumbing|security|cleaning|salary)\b/.test(m))) return 'expense'
  if (/\b(create|report|log|assign|resolve)\s+maintenance\b/.test(m) ||
      /\bmaintenance\s+(request|issue|problem|ticket)\b/.test(m) ||
      (/\b(assign|resolve)\b/.test(m) && /\bmaintenance\b/.test(m))) return 'maintenance'
  if ((/\b(publish|post|make public|go live|list)\b/.test(m) && /\b(property|listing|room|unit)\b/.test(m)) ||
      /\b(publish listing|post listing|publish property|post property|put online|put on public)\b/.test(m)) return 'publish_listing'
  return null
}

function getActionSteps(type: string): string[] {
  switch (type) {
    case 'room_create':  return ['Analyzing your request', 'Finding property', 'Generating room numbers', 'Creating rooms']
    case 'room_update':  return ['Finding rooms', 'Applying updates', 'Saving changes']
    case 'announcement': return ['Preparing announcement', 'Setting audience', 'Publishing notice']
    case 'expense':      return ['Parsing expense details', 'Finding property', 'Logging expense']
    case 'maintenance':      return ['Analyzing request', 'Locating room', 'Saving maintenance request']
    case 'publish_listing':  return ['Finding property', 'Preparing listing data', 'Publishing to house hunters board']
    default:                 return ['Analyzing your request', 'Processing', 'Finalizing']
  }
}

/** Builds an absolute URL to a public listing in staylynk-public. */
function publicListingUrl(slug: string): string {
  const base = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ?? ''
  return `${base}/listings/${slug}`
}

export default function AIAssistant({ role, variant = 'orb' }: Props): React.ReactElement {
  const isPage = variant === 'page'
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [temporaryMuteUntil, setTemporaryMuteUntil] = useState<number | null>(null)
  const [sessionSuspended, setSessionSuspended] = useState(false)
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null)
  // Rate limit state — set when AI returns 429
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)
  const [rateLimitTier, setRateLimitTier] = useState<string | null>(null)
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0)
  const rateLimitTimer = useRef<number | null>(null)
  const { messages, pushMessage, updateMessage, setLoading, loading, setSession, sessionToken, clearMessages } = useAIStore()
  const auth = useAuthStore()
  const navigate = useNavigate()
  const [lastInviteData, setLastInviteData] = useState<Record<string, unknown> | null>(null)
  // Phase 1: typing done; Phase 2: 3-second generation animation; Phase 3: charts visible
  const [chartsReadyFor, setChartsReadyFor] = useState<Set<string>>(() =>
    new Set(messages.filter((m) => m.visuals?.length).map((m) => m.id))
  )
  const [chartsGeneratingFor, setChartsGeneratingFor] = useState<Set<string>>(new Set())
  const chartTimers = useRef<Map<string, number>>(new Map())
  const [taskProgress, setTaskProgress] = useState<{ steps: string[]; completed: number } | null>(null)
  const taskStepTimer = useRef<number | null>(null)
  const markChartsReady = useCallback((id: string) => {
    setChartsReadyFor((prev) => new Set([...prev, id]))
    setChartsGeneratingFor((prev) => new Set([...prev, id]))
    const t = window.setTimeout(() => {
      setChartsGeneratingFor((prev) => { const n = new Set(prev); n.delete(id); return n })
      chartTimers.current.delete(id)
    }, 3100)
    chartTimers.current.set(id, t)
  }, [])
  const mounted = useRef(true)
  const greeted = useRef(false)
  const endRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const typingCleanup = useRef<(() => void) | null>(null)
  const muteTimer = useRef<number | null>(null)
  const timezone = useMemo(() => getUserTimezone(auth.user?.org?.timezone), [auth.user?.org?.timezone])

  useEffect(() => () => {
    mounted.current = false
    typingCleanup.current?.()
    if (muteTimer.current !== null) window.clearTimeout(muteTimer.current)
    if (taskStepTimer.current !== null) window.clearInterval(taskStepTimer.current)
    if (rateLimitTimer.current !== null) window.clearInterval(rateLimitTimer.current)
    chartTimers.current.forEach((t) => window.clearTimeout(t))
  }, [])

  // Countdown ticker when rate limited
  useEffect(() => {
    if (!rateLimitedUntil) return
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((rateLimitedUntil - Date.now()) / 1000))
      setRateLimitCountdown(remaining)
      if (remaining <= 0) {
        window.clearInterval(rateLimitTimer.current!)
        rateLimitTimer.current = null
        setRateLimitedUntil(null)
        setRateLimitTier(null)
      }
    }
    tick()
    rateLimitTimer.current = window.setInterval(tick, 1000)
    return () => {
      if (rateLimitTimer.current !== null) window.clearInterval(rateLimitTimer.current)
    }
  }, [rateLimitedUntil])

  useEffect(() => {
    if (!isPage && !open) return
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading, open, isPage])

  // Auto-resize textarea as user types
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const startSession = useCallback(async (): Promise<string | null> => {
    if (sessionToken) return sessionToken
    setError(null)
    try {
      if (role === 'public_hunter') {
        const token = await getHunterSession()
        if (token) { setSession(token); return token }
        setError('Unable to start AI session.')
        return null
      }
      const res = await aiApi.session({ role, timezone })
      if (res.success && res.data?.session_token) {
        setSession(res.data.session_token)
        return res.data.session_token
      } else {
        setError('Unable to start AI session.')
        return null
      }
    } catch {
      setError('Unable to connect to AI.')
      return null
    }
  }, [role, timezone, setSession, sessionToken])

  useEffect(() => {
    // auto-create session for authenticated users
    const timer = window.setTimeout(() => {
      void startSession()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // small internal id generator
  const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`

  const send = useCallback(async (overrideMessage?: string, opts?: { silent?: boolean }) => {
    const message = (overrideMessage ?? input).trim()
    if (!message || sessionSuspended || isTemporaryMuteActive(temporaryMuteUntil) || (rateLimitedUntil !== null && Date.now() < rateLimitedUntil)) return
    typingCleanup.current?.()
    typingCleanup.current = null
    const id = makeId()
    if (!opts?.silent) {
      pushMessage({ id, role: 'user', content: message, createdAt: new Date().toISOString() })
      setInput('')
    }
    setError(null)
    setLastFailedPrompt(null)
    setSubmitting(true)
    setLoading(true)
    const actionKind = detectActionCommand(message)
    if (actionKind) {
      const steps = getActionSteps(actionKind)
      setTaskProgress({ steps, completed: 0 })
      let stepIdx = 0
      taskStepTimer.current = window.setInterval(() => {
        stepIdx++
        if (stepIdx < steps.length - 1) {
          setTaskProgress(prev => prev ? { ...prev, completed: stepIdx } : null)
        } else {
          window.clearInterval(taskStepTimer.current!)
          taskStepTimer.current = null
        }
      }, 700)
    }
    try {
      let activeToken = sessionToken
      const endpoint = role === 'public_hunter' ? '/hunter/chat' : '/ai/chat'
      let res = await sendAIMessage({ sessionToken: activeToken, message, token: auth.token, timezone, endpoint })

      if (res.data?.session_expired) {
        setSession(null)
        activeToken = await (async () => {
          try {
            if (role === 'public_hunter') {
              const token = await getHunterSession()
              if (token) { setSession(token); return token }
              return null
            }
            const sr = await aiApi.session({ role, timezone })
            if (sr.success && sr.data?.session_token) {
              setSession(sr.data.session_token)
              return sr.data.session_token
            }
          } catch { /* fall through */ }
          return null
        })()
        res = await sendAIMessage({ sessionToken: activeToken, message, token: auth.token, timezone, endpoint })
      }

      if (res.success && res.data) {
        const mid = makeId()
        const meta = res.data.meta ?? {}
        const context = res.data.context
        applyModerationState(meta, setTemporaryMuteUntil, setSessionSuspended, muteTimer)
        const content = getDisplayMessage(res.data.message, context, meta)
        const presentation = meta.presentation
        const modelCircuitOpen = meta.safety?.model_circuit_open === true
        const shouldType = presentation?.typing !== false
        const shouldShowThinkingOrb = presentation?.thinking_orb === true && !modelCircuitOpen
        const typingSpeedMs = presentation?.typing_speed_ms ?? 24
        const media = res.data.media
        const actionIntent = res.data.action_intent
        const actionType = res.data.action_type ?? null
        const actionData = res.data.action_data ?? null
        const suggestions = normalizeSuggestions(res.data.suggestions)
        const visuals = res.data.visuals ?? []
        const responseType = res.data.response_type
        const cards = res.data.cards
        const tokenUsage = res.data.token_usage
        const listings = res.data.listings

        setLoading(shouldShowThinkingOrb)
        pushMessage({
          id: mid,
          role: 'assistant',
          content: shouldType ? '' : content,
          createdAt: new Date().toISOString(),
          meta,
          context: shouldType ? undefined : context,
          media,
          action_intent: actionIntent,
          action_type: actionType,
          action_data: actionData,
          suggestions,
          visuals,
          response_type: responseType,
          cards,
          listings,
          token_usage: tokenUsage,
        })
        if (actionType === 'room_invites' && actionData) setLastInviteData(actionData)
        if (res.data.session_token) setSession(res.data.session_token)

        if (shouldType) {
          typingCleanup.current = typeWords(
            content,
            typingSpeedMs,
            (partial) => updateMessage(mid, { content: partial }),
            () => {
              typingCleanup.current = null
              updateMessage(mid, { context })
              if (visuals.length) markChartsReady(mid)
              setLoading(false)
            },
          )
        } else {
          if (visuals.length) markChartsReady(mid)
          setLoading(false)
        }
      } else {
        const mid = makeId()
        const reply = res.message || 'Sorry, I could not process that request.'
        pushMessage({ id: mid, role: 'assistant', content: reply, createdAt: new Date().toISOString() })
        setError(reply)
        setLastFailedPrompt(message)
        setLoading(false)
      }
    } catch (err) {
      const mid = makeId()
      // Handle tiered rate limit (429) with countdown timer
      if (isApiError(err) && err.status === 429) {
        const body = err.data as Record<string, unknown> | null
        const retryAfterSecs = (body?.retry_after_seconds as number) ?? 3600
        const tier = (body?.tier as string) ?? 'unknown'
        const lockedUntil = Date.now() + retryAfterSecs * 1000
        setRateLimitedUntil(lockedUntil)
        setRateLimitTier(tier)
        const humanWait = retryAfterSecs >= 3600
          ? `${Math.ceil(retryAfterSecs / 3600)} hour${Math.ceil(retryAfterSecs / 3600) > 1 ? 's' : ''}`
          : retryAfterSecs >= 60
            ? `${Math.ceil(retryAfterSecs / 60)} minute${Math.ceil(retryAfterSecs / 60) > 1 ? 's' : ''}`
            : `${retryAfterSecs} seconds`
        const reply = body?.message as string || `AI rate limit reached. Please wait ${humanWait} before sending more requests.`
        pushMessage({ id: mid, role: 'assistant', content: reply, createdAt: new Date().toISOString() })
      } else {
        const reply = getAIErrorMessage(err)
        pushMessage({ id: mid, role: 'assistant', content: reply, createdAt: new Date().toISOString() })
        setError(reply)
        setLastFailedPrompt(message)
      }
      setLoading(false)
    } finally {
      if (taskStepTimer.current !== null) {
        window.clearInterval(taskStepTimer.current)
        taskStepTimer.current = null
      }
      setTaskProgress(null)
      if (mounted.current) setSubmitting(false)
    }
  }, [input, pushMessage, updateMessage, sessionToken, auth.token, timezone, setLoading, setSession, sessionSuspended, temporaryMuteUntil, markChartsReady])

  const handleSuggestion = useCallback((chip: string) => {
    switch (chip) {
      case 'Open invite PDF':
        if (!lastInviteData?.pdf_export_id) return
        void openInvitePdf(lastInviteData.pdf_export_id as string, auth.token)
        break
      case 'Share to WhatsApp group':
        if (!lastInviteData?.whatsapp_group_link) return
        window.open(lastInviteData.whatsapp_group_link as string, '_blank', 'noopener,noreferrer')
        break
      case 'Show invite analytics':
        navigate('/admin/invites')
        break
      default:
        void send(chip)
    }
  }, [lastInviteData, auth.token, navigate, send])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const assistantLabel = useMemo(() => 'StayLynk AI', [])

  const greetingName = useMemo(() => {
    if (auth.user?.name) return auth.user.name.split(' ')[0] ?? auth.user.name
    switch (role) {
      case 'superadmin': return 'Super Admin'
      case 'admin': return 'Admin'
      case 'manager': return 'Manager'
      case 'tenant': return 'Tenant'
      default: return 'there'
    }
  }, [auth.user, role])

  const quickPrompts = useMemo(() => {
    if (role === 'tenant') {
      return [
        { icon: Coins,     label: 'Show my payment history' },
        { icon: Home,      label: 'My lease info' },
        { icon: Building2, label: 'Submit a maintenance request' },
        { icon: Sparkles,  label: 'Ask anything...' },
      ]
    }

    if (role === 'manager') {
      return [
        { icon: BarChart3,  label: 'Occupancy overview' },
        { icon: Home,       label: 'Maintenance analysis' },
        { icon: Coins,      label: 'Rent collection status' },
        { icon: Sparkles,   label: 'Ask anything...' },
      ]
    }

    if (role === 'admin') {
      return [
        { icon: BarChart3,  label: 'Executive dashboard' },
        { icon: TrendingUp, label: 'Analyze revenue growth' },
        { icon: Home,       label: 'Predict vacancies' },
        { icon: UsersRound, label: 'Tenant retention analysis' },
        { icon: Sparkles,   label: 'Ask anything...' },
      ]
    }

    // superadmin
    return [
      { icon: BarChart3,  label: 'Platform overview' },
      { icon: Home,       label: 'Revenue by organization' },
      { icon: UsersRound, label: 'Active subscriptions' },
      { icon: Coins,      label: 'Churn analysis' },
      { icon: Sparkles,   label: 'Ask anything...' },
    ]
  }, [role])

  const resetConversation = () => {
    typingCleanup.current?.()
    typingCleanup.current = null
    if (muteTimer.current !== null) window.clearTimeout(muteTimer.current)
    muteTimer.current = null
    setTemporaryMuteUntil(null)
    setSessionSuspended(false)
    clearMessages()
    void startSession()
    // Orb variant: re-greet on reset; page variant: wait for user input
    if (!isPage && role !== 'public_hunter' && !managerHasNoProperty) {
      greeted.current = false
      window.setTimeout(() => {
        if (!mounted.current) return
        greeted.current = true
        void send('hello', { silent: true })
      }, 500)
    }
  }

  const muteActive = isTemporaryMuteActive(temporaryMuteUntil)
  const rateLimitActive = rateLimitedUntil !== null && Date.now() < rateLimitedUntil
  // Manager has no assigned property — block AI until admin assigns one
  const managerHasNoProperty = role === 'manager' && !auth.user?.current_property
  const aiInputDisabled = submitting || loading || sessionSuspended || muteActive || rateLimitActive || managerHasNoProperty
  const inputPlaceholder = sessionSuspended
    ? 'This AI session is suspended.'
    : muteActive
      ? 'AI input is temporarily muted.'
      : rateLimitActive
        ? `Rate limit active — ${rateLimitCountdown}s remaining`
        : managerHasNoProperty
          ? 'No property assigned — contact your admin to get started.'
          : 'Type your message...'

  // Auto-focus input when the page variant mounts
  useEffect(() => {
    if (!isPage) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [isPage])

  // Capture any keystroke on the page and redirect it to the input field
  useEffect(() => {
    if (!isPage) return
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip modifier combos, non-printable keys, and already-focused inputs
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return
      const active = document.activeElement as HTMLElement | null
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.tagName === 'SELECT') return
      if (aiInputDisabled) return
      inputRef.current?.focus()
      // Don't preventDefault — the character lands in the focused textarea naturally
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isPage, aiInputDisabled])

  // Page variant: no auto-greeting — wait for user to type

  // Auto-greeting when the orb opens (first open only)
  useEffect(() => {
    if (isPage || !open || role === 'public_hunter' || managerHasNoProperty) return
    if (greeted.current) return
    greeted.current = true
    void send('hello', { silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPage, role])

  // ── Page variant ──────────────────────────────────────────────────────────
  if (isPage) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src={aiOrb}
              alt=""
              className={`ai-orb-image ai-orb-header ${loading ? 'ai-orb-thinking' : ''} ${error ? 'ai-orb-muted' : ''}`}
              aria-hidden="true"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold leading-tight text-foreground">{assistantLabel}</span>
                {ROLE_BADGE[role] && (
                  <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${ROLE_BADGE[role].bg} ${ROLE_BADGE[role].text}`}>
                    {ROLE_BADGE[role].label}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </div>
            </div>
          </div>
          <button
            onClick={resetConversation}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Start a new chat"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-5">
            {/* No property assigned — manager onboarding state */}
            {managerHasNoProperty && (
              <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40">
                  <Building2 className="h-8 w-8 text-amber-600 dark:text-amber-300" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">No Property Assigned</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    You haven't been assigned to a property yet. AI assistance requires a property context to show occupancy, maintenance, rent data, and more.
                  </p>
                </div>
                <div className="w-full rounded-xl border border-teal-200/70 bg-teal-50/70 px-4 py-4 text-left dark:border-teal-400/20 dark:bg-teal-950/30">
                  <p className="mb-2 text-xs font-semibold text-teal-800 dark:text-teal-200">What to do next</p>
                  <ul className="space-y-1.5 text-xs text-teal-700 dark:text-teal-300">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-teal-200 text-center text-[0.6rem] font-bold leading-4 text-teal-800 dark:bg-teal-700 dark:text-teal-100">1</span>
                      Contact your administrator and ask them to assign you to a property.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-teal-200 text-center text-[0.6rem] font-bold leading-4 text-teal-800 dark:bg-teal-700 dark:text-teal-100">2</span>
                      Once assigned, log out and log back in — or refresh the page.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-teal-200 text-center text-[0.6rem] font-bold leading-4 text-teal-800 dark:bg-teal-700 dark:text-teal-100">3</span>
                      Return here and AI will be ready to assist you.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Hero — only shown before first message (when property IS assigned) */}
            {!managerHasNoProperty && messages.length === 0 && (
              <div className="mx-auto mb-6 flex w-fit flex-col items-center text-center">
                <img
                  src={aiOrb}
                  alt=""
                  className={`ai-orb-image ai-orb-hero ${loading ? 'ai-orb-thinking' : ''} ${error ? 'ai-orb-muted' : ''}`}
                  aria-hidden="true"
                />
                <h2 className="text-lg font-extrabold text-foreground">Hello, {greetingName}!</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loading ? 'Getting things ready…' : 'How can I help you today?'}
                </p>
              </div>
            )}

            {/* Error banner */}
            {error && !rateLimitActive && !managerHasNoProperty && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-950/30 dark:text-amber-100">
                <img src={aiOrb} alt="" className="ai-orb-image ai-orb-error" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">AI is having trouble connecting.</p>
                  <p className="mt-0.5 text-xs opacity-80">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => lastFailedPrompt ? void send(lastFailedPrompt) : void startSession()}
                  className="shrink-0 rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:bg-amber-300/15 dark:text-amber-100 dark:hover:bg-amber-300/25"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Rate limit banner */}
            {rateLimitActive && (
              <AIRateLimitBanner countdown={rateLimitCountdown} tier={rateLimitTier} />
            )}

            {/* Quick prompts — hidden when no property assigned */}
            {!managerHasNoProperty && messages.length === 0 && (
              <div className="mb-6 space-y-2">
                {quickPrompts.map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => label === 'Ask anything...' ? setInput('') : void send(label)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-violet-200/70 bg-violet-50/70 px-4 py-3 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-100/80 dark:border-violet-400/20 dark:bg-white/[0.055] dark:text-slate-100 dark:hover:border-violet-300/45 dark:hover:bg-violet-500/15"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                    <span className="min-w-0 flex-1">{label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Messages */}
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="sr-only">Ask me about rent, maintenance, analytics, or leases.</div>
              )}
              {messages.map((m, index) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${getMessageBubbleClass(m.role, m.meta)}`}>
                    {m.role === 'assistant' && getModerationAction(m.meta) === 'warning' ? (
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-200">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Warning
                      </div>
                    ) : null}
                    <AIMessageContent text={m.content} />
                    {m.role === 'assistant' ? <AIConfidenceNote meta={m.meta} /> : null}
                    {m.role === 'assistant' ? (
                      <AIResponseDetails content={m.content} context={m.context} meta={m.meta} token={auth.token} />
                    ) : null}
                    {m.role === 'assistant' && m.visuals?.length && chartsReadyFor.has(m.id) ? (
                      chartsGeneratingFor.has(m.id)
                        ? <AIChartsGenerating count={m.visuals.length} />
                        : <AIChartGrid visuals={m.visuals} animate />
                    ) : null}
                    {m.role === 'assistant' && (m.media?.length || m.action_intent?.type === 'view_media_gallery') ? (
                      <AIMediaGrid items={m.media ?? []} actionIntent={m.action_intent} onSend={(msg) => void send(msg)} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_dashboard' ? (
                      <AIDashboardIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_dashboard' ? (
                      <AIPropertyMapPins intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' &&
                      Array.isArray(m.action_intent?.payload?.properties) &&
                      (m.action_intent!.payload.properties as unknown[]).length > 1 ? (
                      <AIPropertyComparisonTable properties={m.action_intent!.payload.properties as CompProp[]} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_superadmin_dashboard' ? (
                      <AISuperAdminDashboardIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && (
                      m.action_intent?.type === 'initiate_rent_payment' ||
                      m.action_intent?.type === 'initiate_subscription_payment'
                    ) ? (
                      <AIPaymentConfirmCard intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'poll_payment_status' ? (
                      <AIPaymentPoller
                        reference={m.action_intent.payload.reference as string}
                        payType={m.action_intent.payload.type as string}
                      />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_amenities_map' ? (
                      <AIAmenitiesMapIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_listing_pricing' ? (
                      <AIListingPricingIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_safety_map' ? (
                      <AIViewSafetyMapIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'explore_neighbourhood' ? (
                      <AIExploreNeighbourhoodIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'enquire_availability' ? (
                      <AIEnquireAvailabilityIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'compare_listings' ? (
                      <AICompareListingsIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_listing_verification' ? (
                      <AIListingVerificationIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_property_map' ? (
                      <AIViewPropertyMapIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_directions' ? (
                      <AIViewDirectionsIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_street_view' ? (
                      <AIViewStreetViewIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_listing' ? (
                      <AIViewListingIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'submit_maintenance_request' ? (
                      <AIMaintenanceRequestIntent intent={m.action_intent} token={auth.token} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'send_tenant_notice' ? (
                      <AISendTenantNoticeIntent intent={m.action_intent} token={auth.token} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'bookings_approved' ? (
                      <AIBookingsApprovedIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'publish_property_listing' ? (
                      <AIPublishPropertyIntent intent={m.action_intent} token={auth.token} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'reminders_sent' ? (
                      <AIRemindersSentIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'download_pdf' ? (
                      <AIDownloadPdfIntent intent={m.action_intent} token={auth.token} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'show_identity' ? (
                      <AIWhoAmICard intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'send_stk_push' ? (
                      <AISendStkPushIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'approve_bookings' ? (
                      <AIApproveBookingsIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'generate_notice' ? (
                      <AIGenerateNoticeIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'generate_invoice' ? (
                      <AIGenerateInvoiceIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'send_maintenance' ? (
                      <AISendMaintenanceIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'send_invite_pdf' ? (
                      <AISendInvitePdfIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'whatsapp_invite' ? (
                      <AIWhatsAppInviteIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'publish_listing' ? (
                      <AIPublishListingIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'print_pdf' ? (
                      <AIPrintPdfIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'rent_summary' ? (
                      <AIRentSummaryIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'initiate_payment' ? (
                      <AITenantPaymentIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_invoice' ? (
                      <AIViewInvoiceIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_lease' ? (
                      <AIViewLeaseIntent intent={m.action_intent} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'view_lease_pdf' ? (
                      <AIViewLeasePdfIntent intent={m.action_intent} token={auth.token} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'send_message' ? (
                      <AITenantSendMessageIntent intent={m.action_intent} token={auth.token} />
                    ) : null}
                    {m.role === 'assistant' && m.action_intent?.type === 'maintenance_request' ? (
                      <AITenantMaintenanceRequestIntent intent={m.action_intent} token={auth.token} />
                    ) : null}
                    {m.role === 'assistant' && m.action_type === 'room_invites' && m.action_data ? (
                      <AIInviteActions data={m.action_data} token={auth.token} />
                    ) : null}
                    {m.role === 'assistant' && m.response_type && m.cards ? (
                      <AIResponseCard responseType={m.response_type} cards={m.cards} role={role} onSend={(msg) => void send(msg)} />
                    ) : null}
                    {m.role === 'assistant' && m.listings?.some((l) => (l.tour_videos as {url?:string}[] | undefined)?.[0]?.url) ? (
                      <AIVideoTourCards listings={m.listings} />
                    ) : null}
                    {m.role === 'assistant' ? (
                      <AISuggestions suggestions={m.suggestions} onSelect={handleSuggestion} />
                    ) : null}
                    {m.role === 'assistant' && !shouldSuppressDetails(m.meta) ? (
                      <AIFeedbackControls
                        messageId={m.id}
                        sessionToken={sessionToken}
                        lastQuery={findPreviousUserMessage(messages, index)}
                        meta={m.meta}
                      />
                    ) : null}
                    {m.role === 'assistant' && role === 'superadmin' && m.token_usage ? (
                      <AITokenUsageChip usage={m.token_usage} />
                    ) : null}
                    <div className={`mt-2 text-[0.68rem] ${m.role === 'user' ? 'text-white/60' : 'text-muted-foreground'}`}>
                      {formatMessageTime(m.createdAt, timezone)}
                    </div>
                  </div>
                </div>
              ))}
              {loading && messages.length > 0 && (
                <div className="flex justify-start">
                  <div
                    className="flex w-full max-w-[84%] flex-col rounded-2xl rounded-bl-md border border-violet-100/80 bg-slate-100/90 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm dark:border-white/8 dark:bg-white/[0.075] dark:text-slate-100"
                    role="status"
                    aria-live="polite"
                  >
                    {taskProgress ? (
                      <div className="space-y-2.5 py-0.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-300">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Processing your request...
                        </div>
                        {taskProgress.steps.map((step, i) => {
                          const done   = i < taskProgress.completed
                          const active = i === taskProgress.completed
                          return (
                            <div
                              key={step}
                              className={`flex items-center gap-2 text-xs transition-opacity duration-300 ${i > taskProgress.completed ? 'opacity-30' : 'opacity-100'}`}
                            >
                              {done ? (
                                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" />
                              ) : active ? (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-500" />
                              ) : (
                                <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300 dark:border-slate-600" />
                              )}
                              <span className={done ? 'text-slate-400 line-through dark:text-slate-500' : active ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}>
                                {step}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <img src={aiOrb} alt="" className="ai-orb-image ai-orb-thinking h-8 w-8 shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="font-semibold">AI is thinking...</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Gathering the full information.</p>
                          </div>
                        </div>
                        <AIChartSkeleton />
                      </>
                    )}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-border bg-card px-4 pb-[5.5rem] pt-3 lg:pb-4">
          <div className="mx-auto max-w-3xl">
            {/* Quick action chips */}
            {(QUICK_CHIPS[role] ?? []).length > 0 && (
              <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {(QUICK_CHIPS[role] ?? []).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={aiInputDisabled}
                    onClick={() => {
                      if (chip === 'Pay Now') { navigate('/tenant/payments'); return }
                      void send(chip)
                    }}
                    className="shrink-0 rounded-full border border-border bg-muted/60 px-3 py-1 text-[0.7rem] font-medium text-muted-foreground transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-violet-500/50 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
            <div className={[
              'flex items-end gap-2 rounded-xl border bg-slate-100/80 p-1.5 shadow-inner transition-all duration-200 dark:bg-white/[0.075]',
              input.length > 0
                ? 'border-violet-400 ring-2 ring-violet-400/20 dark:border-violet-500 dark:ring-violet-500/20'
                : 'border-violet-100 dark:border-white/8',
            ].join(' ')}>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={inputPlaceholder}
                disabled={aiInputDisabled}
                className="min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
                style={{ maxHeight: '160px', overflowY: 'auto' }}
              />
              <button
                onClick={() => void send()}
                className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
                disabled={aiInputDisabled || input.trim().length === 0}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-center text-[0.68rem] text-muted-foreground">
              StayLynk AI can make mistakes. Verify important info.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Orb (floating) variant ────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-50 flex items-end justify-end sm:inset-x-auto sm:right-6 sm:bottom-6">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              className="mb-20 w-full overflow-hidden rounded-[1.35rem] border border-violet-200/80 bg-white/94 shadow-[0_22px_80px_rgba(88,28,135,0.22)] backdrop-blur-2xl sm:mr-4 sm:mb-0 sm:w-[390px] dark:border-violet-500/70 dark:bg-[#0c1020]/94 dark:shadow-[0_0_0_1px_rgba(168,85,247,0.34),0_24px_90px_rgba(2,6,23,0.72),0_0_42px_rgba(168,85,247,0.36)]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-violet-100/80 px-4 py-3 dark:border-white/8">
                <div className="flex items-center gap-3">
                  <img
                    src={aiOrb}
                    alt=""
                    className={`ai-orb-image ai-orb-header ${loading ? 'ai-orb-thinking' : ''} ${error ? 'ai-orb-muted' : ''}`}
                    aria-hidden="true"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold leading-tight text-foreground">{assistantLabel}</span>
                      {ROLE_BADGE[role] && (
                        <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${ROLE_BADGE[role].bg} ${ROLE_BADGE[role].text}`}>
                          {ROLE_BADGE[role].label}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Online
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={resetConversation}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label="Start a new chat"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label="Close AI assistant"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[min(660px,calc(100vh-9rem))] overflow-y-auto px-4 py-5">
                {managerHasNoProperty ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                      <Building2 className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">No Property Assigned</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        You haven't been assigned to a property yet. AI assistance requires a property context.
                      </p>
                    </div>
                    <div className="w-full rounded-xl border border-teal-200/70 bg-teal-50/70 px-4 py-4 text-left dark:border-teal-400/20 dark:bg-teal-950/30">
                      <p className="mb-2 text-xs font-semibold text-teal-800 dark:text-teal-200">What to do next</p>
                      <ul className="space-y-1.5 text-xs text-teal-700 dark:text-teal-300">
                        <li>1. Contact your administrator and ask them to assign you to a property.</li>
                        <li>2. Once assigned, log out and back in — or refresh the page.</li>
                        <li>3. Return here and AI will be ready to assist you.</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mx-auto mb-5 flex w-fit flex-col items-center text-center">
                      <img
                        src={aiOrb}
                        alt=""
                        className={`ai-orb-image ai-orb-hero ${loading ? 'ai-orb-thinking' : ''} ${error ? 'ai-orb-muted' : ''}`}
                        aria-hidden="true"
                      />
                      <h2 className="text-lg font-extrabold text-foreground">Hello, {greetingName}!</h2>
                      <p className="mt-1 text-sm text-muted-foreground">How can I help you today?</p>
                    </div>

                    {error && !rateLimitActive && (
                      <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-950/30 dark:text-amber-100">
                        <img
                          src={aiOrb}
                          alt=""
                          className="ai-orb-image ai-orb-error"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">AI is having trouble connecting.</p>
                          <p className="mt-0.5 text-xs opacity-80">{error}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => lastFailedPrompt ? void send(lastFailedPrompt) : void startSession()}
                          className="shrink-0 rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:bg-amber-300/15 dark:text-amber-100 dark:hover:bg-amber-300/25"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    {rateLimitActive && (
                      <AIRateLimitBanner countdown={rateLimitCountdown} tier={rateLimitTier} />
                    )}

                    {messages.length === 0 && (
                      <div className="mb-5 space-y-2">
                        {quickPrompts.map(({ icon: Icon, label }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => label === 'Ask anything...' ? setInput('') : void send(label)}
                            className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-violet-200/70 bg-violet-50/70 px-4 py-3 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-100/80 dark:border-violet-400/20 dark:bg-white/[0.055] dark:text-slate-100 dark:hover:border-violet-300/45 dark:hover:bg-violet-500/15"
                          >
                            <Icon className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                            <span className="min-w-0 flex-1">{label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="sr-only">Ask me about rent, maintenance, analytics, or leases.</div>
                  )}
                  {messages.map((m, index) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${getMessageBubbleClass(m.role, m.meta)}`}
                      >
                        {m.role === 'assistant' && getModerationAction(m.meta) === 'warning' ? (
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-200">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Warning
                          </div>
                        ) : null}
                        <AIMessageContent text={m.content} />
                        {m.role === 'assistant' ? <AIConfidenceNote meta={m.meta} /> : null}
                        {m.role === 'assistant' ? (
                          <AIResponseDetails content={m.content} context={m.context} meta={m.meta} token={auth.token} />
                        ) : null}
                        {m.role === 'assistant' && m.visuals?.length ? (
                          <AIChartGrid visuals={m.visuals} />
                        ) : null}
                        {m.role === 'assistant' && m.media?.length ? (
                          <AIMediaGrid items={m.media} actionIntent={m.action_intent} onSend={(msg) => void send(msg)} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_dashboard' ? (
                          <AIDashboardIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_dashboard' ? (
                          <AIPropertyMapPins intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' &&
                          Array.isArray(m.action_intent?.payload?.properties) &&
                          (m.action_intent!.payload.properties as unknown[]).length > 1 ? (
                          <AIPropertyComparisonTable properties={m.action_intent!.payload.properties as CompProp[]} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_superadmin_dashboard' ? (
                          <AISuperAdminDashboardIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && (
                          m.action_intent?.type === 'initiate_rent_payment' ||
                          m.action_intent?.type === 'initiate_subscription_payment'
                        ) ? (
                          <AIPaymentConfirmCard intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'poll_payment_status' ? (
                          <AIPaymentPoller
                            reference={m.action_intent.payload.reference as string}
                            payType={m.action_intent.payload.type as string}
                          />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_amenities_map' ? (
                          <AIAmenitiesMapIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_listing_pricing' ? (
                          <AIListingPricingIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_safety_map' ? (
                          <AIViewSafetyMapIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'explore_neighbourhood' ? (
                          <AIExploreNeighbourhoodIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'enquire_availability' ? (
                          <AIEnquireAvailabilityIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'compare_listings' ? (
                          <AICompareListingsIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_listing_verification' ? (
                          <AIListingVerificationIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_property_map' ? (
                          <AIViewPropertyMapIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_directions' ? (
                          <AIViewDirectionsIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_street_view' ? (
                          <AIViewStreetViewIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_listing' ? (
                          <AIViewListingIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'submit_maintenance_request' ? (
                          <AIMaintenanceRequestIntent intent={m.action_intent} token={auth.token} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'send_tenant_notice' ? (
                          <AISendTenantNoticeIntent intent={m.action_intent} token={auth.token} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'bookings_approved' ? (
                          <AIBookingsApprovedIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'publish_property_listing' ? (
                          <AIPublishPropertyIntent intent={m.action_intent} token={auth.token} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'reminders_sent' ? (
                          <AIRemindersSentIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'download_pdf' ? (
                          <AIDownloadPdfIntent intent={m.action_intent} token={auth.token} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'show_identity' ? (
                          <AIWhoAmICard intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'send_stk_push' ? (
                          <AISendStkPushIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'approve_bookings' ? (
                          <AIApproveBookingsIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'generate_notice' ? (
                          <AIGenerateNoticeIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'generate_invoice' ? (
                          <AIGenerateInvoiceIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'send_maintenance' ? (
                          <AISendMaintenanceIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'send_invite_pdf' ? (
                          <AISendInvitePdfIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'whatsapp_invite' ? (
                          <AIWhatsAppInviteIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'publish_listing' ? (
                          <AIPublishListingIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'print_pdf' ? (
                          <AIPrintPdfIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'rent_summary' ? (
                          <AIRentSummaryIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'initiate_payment' ? (
                          <AITenantPaymentIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_invoice' ? (
                          <AIViewInvoiceIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_lease' ? (
                          <AIViewLeaseIntent intent={m.action_intent} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'view_lease_pdf' ? (
                          <AIViewLeasePdfIntent intent={m.action_intent} token={auth.token} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'send_message' ? (
                          <AITenantSendMessageIntent intent={m.action_intent} token={auth.token} />
                        ) : null}
                        {m.role === 'assistant' && m.action_intent?.type === 'maintenance_request' ? (
                          <AITenantMaintenanceRequestIntent intent={m.action_intent} token={auth.token} />
                        ) : null}
                        {m.role === 'assistant' && m.action_type === 'room_invites' && m.action_data ? (
                          <AIInviteActions data={m.action_data} token={auth.token} />
                        ) : null}
                        {m.role === 'assistant' && m.response_type && m.cards ? (
                          <AIResponseCard responseType={m.response_type} cards={m.cards} role={role} onSend={(msg) => void send(msg)} />
                        ) : null}
                        {m.role === 'assistant' && m.listings?.some((l) => (l.tour_videos as {url?:string}[] | undefined)?.[0]?.url) ? (
                          <AIVideoTourCards listings={m.listings} />
                        ) : null}
                        {m.role === 'assistant' ? (
                          <AISuggestions suggestions={m.suggestions} onSelect={handleSuggestion} />
                        ) : null}
                        {m.role === 'assistant' && !shouldSuppressDetails(m.meta) ? (
                          <AIFeedbackControls
                            messageId={m.id}
                            sessionToken={sessionToken}
                            lastQuery={findPreviousUserMessage(messages, index)}
                            meta={m.meta}
                          />
                        ) : null}
                        {m.role === 'assistant' && role === 'superadmin' && m.token_usage ? (
                          <AITokenUsageChip usage={m.token_usage} />
                        ) : null}
                        <div className={`mt-2 text-[0.68rem] ${m.role === 'user' ? 'text-white/60' : 'text-muted-foreground'}`}>
                          {formatMessageTime(m.createdAt, timezone)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && messages.length > 0 && (
                    <div className="flex justify-start">
                      <div
                        className="flex w-full max-w-[84%] flex-col rounded-2xl rounded-bl-md border border-violet-100/80 bg-slate-100/90 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm dark:border-white/8 dark:bg-white/[0.075] dark:text-slate-100"
                        role="status"
                        aria-live="polite"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={aiOrb}
                            alt=""
                            className="ai-orb-image ai-orb-thinking h-8 w-8 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold">AI is thinking...</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Gathering the full information.</p>
                          </div>
                        </div>
                        <AIChartSkeleton />
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              </div>

              <div className="border-t border-violet-100/80 px-4 pb-4 pt-3 dark:border-white/8">
                {/* Quick chips — orb */}
                {(QUICK_CHIPS[role] ?? []).length > 0 && (
                  <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {(QUICK_CHIPS[role] ?? []).map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        disabled={aiInputDisabled}
                        onClick={() => {
                          if (chip === 'Pay Now') { navigate('/tenant/payments'); return }
                          void send(chip)
                        }}
                        className="shrink-0 rounded-full border border-violet-100/80 bg-violet-50/70 px-3 py-1 text-[0.65rem] font-medium text-slate-600 transition hover:border-violet-300 hover:bg-violet-100 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-400/20 dark:bg-white/[0.055] dark:text-slate-300 dark:hover:border-violet-300/45 dark:hover:bg-violet-500/15 dark:hover:text-violet-200"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
                <div className={[
                  'flex items-end gap-2 rounded-xl border bg-slate-100/80 p-1.5 shadow-inner transition-all duration-200 dark:bg-white/[0.075]',
                  input.length > 0
                    ? 'border-violet-400 ring-2 ring-violet-400/20 dark:border-violet-500 dark:ring-violet-500/20'
                    : 'border-violet-100 dark:border-white/8',
                ].join(' ')}>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={inputPlaceholder}
                    disabled={aiInputDisabled}
                    className="min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ maxHeight: '160px', overflowY: 'auto' }}
                  />
                  <button
                    onClick={() => void send()}
                    className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Send message"
                    disabled={aiInputDisabled || input.trim().length === 0}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-3 text-center text-[0.68rem] text-muted-foreground">
                  StayLynk AI can make mistakes. Verify important info.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setOpen((s) => !s)}
          className="ai-orb-launcher group relative z-50 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-violet-300/60 bg-white p-0 shadow-[0_16px_42px_rgba(88,28,135,0.34)] ring-2 ring-fuchsia-400/40 transition hover:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-fuchsia-400/55 dark:border-violet-400/50 dark:bg-slate-950 dark:shadow-[0_0_40px_rgba(217,70,239,0.36)]"
          aria-label="Open AI Assistant"
        >
          <img
            src={aiOrb}
            alt=""
            className={`ai-orb-image h-full w-full ${loading ? 'ai-orb-thinking' : ''} ${error ? 'ai-orb-muted' : ''}`}
            aria-hidden="true"
          />
        </motion.button>
      </div>
    </>
  )
}

function getAIErrorMessage(err: unknown): string {
  if (!isApiError(err)) return getErrorMessage(err) || 'Network error. Please try again.'

  switch (err.status) {
    case 401:
      return 'Please sign in again before using AI.'
    case 403:
      return 'You do not have permission to use this AI action.'
    case 413:
      return 'That request is too large. Try a shorter message.'
    case 422:
      return getErrorMessage(err) || 'Please revise your prompt and try again.'
    case 429:
      return 'AI rate limit reached. Please wait a moment, then retry.'
    default:
      return getErrorMessage(err) || 'Network error. Please try again.'
  }
}

function findPreviousUserMessage(messages: Array<{ role: string; content: string }>, index: number): string | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return messages[i]?.content
  }
  return undefined
}

function typeWords(
  text: string,
  speedMs: number,
  onUpdate: (value: string) => void,
  onDone?: () => void,
): () => void {
  const words = text.split(' ')
  let index = 0

  if (words.length === 0) {
    onDone?.()
    return () => undefined
  }

  const timer = window.setInterval(() => {
    index += 1
    onUpdate(words.slice(0, index).join(' '))

    if (index >= words.length) {
      window.clearInterval(timer)
      onDone?.()
    }
  }, Math.max(8, speedMs))

  return () => window.clearInterval(timer)
}

function AIMessageContent({ text }: { text: string }): React.ReactElement {
  const blocks = parseMarkdownBlocks(text)

  if (blocks.length === 0) {
    return <span className="inline-block min-h-5" />
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === 'table') {
          return <MarkdownTable key={`table-${index}`} table={block.table} />
        }

        if (block.type === 'list') {
          return (
            <ul key={`list-${index}`} className="space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="list-disc">
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={`paragraph-${index}`} className="whitespace-pre-wrap">
            {renderInlineMarkdown(block.text)}
          </p>
        )
      })}
    </div>
  )
}

type MarkdownBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; table: AITable }

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''

    if (line.trim() === '') {
      index += 1
      continue
    }

    const maybeTable = parseTableAt(lines, index)
    if (maybeTable) {
      blocks.push({ type: 'table', table: maybeTable.table })
      index = maybeTable.nextIndex
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^\s*[-*]\s+/, '').trim())
        index += 1
      }
      blocks.push({ type: 'list', items })
      continue
    }

    const paragraph: string[] = []
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() !== '' &&
      !parseTableAt(lines, index) &&
      !/^\s*[-*]\s+/.test(lines[index] ?? '')
    ) {
      paragraph.push((lines[index] ?? '').trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') })
  }

  return blocks
}

function hasMarkdownTable(text: string): boolean {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  return lines.some((_, index) => parseTableAt(lines, index) !== null)
}

function parseTableAt(lines: string[], index: number): { table: AITable; nextIndex: number } | null {
  const headerLine = lines[index] ?? ''
  const dividerLine = lines[index + 1] ?? ''

  if (!isMarkdownTableRow(headerLine) || !isMarkdownTableDivider(dividerLine)) return null

  const columns = splitMarkdownTableRow(headerLine)
  if (columns.length === 0) return null

  const rows: AITable['rows'] = []
  let cursor = index + 2
  while (cursor < lines.length && isMarkdownTableRow(lines[cursor] ?? '')) {
    const cells = splitMarkdownTableRow(lines[cursor] ?? '')
    rows.push(columns.map((_, cellIndex) => cells[cellIndex] ?? ''))
    cursor += 1
  }

  return {
    table: {
      title: 'Comparison',
      columns,
      rows,
    },
    nextIndex: cursor,
  }
}

function isMarkdownTableRow(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.includes('|') && trimmed.split('|').filter((part) => part.trim() !== '').length >= 2
}

function isMarkdownTableDivider(line: string): boolean {
  const cells = splitMarkdownTableRow(line)
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))
    const value = match[0]
    if (value.startsWith('**')) {
      nodes.push(<strong key={`${value}-${match.index}`}>{value.slice(2, -2)}</strong>)
    } else {
      nodes.push(
        <a key={`${value}-${match.index}`} href={value} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline dark:text-sky-300">
          {value}
        </a>,
      )
    }
    cursor = match.index + value.length
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

function MarkdownTable({ table }: { table: AITable }): React.ReactElement {
  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white/75 dark:border-white/10 dark:bg-white/[0.04]">
      <table className="w-full min-w-max text-left text-xs">
        <thead className="bg-slate-100/90 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
          <tr>
            {table.columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-3 py-2 font-semibold">
                {renderInlineMarkdown(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-white/10">
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {table.columns.map((column, columnIndex) => (
                <td key={`${rowIndex}-${column}`} className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-200">
                  {renderInlineMarkdown(formatTableCell(row[columnIndex]))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AIFeedbackControls({
  messageId,
  sessionToken,
  lastQuery,
  meta,
}: {
  messageId: string
  sessionToken?: string | null
  lastQuery?: string
  meta?: AIChatMeta
}): React.ReactElement {
  const [rating, setRating] = useState<'up' | 'down' | null>(null)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  const sendFeedback = async (value: 'up' | 'down', reason = comment.trim()) => {
    setRating(value)
    setStatus('sending')
    try {
      await aiApi.feedbackThumbs({
        session_token: sessionToken,
        message_id: messageId,
        value,
        reason: reason || undefined,
        last_query: lastQuery,
        intent: meta?.domain ? { domain: meta.domain } : undefined,
      })
      setStatus('sent')
      setShowComment(false)
    } catch {
      setStatus('failed')
      setShowComment(true)
    }
  }

  return (
    <div className="mt-3 border-t border-slate-200/70 pt-2 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.68rem] font-medium text-muted-foreground">Rate this answer</span>
        <button
          type="button"
          onClick={() => void sendFeedback('up')}
          disabled={status === 'sending'}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${rating === 'up' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200' : 'border-slate-200 bg-white/60 text-slate-500 hover:text-emerald-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}
          aria-label="Good AI response"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setRating('down')
            setShowComment(true)
          }}
          disabled={status === 'sending'}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${rating === 'down' ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200' : 'border-slate-200 bg-white/60 text-slate-500 hover:text-rose-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}
          aria-label="Bad AI response"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setShowComment((value) => !value)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white/60 text-slate-500 transition hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          aria-label="Add feedback comment"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        {status === 'sent' ? (
          <span className="text-[0.68rem] font-medium text-emerald-600 dark:text-emerald-300">Feedback sent</span>
        ) : status === 'failed' ? (
          <span className="text-[0.68rem] font-medium text-rose-600 dark:text-rose-300">Feedback failed</span>
        ) : null}
      </div>
      {showComment ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-800 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:focus:ring-violet-400/20"
            placeholder="Optional comment"
          />
          <button
            type="button"
            onClick={() => void sendFeedback(rating ?? 'down')}
            disabled={status === 'sending'}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'sending' ? 'Sending...' : 'Send feedback'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function getDisplayMessage(message: string, context?: AIChatContext, meta?: AIChatMeta): string {
  if (isDomainBlocked(meta)) {
    return DOMAIN_ASSISTANT_MESSAGE
  }

  if (meta?.blocked === true) {
    return message
  }

  if (hasEmptyRecords(context?.records)) {
    return fallbackMessage(context?.action?.action ?? meta?.action ?? '')
  }

  return message
}

function hasEmptyRecords(records?: Record<string, unknown>): boolean {
  if (!records) return false
  const groups = Object.values(records)
  return groups.length > 0 && groups.every((items) => Array.isArray(items) && items.length === 0)
}

function fallbackMessage(action: string): string {
  switch (action) {
    case 'property_search':
      return 'I could not find matching houses yet. Try widening your budget, changing location, or removing one amenity.'
    case 'overdue_rent':
      return 'There is no overdue rent in your authorized workspace right now.'
    case 'vacant_units':
      return 'I did not find vacant units for your current scope.'
    case 'rent_balance':
      return 'I did not find an open rent balance for your account.'
    default:
      return 'I checked what your role can access, but there is no matching information yet.'
  }
}

function getMessageBubbleClass(role: 'assistant' | 'user' | 'system', meta?: AIChatMeta): string {
  if (role === 'user') {
    return 'rounded-br-md bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-violet-700/20'
  }

  const moderationAction = getModerationAction(meta)
  if (moderationAction === 'warning') {
    return 'rounded-bl-md border border-amber-200/80 bg-amber-50/95 text-amber-950 dark:border-amber-400/25 dark:bg-amber-950/35 dark:text-amber-100'
  }

  if (meta?.confidence_band === 'low') {
    return 'rounded-bl-md border border-sky-200/80 bg-sky-50/95 text-slate-800 dark:border-sky-400/25 dark:bg-sky-950/30 dark:text-slate-100'
  }

  return 'rounded-bl-md border border-violet-100/80 bg-slate-100/90 text-slate-800 dark:border-white/8 dark:bg-white/[0.075] dark:text-slate-100'
}

function AIConfidenceNote({ meta }: { meta?: AIChatMeta }): React.ReactElement | null {
  if (meta?.confidence_band === 'medium') {
    return (
      <p className="mt-2 text-[0.68rem] font-medium text-slate-500 dark:text-slate-300">
        Verified from available data.
      </p>
    )
  }

  if (meta?.confidence_band === 'low') {
    return (
      <p className="mt-2 text-[0.68rem] font-medium text-sky-700 dark:text-sky-200">
        I may need one more detail to answer this confidently.
      </p>
    )
  }

  return null
}

function isDomainBlocked(meta?: AIChatMeta): boolean {
  const reason = meta?.domain?.reason
  return reason === 'out_of_domain' || reason === 'blocked_topic'
}

function getModerationAction(meta?: AIChatMeta): string | undefined {
  return meta?.moderation?.action ?? meta?.moderation?.outcome
}

function shouldSuppressDetails(meta?: AIChatMeta): boolean {
  return meta?.blocked === true || isDomainBlocked(meta)
}

function shouldRenderActions(meta?: AIChatMeta): boolean {
  return !shouldSuppressDetails(meta) && meta?.confidence_band !== 'low'
}

function isTemporaryMuteActive(muteUntil: number | null): boolean {
  return muteUntil !== null && muteUntil > Date.now()
}

function applyModerationState(
  meta: AIChatMeta,
  setTemporaryMuteUntil: React.Dispatch<React.SetStateAction<number | null>>,
  setSessionSuspended: React.Dispatch<React.SetStateAction<boolean>>,
  muteTimer: React.MutableRefObject<number | null>,
): void {
  const action = getModerationAction(meta)

  if (action === 'session_suspension') {
    setSessionSuspended(true)
  }

  if (action !== 'temporary_mute') return

  const until = getMuteUntil(meta.moderation)
  if (muteTimer.current !== null) window.clearTimeout(muteTimer.current)
  setTemporaryMuteUntil(until)
  muteTimer.current = window.setTimeout(() => {
    setTemporaryMuteUntil(null)
    muteTimer.current = null
  }, Math.max(0, until - Date.now()))
}

function getMuteUntil(moderation: AIChatMeta['moderation']): number {
  const explicitUntil = moderation?.muted_until ?? moderation?.mute_until
  if (explicitUntil) {
    const parsed = new Date(explicitUntil).getTime()
    if (Number.isFinite(parsed) && parsed > Date.now()) return parsed
  }

  const seconds = typeof moderation?.mute_seconds === 'number' && moderation.mute_seconds > 0
    ? moderation.mute_seconds
    : 60
  return Date.now() + seconds * 1000
}

function AIResponseDetails({
  content,
  context,
  meta,
  token,
}: {
  content: string
  context?: AIChatContext
  meta?: AIChatMeta
  token?: string | null
}): React.ReactElement | null {
  if (shouldSuppressDetails(meta)) return null

  const tables = hasMarkdownTable(content)
    ? []
    : [...(context?.tables ?? []), ...(context?.retrieval?.tables ?? [])]
  const actions = shouldRenderActions(meta) ? context?.actions ?? [] : []
  const hasDetails = tables.length > 0 || actions.length > 0 || hasSummaryContent(context)

  if (!hasDetails) return null

  return (
    <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <AIDataSummary context={context} />
      {tables.map((table, index) => (
        <AITableView key={`${table.title}-${index}`} table={table} />
      ))}
      <AIActionButtons actions={actions} token={token} />
    </div>
  )
}

function hasSummaryContent(context?: AIChatContext): boolean {
  const metricCount = Object.keys(context?.metrics ?? {}).length
  const records = context?.records ?? {}
  const recordCount = Object.values(records).some((value) => Array.isArray(value) && value.length > 0)
  return metricCount > 0 || recordCount
}

function AIDataSummary({ context }: { context?: AIChatContext }): React.ReactElement | null {
  const metrics = Object.entries(context?.metrics ?? {})
  const recordCounts = Object.entries(context?.records ?? {}).reduce<Array<readonly [string, number]>>((items, [key, value]) => {
    if (Array.isArray(value)) items.push([key, value.length] as const)
    return items
  }, [])

  if (metrics.length === 0 && recordCounts.length === 0) return null

  return (
    <div className="space-y-2">
      {metrics.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {metrics.slice(0, 6).map(([key, value]) => (
            <span key={key} className="rounded-md bg-white/70 px-2 py-1 text-[0.68rem] font-medium text-slate-700 dark:bg-white/10 dark:text-slate-200">
              {labelize(key)}: {formatMetric(value)}
            </span>
          ))}
        </div>
      ) : null}
      {recordCounts.some(([, count]) => count > 0) ? (
        <div className="flex flex-wrap gap-1.5">
          {recordCounts.filter(([, count]) => count > 0).slice(0, 4).map(([key, count]) => (
            <span key={key} className="rounded-md bg-violet-50 px-2 py-1 text-[0.68rem] font-medium text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
              {count} {labelize(key)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AITableView({ table }: { table: AITable }): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 dark:border-white/10 dark:text-slate-100">
        {table.title}
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-max text-left text-xs">
          <thead className="bg-slate-100/80 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
            <tr>
              {table.columns.map((column) => (
                <th key={column} className="px-3 py-2 font-semibold whitespace-nowrap">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/10">
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {table.columns.map((column, columnIndex) => (
                  <td key={`${rowIndex}-${column}`} className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                    {formatTableCell(row[columnIndex])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AIActionButtons({
  actions,
  token,
}: {
  actions: AIAction[]
  token?: string | null
}): React.ReactElement | null {
  const pdfActions = actions.filter((action) => action.type === 'pdf_download')
  const tasks = actions.filter((action) => action.requires_confirmation)

  if (pdfActions.length === 0 && tasks.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {pdfActions.map((action) => (
        <button
          key={`${action.label}-${action.url}`}
          type="button"
          onClick={() => void downloadPdf(action, token)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <Download className="h-3.5 w-3.5" />
          {action.label || 'Download PDF'}
        </button>
      ))}
      {tasks.map((action) => (
        <button
          key={`${action.label}-${action.url}`}
          type="button"
          onClick={() => void confirmAndRunTask(action, token)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200 dark:hover:bg-violet-400/20"
        >
          <Play className="h-3.5 w-3.5" />
          {action.label}
        </button>
      ))}
    </div>
  )
}

async function downloadPdf(action: AIAction, token?: string | null): Promise<void> {
  if (!token) {
    window.open(action.url, '_blank')
    return
  }

  const res = await fetch(action.url, {
    method: action.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/pdf',
    },
  })

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function confirmAndRunTask(action: AIAction, token?: string | null): Promise<void> {
  const confirmed = window.confirm(`Run "${action.label}"?`)
  if (!confirmed) return

  await fetch(action.url, {
    method: action.method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(action.body_hint ?? {}),
  })
}

function formatTableCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'
  return typeof value === 'number' ? value.toLocaleString() : value
}

function labelize(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatMetric(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function getUserTimezone(timezone?: string | null): string {
  if (timezone && isValidTimezone(timezone)) return timezone
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function formatMessageTime(createdAt: string | undefined, timezone: string): string {
  const date = createdAt ? new Date(createdAt) : new Date()

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date)
}

function normalizeSuggestions(s: string[] | Record<string, string> | undefined): string[] | undefined {
  if (!s) return undefined
  if (Array.isArray(s)) return s.length ? s : undefined
  const vals = Object.values(s).filter(Boolean) as string[]
  return vals.length ? vals : undefined
}

// ── Media gallery components ──────────────────────────────────────────────

function AIMediaGrid({
  items,
  actionIntent,
}: {
  items: AIMediaItem[]
  actionIntent?: ActionIntent | null
  onSend?: (msg: string) => void
}): React.ReactElement | null {
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxItems, setLightboxItems] = useState<AIMediaItem[]>([])

  // payload.items is authoritative when action_intent is view_media_gallery
  const isGallery = actionIntent?.type === 'view_media_gallery'
  const payload = isGallery ? actionIntent?.payload : null
  const allItems: AIMediaItem[] = (payload?.items as AIMediaItem[] | undefined) ?? items

  if (allItems.length === 0) return null

  const imageCount = (payload?.image_count as number | undefined) ?? allItems.filter((i) => i.type === 'image' || !i.type).length
  const videoCount = (payload?.video_count as number | undefined) ?? allItems.filter((i) => i.type === 'video').length
  const hasMore = (payload?.has_more as boolean | undefined) ?? false
  const totalCount = (payload?.total_count as number | undefined) ?? allItems.length

  const showViewAll = actionIntent != null && (hasMore || totalCount > allItems.length)
  const showFilterTabs = imageCount > 0 && videoCount > 0

  const filtered = allItems.filter((item) => {
    if (filter === 'image') return item.type === 'image' || !item.type
    if (filter === 'video') return item.type === 'video'
    return true
  })
  const shown = filtered.slice(0, 4)
  const remaining = filtered.length - 4

  const openLightbox = (idx: number, gallery: AIMediaItem[]) => {
    setLightboxItems(gallery)
    setLightboxIndex(idx)
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Filter tabs — only when both types present */}
      {showFilterTabs && (
        <div className="flex gap-1">
          {(['all', 'image', 'video'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                filter === f
                  ? 'bg-violet-600 text-white'
                  : 'border border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:text-slate-400 dark:hover:text-violet-300'
              }`}
            >
              {f === 'all' ? 'All' : f === 'image' ? 'Photos' : 'Videos'}
            </button>
          ))}
        </div>
      )}

      {/* Preview grid */}
      {shown.length > 0 && (
        <div className={`grid gap-1.5 ${shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {shown.map((item, idx) => (
            <button
              key={item.url}
              type="button"
              onClick={() => openLightbox(idx, filtered)}
              className="relative block aspect-video w-full overflow-hidden rounded-lg bg-slate-200 transition hover:opacity-90 dark:bg-slate-700"
            >
              {item.type === 'video' ? (
                <>
                  {item.thumbnail && (
                    <img src={item.thumbnail} alt={item.alt ?? ''} className="h-full w-full object-cover" loading="lazy" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg">
                      <Play className="h-4 w-4 translate-x-0.5 text-slate-800" />
                    </div>
                  </div>
                  {item.duration && (
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[0.6rem] font-semibold text-white">
                      {item.duration}
                    </span>
                  )}
                </>
              ) : (
                <img src={item.thumbnail ?? item.url} alt={item.alt ?? ''} className="h-full w-full object-cover" loading="lazy" />
              )}
              {item.cover && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-violet-600 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-white">
                  Cover
                </span>
              )}
              {idx === 3 && remaining > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                  <span className="text-lg font-bold text-white">+{remaining}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* View All button — only when gallery has more than the preview */}
      {showViewAll && (
        <button
          type="button"
          onClick={() => openLightbox(0, allItems)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-200 dark:hover:bg-violet-400/20"
        >
          <Images className="h-4 w-4" />
          {actionIntent?.label ?? `View all ${totalCount}`}
        </button>
      )}

      {lightboxIndex !== null && (
        <AIMediaLightbox items={lightboxItems} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  )
}

function AIMediaLightbox({
  items,
  initialIndex,
  onClose,
}: {
  items: AIMediaItem[]
  initialIndex: number
  onClose: () => void
}): React.ReactElement {
  const [index, setIndex] = useState(initialIndex)
  const current = items[index]
  const total = items.length
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(total - 1, i + 1))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, total])

  useEffect(() => {
    const el = stripRef.current?.children[index] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [index])

  // Preload ±2 adjacent images into browser cache
  useEffect(() => {
    const start = Math.max(0, index - 2)
    const end = Math.min(total - 1, index + 2)
    for (let i = start; i <= end; i++) {
      const item = items[i]
      if (item && item.type !== 'video' && i !== index) {
        const img = new Image()
        img.src = item.url
      }
    }
  }, [index, items, total])

  // Only bind src for items within ±2 of current (prevents memory crash with large galleries)
  const inWindow = (i: number) => Math.abs(i - index) <= 2

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-black" role="dialog" aria-modal="true">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <div className="min-w-0 text-sm text-white/60">
          {current?.property && <span className="font-semibold text-white">{current.property}</span>}
          {current?.alt && current.alt !== `${current.property ?? ''} photo` && (
            <span> — {current.alt}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-white/40">{index + 1} / {total}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close gallery"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main media — contain without overstretching */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-14">
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            className="absolute left-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {current?.type === 'video' ? (
          <video
            key={current.url}
            src={current.url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-lg"
            style={{ maxHeight: 'calc(100vh - 10rem)', objectFit: 'contain' }}
          />
        ) : (
          <img
            key={current?.url}
            src={current?.url}
            alt={current?.alt ?? ''}
            className="max-h-full max-w-full rounded-lg object-contain"
            style={{ maxHeight: 'calc(100vh - 10rem)' }}
          />
        )}

        {index < total - 1 && (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            className="absolute right-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Thumbnail strip with lazy-load */}
      {total > 1 && (
        <div ref={stripRef} className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-4 pt-3">
          {items.map((item, i) => (
            <button
              key={item.url}
              type="button"
              onClick={() => setIndex(i)}
              className={[
                'relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-white/10 transition',
                i === index ? 'ring-2 ring-white opacity-100' : 'opacity-50 hover:opacity-80',
              ].join(' ')}
            >
              {inWindow(i) && (
                <img src={item.thumbnail ?? item.url} alt="" className="h-full w-full object-cover" />
              )}
              {item.type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-3 w-3 text-white drop-shadow" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}

// ── Dashboard Intent ─────────────────────────────────────────────────────

function AIDashboardIntent({ intent }: { intent: ActionIntent }): React.ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
        >
          <BarChart3 className="h-4 w-4" />
          {intent.label || 'Open Dashboard'}
        </button>
      </div>
      {open && createPortal(
        <AIDashboardPanel payload={intent.payload} onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  )
}

function AIDashboardPanel({
  payload,
  onClose,
}: {
  payload: Record<string, unknown>
  onClose: () => void
}): React.ReactElement {
  const portfolio = (payload.portfolio ?? {}) as {
    total_rooms?: number; occupied_rooms?: number; vacant_rooms?: number
    maintenance_rooms?: number; occupancy_rate?: number
  }
  const revenue = (payload.revenue ?? {}) as {
    this_month?: number; last_month?: number; expected?: number
    collection_rate?: number; growth_pct?: number
  }
  const maintenance = (payload.maintenance ?? {}) as { open_total?: number; urgent?: number; high?: number }
  const overdue = (payload.overdue ?? {}) as { count?: number; total_balance?: number }
  const properties = (payload.properties ?? []) as Array<Record<string, unknown>>

  const occupancyRate = Math.min(100, Number(portfolio.occupancy_rate ?? 0))
  const collectionRate = Math.min(100, Number(revenue.collection_rate ?? 0))
  const fmtKES = (v: number) => `KES ${v.toLocaleString()}`

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="h-5 w-5 text-violet-600" />
            <h2 className="text-base font-bold text-foreground">Portfolio Health</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close dashboard"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto p-5">
          <div className="space-y-5">
            {/* Overdue alert — clickable to payments page */}
            {(overdue.count ?? 0) > 0 && (
              <a
                href="/admin/payments?status=overdue"
                className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:hover:bg-red-950/50"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    {overdue.count} overdue payment{(overdue.count ?? 0) > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Total balance: {fmtKES(overdue.total_balance ?? 0)}
                  </p>
                </div>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              </a>
            )}

            {/* Occupancy */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Occupancy</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Total Rooms', value: portfolio.total_rooms ?? 0, cls: 'from-violet-50 to-purple-100/60 dark:from-violet-950/30', href: '/admin/rooms' },
                  { label: 'Occupied', value: portfolio.occupied_rooms ?? 0, cls: 'from-emerald-50 to-teal-100/60 dark:from-emerald-950/30', href: '/admin/rooms?status=occupied' },
                  { label: 'Vacant', value: portfolio.vacant_rooms ?? 0, cls: 'from-amber-50 to-orange-100/60 dark:from-amber-950/30', href: '/admin/rooms?status=vacant' },
                  { label: 'Maintenance', value: portfolio.maintenance_rooms ?? 0, cls: 'from-red-50 to-rose-100/60 dark:from-red-950/30', href: '/admin/maintenance' },
                ].map(({ label, value, cls, href }) => (
                  <a key={label} href={href} className={`rounded-xl border border-border bg-gradient-to-br p-3 transition hover:shadow-sm ${cls}`}>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
                  </a>
                ))}
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Occupancy rate</span>
                  <span className="font-semibold text-foreground">{occupancyRate.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${occupancyRate >= 80 ? 'bg-emerald-500' : occupancyRate >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                    style={{ width: `${occupancyRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Revenue */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Revenue</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'This Month', value: fmtKES(revenue.this_month ?? 0), cls: 'from-blue-50 to-sky-100/60 dark:from-blue-950/30', href: '/admin/payments' },
                  { label: 'Expected', value: fmtKES(revenue.expected ?? 0), cls: 'from-indigo-50 to-violet-100/60 dark:from-indigo-950/30', href: '/admin/payments' },
                ].map(({ label, value, cls, href }) => (
                  <a key={label} href={href} className={`rounded-xl border border-border bg-gradient-to-br p-3 transition hover:shadow-sm ${cls}`}>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-base font-bold text-foreground">{value}</p>
                  </a>
                ))}
              </div>
              {(revenue.growth_pct ?? 0) !== 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{revenue.growth_pct}% vs last month</span>
                </div>
              )}
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Collection rate</span>
                  <span className="font-semibold text-foreground">{collectionRate.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${collectionRate >= 80 ? 'bg-emerald-500' : collectionRate >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                    style={{ width: `${collectionRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Maintenance — tiles link to maintenance page */}
            {(maintenance.open_total ?? 0) > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Maintenance</p>
                <div className="flex gap-2">
                  {[
                    { label: 'Open', value: maintenance.open_total ?? 0, href: '/admin/maintenance' },
                    { label: 'Urgent', value: maintenance.urgent ?? 0, href: '/admin/maintenance?priority=urgent' },
                    { label: 'High', value: maintenance.high ?? 0, href: '/admin/maintenance?priority=high' },
                  ].map(({ label, value, href }) => (
                    <a key={label} href={href} className="flex-1 rounded-xl border border-border bg-amber-50/60 p-3 text-center transition hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-950/40">
                      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{value}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Per-property breakdown — latest 5, scrollable, each row links to property page */}
            {properties.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Properties
                    {properties.length > 5 && (
                      <span className="ml-1.5 font-normal normal-case text-muted-foreground/70">
                        (showing 5 of {properties.length})
                      </span>
                    )}
                  </p>
                  <a
                    href="/admin/properties"
                    className="text-[11px] font-semibold text-violet-600 hover:underline dark:text-violet-400"
                  >
                    View all →
                  </a>
                </div>
                <div className="overflow-hidden rounded-xl border border-border">
                  {/* Sticky header */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                    <span>Property</span>
                    <span className="w-14 text-right">Rooms</span>
                    <span className="w-16 text-right">Occupied</span>
                    <span className="w-12 text-right">Rate</span>
                  </div>
                  {/* Scrollable body — max 5 rows visible */}
                  <div className="max-h-[230px] overflow-y-auto divide-y divide-border">
                    {properties.slice(0, 5).map((p, i) => {
                      const rate = Number(p.occupancy_rate ?? 0)
                      const href = `/admin/properties/${p.slug ?? p.id ?? ''}`
                      const rateClass = rate >= 80
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : rate >= 50
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-500'
                      return (
                        <a
                          key={i}
                          href={href}
                          className="grid grid-cols-[1fr_auto_auto_auto] items-center px-3 py-2.5 text-xs transition hover:bg-muted/40"
                        >
                          <span className="min-w-0 truncate font-medium text-foreground">{String(p.name ?? '—')}</span>
                          <span className="w-14 text-right text-muted-foreground">{String(p.total_rooms ?? 0)}</span>
                          <span className="w-16 text-right text-muted-foreground">{String(p.occupied_rooms ?? 0)}</span>
                          <span className={`w-12 text-right font-semibold ${rateClass}`}>{rate.toFixed(0)}%</span>
                        </a>
                      )
                    })}
                  </div>
                  {/* Footer — view all if more than 5 */}
                  {properties.length > 5 && (
                    <a
                      href="/admin/properties"
                      className="flex items-center justify-center gap-1.5 border-t border-border px-3 py-2.5 text-xs font-semibold text-violet-600 transition hover:bg-muted/30 dark:text-violet-400"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View all {properties.length} properties
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AISuperAdminDashboardIntent({ intent }: { intent: ActionIntent }): React.ReactElement {
  return (
    <div className="mt-3">
      <a
        href="/superadmin/dashboard"
        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
      >
        <BarChart3 className="h-4 w-4" />
        {intent.label || 'Open Platform Dashboard'}
      </a>
    </div>
  )
}

// ── Payment confirmation filter ───────────────────────────────────────────
const PAYMENT_CONFIRM_RE = /yes.*proceed|confirm.*pay|proceed.*pay|initiate.*pay|pay now/i
function filterPaymentSuggestions(suggestions?: string[]): string[] | undefined {
  if (!suggestions?.length) return undefined
  const filtered = suggestions.filter((s) => !PAYMENT_CONFIRM_RE.test(s))
  return filtered.length ? filtered : undefined
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return digits
  return `${digits.slice(0, 4)}***${digits.slice(-2)}`
}

// ── Payment confirm card ──────────────────────────────────────────────────
function AIPaymentConfirmCard({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const { pushMessage } = useAIStore()
  const payloadPhone = intent.payload.phone_number as string | null | undefined
  const [phone, setPhone] = useState(payloadPhone ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'submitted' | 'dismissed'>('idle')
  const [pollRef, setPollRef] = useState<{ reference: string; payType: string } | null>(null)

  if (status === 'dismissed') return null

  const payType = intent.type === 'initiate_rent_payment' ? 'rent' : 'subscription'
  const invoiceUuid = intent.payload.invoice_uuid as string
  const amount = intent.payload.amount as number
  const label = intent.label || `Confirm & Pay ${amount.toLocaleString()}`

  const handleConfirm = async () => {
    if (!phone.trim()) { setError('Enter your M-Pesa phone number.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const result = await aiPaymentApi.initiate({
        type: payType as 'rent' | 'subscription',
        invoice_uuid: invoiceUuid,
        amount,
        phone_number: phone.trim(),
      })
      const display = result.phone_display ?? maskPhone(phone)
      const mid = `pay-sent-${Date.now().toString(36)}`
      pushMessage({
        id: mid,
        role: 'assistant',
        content: `M-Pesa PIN request sent to ${display}. Enter your PIN on your phone. I'll track and confirm.`,
        createdAt: new Date().toISOString(),
      })
      setPollRef({ reference: result.payment_reference, payType })
      setStatus('submitted')
    } catch (err) {
      const msg = isApiError(err as Error) ? getErrorMessage(err as Error) : 'Payment failed. Please try again.'
      setError(msg || 'Payment failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'submitted' && pollRef) {
    return <AIPaymentPoller reference={pollRef.reference} payType={pollRef.payType} />
  }

  return (
    <div className="mt-3 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4 dark:border-violet-400/25 dark:from-violet-950/40 dark:to-indigo-950/40">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-800/40">
          <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        </div>
        <div>
          <p className="text-xs font-bold text-violet-800 dark:text-violet-200">📱 M-Pesa STK Push</p>
          <p className="text-xs text-violet-600 dark:text-violet-400">
            {amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            {payloadPhone ? ` → ${maskPhone(payloadPhone)}` : ''}
          </p>
        </div>
      </div>

      {/* Phone input */}
      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-semibold text-violet-700 dark:text-violet-300">
          {payloadPhone ? 'M-Pesa Number (editable)' : 'Enter your M-Pesa number'}
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-violet-300/60 bg-white px-3 py-2 dark:border-violet-400/20 dark:bg-white/[0.06]">
          <Phone className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0712 345 678"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {error && (
        <p className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={submitting}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
            : <><CheckCircle className="h-3.5 w-3.5" /> {label}</>}
        </button>
        <button
          type="button"
          onClick={() => setStatus('dismissed')}
          disabled={submitting}
          className="rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50 dark:border-violet-400/20 dark:bg-white/[0.06] dark:text-violet-200 dark:hover:bg-violet-400/10"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Payment poller ────────────────────────────────────────────────────────
function AIPaymentPoller({ reference, payType }: { reference: string; payType: string }): React.ReactElement | null {
  const { pushMessage } = useAIStore()
  const [attempts, setAttempts] = useState(0)
  const [done, setDone] = useState(false)
  const MAX_ATTEMPTS = 12
  const POLL_MS = 5000

  useEffect(() => {
    if (done || attempts >= MAX_ATTEMPTS) {
      if (!done && attempts >= MAX_ATTEMPTS) {
        setDone(true)
        pushMessage({
          id: `poll-timeout-${Date.now().toString(36)}`,
          role: 'assistant',
          content: "We haven't received confirmation yet. Check your M-Pesa messages or visit the Payments page.",
          createdAt: new Date().toISOString(),
          suggestions: ['Check payment status'],
        })
      }
      return
    }

    const timer = window.setTimeout(() => {
      void aiPaymentApi.status(payType, reference)
        .then((result) => {
          if (result.confirmed) {
            setDone(true)
            const amountStr = result.amount ? result.amount.toLocaleString() : ''
            const detail = result.month ? ` for ${result.month}` : result.plan ? ` (${result.plan})` : ''
            pushMessage({
              id: `poll-ok-${Date.now().toString(36)}`,
              role: 'assistant',
              content: `Payment confirmed! ${amountStr ? `KES ${amountStr}` : 'Your payment'}${detail} is now cleared.`,
              createdAt: new Date().toISOString(),
            })
          } else if (result.status === 'failed') {
            setDone(true)
            pushMessage({
              id: `poll-fail-${Date.now().toString(36)}`,
              role: 'assistant',
              content: 'Payment was not completed. Please try again or use the Payments page.',
              createdAt: new Date().toISOString(),
            })
          } else {
            setAttempts((a) => a + 1)
          }
        })
        .catch(() => setAttempts((a) => a + 1))
    }, POLL_MS)

    return () => window.clearTimeout(timer)
  }, [attempts, done, reference, payType, pushMessage])

  if (done) return null

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-950/30">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
      <p className="text-xs text-blue-700 dark:text-blue-300">Waiting for M-Pesa confirmation…</p>
      <span className="ml-auto text-[10px] text-blue-400 dark:text-blue-600">{attempts}/{MAX_ATTEMPTS}</span>
    </div>
  )
}

// ── Invite actions card ───────────────────────────────────────────────────

interface InviteActionData {
  pdf_export_id?: string
  pdf_url?: string
  whatsapp_group_link?: string
  invite_count?: number
  expires_at?: string
  property_name?: string
}

async function openInvitePdf(exportId: string, token: string | null | undefined): Promise<void> {
  if (!exportId) return
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`/api/v1/admin/invites/exports/${exportId}/download`, { headers })
  if (!res.ok) return
  const json = (await res.json()) as { data?: { url?: string } }
  const url = json.data?.url
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

function AIInviteActions({
  data,
  token,
}: {
  data: Record<string, unknown>
  token?: string | null
}): React.ReactElement | null {
  const d = data as InviteActionData
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState(false)

  if (!d.pdf_export_id && !d.whatsapp_group_link) return null

  const handlePdf = async () => {
    if (!d.pdf_export_id) return
    setPdfLoading(true)
    setPdfError(false)
    try {
      await openInvitePdf(d.pdf_export_id, token)
    } catch {
      setPdfError(true)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {/* Summary line */}
      {(d.invite_count != null || d.expires_at || d.property_name) && (
        <p className="text-[0.7rem] text-muted-foreground">
          {d.property_name && <span className="font-semibold text-foreground">{d.property_name} · </span>}
          {d.invite_count != null && <span>{d.invite_count} invite{d.invite_count !== 1 ? 's' : ''} · </span>}
          {d.expires_at && <span>expires {d.expires_at}</span>}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {d.pdf_export_id && (
          <button
            type="button"
            onClick={() => void handlePdf()}
            disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-60"
          >
            {pdfLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <FileText className="h-3.5 w-3.5" />}
            Open PDF
          </button>
        )}
        {d.whatsapp_group_link && (
          <a
            href={d.whatsapp_group_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Share on WhatsApp
          </a>
        )}
      </div>
      {pdfError && (
        <p className="text-[0.68rem] text-red-500">Could not open PDF. Try again.</p>
      )}
    </div>
  )
}

function AISuggestions({
  suggestions,
  onSelect,
}: {
  suggestions?: string[]
  onSelect: (s: string) => void
}): React.ReactElement | null {
  const filtered = filterPaymentSuggestions(suggestions)
  if (!filtered?.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {filtered.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200 dark:hover:bg-violet-400/20"
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}

// ── Chart skeleton (shown while AI is thinking) ───────────────────────────

function AIChartSkeleton(): React.ReactElement {
  return (
    <div className="mt-3 w-full animate-pulse space-y-2 border-t border-slate-200/50 pt-3 dark:border-white/8">
      {/* Fake bar chart */}
      <div className="overflow-hidden rounded-2xl border border-border/40 border-l-[4px] border-l-violet-400/30">
        <div className="flex items-center gap-2.5 border-b border-border/30 px-4 py-2.5">
          <div className="h-3.5 w-3.5 rounded bg-muted/70" />
          <div className="h-2.5 w-28 rounded-full bg-muted/70" />
          <div className="ml-auto h-2.5 w-12 rounded-full bg-muted/45" />
        </div>
        <div className="flex items-end gap-1.5 px-4 pb-4 pt-3" style={{ height: 90 }}>
          {[58, 83, 44, 96, 65, 79, 52, 87].map((pct, i) => (
            <div key={i} className="flex-1 rounded-t-[5px] bg-muted/55" style={{ height: `${pct}%` }} />
          ))}
        </div>
      </div>
      {/* Fake line/area chart */}
      <div className="overflow-hidden rounded-2xl border border-border/40 border-l-[4px] border-l-sky-400/30">
        <div className="flex items-center gap-2.5 border-b border-border/30 px-4 py-2.5">
          <div className="h-3.5 w-3.5 rounded bg-muted/70" />
          <div className="h-2.5 w-36 rounded-full bg-muted/70" />
          <div className="ml-auto h-2.5 w-12 rounded-full bg-muted/45" />
        </div>
        <div className="px-4 pb-4 pt-3">
          <div className="h-14 rounded-xl bg-muted/40" />
          <div className="mt-2.5 flex justify-between">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-2 w-7 rounded-full bg-muted/45" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Chart grid ────────────────────────────────────────────────────────────

function AIChartsGenerating({ count }: { count: number }): React.ReactElement {
  const steps = [
    'Collecting data records',
    'Analyzing metrics',
    'Processing calculations',
    count > 1 ? `Building ${count} visualizations` : 'Building visualization',
    'Preparing final output',
  ]
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= steps.length) return
    const t = window.setTimeout(() => setStep((s) => s + 1), 580)
    return () => window.clearTimeout(t)
  }, [step, steps.length])

  const progress = Math.min(Math.round((step / steps.length) * 100), 100)
  const isDone = step >= steps.length

  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <div className="overflow-hidden rounded-2xl border border-violet-200/50 bg-violet-50/50 p-4 dark:border-violet-500/20 dark:bg-[hsl(var(--card))]">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className={`h-3.5 w-3.5 text-violet-500 ${!isDone ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-semibold text-foreground">
            {isDone ? 'Almost ready! Finalizing…' : `Creating visual${count > 1 ? 's' : ''}…`}
          </span>
        </div>

        {/* Checklist */}
        <div className="space-y-1.5">
          {steps.map((label, i) => (
            <div
              key={label}
              className={`flex items-center gap-2 text-[0.7rem] transition-opacity duration-300 ${i > step ? 'opacity-25' : 'opacity-100'}`}
            >
              {i < step ? (
                <CheckCircle className="h-3 w-3 shrink-0 text-emerald-500" />
              ) : i === step ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-violet-500" />
              ) : (
                <span className="flex h-3 w-3 shrink-0 items-center justify-center">
                  <span className="h-2.5 w-2.5 rounded-full border border-muted-foreground/40" />
                </span>
              )}
              <span className={i < step ? 'text-muted-foreground line-through decoration-muted-foreground/40' : i === step ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-3.5 space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-violet-100 dark:bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[0.62rem] text-muted-foreground">
            {isDone
              ? 'Almost ready! Finalizing your dashboard…'
              : step > 2
                ? 'Almost ready! Finalizing your dashboard…'
                : 'Analyzing your data…'}
          </p>
        </div>
      </div>
    </div>
  )
}

function AIChartGrid({ visuals, animate }: { visuals: AIVisual[]; animate?: boolean }): React.ReactElement | null {
  if (!visuals.length) return null
  return (
    <div className="mt-3 min-w-0 w-full space-y-2.5 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {visuals.map((visual, idx) => (
        <motion.div
          key={`${visual.title}-${idx}`}
          initial={animate ? { opacity: 0, y: 10, scale: 0.98 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.48, delay: idx * 0.13, ease: [0.22, 1, 0.36, 1] }}
        >
          <AgentChartRenderer visual={visual} />
        </motion.div>
      ))}
    </div>
  )
}

// ── Agent action approval cards ────────────────────────────────────────────

function AIActionCards({ actions, token }: { actions: AgentAction[]; token?: string | null }): React.ReactElement | null {
  const [dismissed, setDismissed] = useState<Set<string | number>>(new Set())
  const [loading, setLoading] = useState<Record<string | number, boolean>>({})
  const [errors, setErrors] = useState<Record<string | number, string>>({})

  const visible = actions.filter((a) => !dismissed.has(a.id))
  if (!visible.length) return null

  const postUrl = async (url: string, actionId: string | number, label: 'approve' | 'dismiss') => {
    setLoading((prev) => ({ ...prev, [actionId]: true }))
    setErrors((prev) => ({ ...prev, [actionId]: '' }))
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      setDismissed((prev) => new Set([...prev, actionId]))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      setErrors((prev) => ({ ...prev, [actionId]: `${label === 'approve' ? 'Approve' : 'Dismiss'} failed: ${msg}` }))
    } finally {
      setLoading((prev) => ({ ...prev, [actionId]: false }))
    }
  }

  const severityClass = (severity?: string) => {
    if (severity === 'high') return 'bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300'
    if (severity === 'medium') return 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'
    return 'bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-slate-400'
  }

  return (
    <div className="mt-3 space-y-2.5 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">Pending Approvals</p>
      {visible.map((action) => {
        const approveBtn = action.buttons.find((b) => b.action === 'approve') ?? action.buttons[0]
        const dismissBtn = action.buttons.find((b) => b.action !== 'approve') ?? action.buttons[1]
        const busy = loading[action.id] ?? false
        const pct = Math.round(action.confidence * 100)
        return (
          <div key={action.id} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-xs font-semibold text-foreground">{action.title}</p>
                  {action.severity && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold uppercase ${severityClass(action.severity)}`}>
                      {action.severity}
                    </span>
                  )}
                  <span className="text-[0.6rem] text-muted-foreground">{pct}%</span>
                </div>
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{action.description}</p>
                {action.entity && (
                  <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                    {action.entity.type} #{action.entity.id}
                  </p>
                )}
                <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{action.created_at}</p>
              </div>
            </div>
            {errors[action.id] && (
              <p className="px-3 pb-1 text-[0.65rem] font-medium text-red-500">{errors[action.id]}</p>
            )}
            <div className="flex gap-2 border-t border-border px-3 py-2">
              {approveBtn && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void postUrl(approveBtn.url, action.id, 'approve')}
                  className="flex-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Processing…' : approveBtn.label}
                </button>
              )}
              {dismissBtn && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void postUrl(dismissBtn.url, action.id, 'dismiss')}
                  className="flex-1 rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {dismissBtn.label}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── New action_intent renderers ────────────────────────────────────────────

function AIAmenitiesMapIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    amenities?: Array<{ name: string; distance?: number; unit?: string }>
    embed_url?: string
    maps_url?: string
    property_name?: string
  }
  if (!p.amenities?.length && !p.embed_url) return null
  return (
    <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.property_name && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <MapPin className="h-3.5 w-3.5 text-violet-500" />
          {p.property_name}
        </p>
      )}
      {p.amenities && p.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.amenities.map((a) => (
            <span
              key={a.name}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[0.7rem] font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200"
            >
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              {a.name}
              {a.distance != null && (
                <span className="ml-1 text-blue-400">{a.distance}{a.unit ?? 'm'}</span>
              )}
            </span>
          ))}
        </div>
      )}
      {p.embed_url && (
        <div className="overflow-hidden rounded-xl border border-border">
          <iframe
            src={p.embed_url}
            title="Amenities map"
            className="h-40 w-full"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      {p.maps_url && (
        <a
          href={p.maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
        >
          <Navigation className="h-3.5 w-3.5" />
          Open in Maps
        </a>
      )}
    </div>
  )
}

function AIListingPricingIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    monthly_rent?: number
    deposit?: number
    currency?: string
    listing_slug?: string
    listing_id?: string
    property_name?: string
    available_from?: string
  }
  const currency = p.currency ?? 'KES'
  const fmt = (v: number) => `${currency} ${v.toLocaleString()}`
  if (p.monthly_rent == null && p.deposit == null) return null
  return (
    <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.property_name && (
        <p className="text-xs font-semibold text-foreground">{p.property_name}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {p.monthly_rent != null && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-400/20 dark:bg-emerald-400/10">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Monthly Rent</p>
            <p className="mt-0.5 text-base font-bold text-emerald-800 dark:text-emerald-100">{fmt(p.monthly_rent)}</p>
          </div>
        )}
        {p.deposit != null && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/20 dark:bg-amber-400/10">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">Deposit</p>
            <p className="mt-0.5 text-base font-bold text-amber-800 dark:text-amber-100">{fmt(p.deposit)}</p>
          </div>
        )}
      </div>
      {p.available_from && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Available from {p.available_from}
        </p>
      )}
      {p.listing_slug && (
        <a
          href={publicListingUrl(p.listing_slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View listing
        </a>
      )}
    </div>
  )
}

function AIViewSafetyMapIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    security_features?: string[]
    police_maps_link?: string
    safety_rating?: string
    property_name?: string
  }
  if (!p.security_features?.length && !p.police_maps_link) return null
  const ratingColor = p.safety_rating === 'HIGH'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : p.safety_rating === 'MEDIUM'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
  return (
    <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-violet-500" />
        {p.property_name && <span className="text-xs font-semibold text-foreground">{p.property_name}</span>}
        {p.safety_rating && (
          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase ${ratingColor}`}>
            {p.safety_rating} safety
          </span>
        )}
      </div>
      {p.security_features && p.security_features.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.security_features.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[0.7rem] font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              <Shield className="h-2.5 w-2.5 shrink-0 text-violet-500" />
              {f}
            </span>
          ))}
        </div>
      )}
      {p.police_maps_link && (
        <a
          href={p.police_maps_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <MapIcon className="h-3.5 w-3.5" />
          View on Safety Map
        </a>
      )}
    </div>
  )
}

function AIExploreNeighbourhoodIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    embed_url?: string
    map_links?: Array<{ label: string; url: string }>
    property_name?: string
    description?: string
  }
  if (!p.embed_url && !p.map_links?.length) return null
  return (
    <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.property_name && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <MapIcon className="h-3.5 w-3.5 text-violet-500" />
          Neighbourhood: {p.property_name}
        </p>
      )}
      {p.description && (
        <p className="text-xs text-muted-foreground">{p.description}</p>
      )}
      {p.embed_url && (
        <div className="overflow-hidden rounded-xl border border-border">
          <iframe
            src={p.embed_url}
            title="Neighbourhood map"
            className="h-44 w-full"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      {p.map_links && p.map_links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {p.map_links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200"
            >
              <Navigation className="h-3 w-3" />
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function AIEnquireAvailabilityIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    status?: string
    available_from?: string
    room_number?: string
    property_name?: string
  }
  if (!p.status) return null
  const status = (p.status ?? '').toLowerCase()
  const badgeCls =
    status === 'available'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-400/20'
      : status === 'maintenance'
        ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-400/20'
        : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-400/20'
  const label =
    status === 'available' ? 'Available' : status === 'maintenance' ? 'Maintenance' : 'Occupied'
  return (
    <div className="mt-3 space-y-2.5 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        {p.property_name && (
          <span className="text-xs font-semibold text-foreground">{p.property_name}</span>
        )}
        {p.room_number && (
          <span className="text-xs text-muted-foreground">Room {p.room_number}</span>
        )}
        <span className={`rounded-full border px-2.5 py-0.5 text-[0.7rem] font-bold uppercase ${badgeCls}`}>
          {label}
        </span>
      </div>
      {p.available_from && status !== 'available' && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Expected available: {p.available_from}
        </p>
      )}
      {status === 'available' && p.available_from && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Available from {p.available_from}
        </p>
      )}
    </div>
  )
}

function AICompareListingsIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    listings?: Array<{
      id?: string | number
      name?: string
      slug?: string
      monthly_rent?: number
      deposit?: number
      image_url?: string
      rooms?: number
      location?: string
      currency?: string
    }>
  }
  if (!p.listings?.length) return null
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        Compare Listings
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {p.listings.map((listing, idx) => {
          const currency = listing.currency ?? 'KES'
          const href = listing.slug ? `/listings/${listing.slug}` : listing.id ? `/listings/${listing.id}` : '#'
          return (
            <a
              key={listing.id ?? idx}
              href={href}
              className="flex w-44 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-md"
            >
              {listing.image_url ? (
                <img
                  src={listing.image_url}
                  alt={listing.name ?? 'Listing'}
                  className="h-24 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-24 w-full items-center justify-center bg-muted">
                  <Home className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="space-y-0.5 p-2.5">
                {listing.name && (
                  <p className="truncate text-xs font-semibold text-foreground">{listing.name}</p>
                )}
                {listing.location && (
                  <p className="flex items-center gap-1 truncate text-[0.65rem] text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {listing.location}
                  </p>
                )}
                {listing.monthly_rent != null && (
                  <p className="text-[0.7rem] font-bold text-emerald-700 dark:text-emerald-400">
                    {currency} {listing.monthly_rent.toLocaleString()}<span className="font-normal text-muted-foreground">/mo</span>
                  </p>
                )}
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}

function AIListingVerificationIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | string
    positives?: string[]
    red_flags?: string[]
    property_name?: string
    verified?: boolean
  }
  if (!p.risk_level && !p.positives?.length && !p.red_flags?.length) return null
  const risk = (p.risk_level ?? '').toUpperCase()
  const riskCls =
    risk === 'LOW'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-400/20'
      : risk === 'MEDIUM'
        ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-400/20'
        : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-400/20'
  return (
    <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        {p.property_name && (
          <span className="text-xs font-semibold text-foreground">{p.property_name}</span>
        )}
        {risk && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-bold uppercase ${riskCls}`}>
            <AlertTriangle className="h-2.5 w-2.5" />
            {risk} risk
          </span>
        )}
        {p.verified && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-[0.7rem] font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-900/30 dark:text-emerald-300">
            <CheckCircle className="h-2.5 w-2.5" />
            Verified
          </span>
        )}
      </div>
      {p.positives && p.positives.length > 0 && (
        <div className="space-y-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Positives</p>
          <ul className="space-y-0.5">
            {p.positives.map((pos) => (
              <li key={pos} className="flex items-start gap-1.5 text-xs text-foreground">
                <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                {pos}
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.red_flags && p.red_flags.length > 0 && (
        <div className="space-y-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Red Flags</p>
          <ul className="space-y-0.5">
            {p.red_flags.map((flag) => (
              <li key={flag} className="flex items-start gap-1.5 text-xs text-foreground">
                <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Maintenance Request Intent ────────────────────────────────────────────────

function AIMaintenanceRequestIntent({
  intent,
  token,
}: {
  intent: ActionIntent
  token?: string | null
}): React.ReactElement | null {
  const p = intent.payload as {
    category?: string
    priority?: string
    description?: string
    api_endpoint: string
  }

  const [category, setCategory]     = useState(p.category ?? '')
  const [priority, setPriority]     = useState(p.priority ?? 'medium')
  const [description, setDescription] = useState(p.description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState<string | null>(null)

  if (done) {
    return (
      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-950/30">
        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Maintenance request submitted!</p>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!description.trim()) { setError('Please describe the issue.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(p.api_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ description: description.trim(), category, priority }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      setDone(true)
    } catch {
      setError('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const PRIORITIES = [
    { value: 'low',      label: 'Low' },
    { value: 'medium',   label: 'Medium' },
    { value: 'high',     label: 'High' },
    { value: 'critical', label: 'Critical' },
  ]

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-orange-500" />
        <p className="text-xs font-bold text-foreground">Maintenance Request</p>
      </div>

      {category !== '' && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300/50 dark:focus:ring-violet-500/30"
          />
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priority</p>
        <div className="flex gap-1.5">
          {PRIORITIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPriority(value)}
              className={`flex-1 rounded-lg border py-1.5 text-[0.68rem] font-semibold transition ${
                priority === value
                  ? 'border-violet-400 bg-violet-600 text-white shadow-sm'
                  : 'border-border bg-muted/40 text-muted-foreground hover:border-violet-300 hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue in detail…"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300/50 dark:focus:ring-violet-500/30"
        />
      </div>

      {error && <p className="text-[0.68rem] font-medium text-red-500">{error}</p>}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…</> : 'Submit Request'}
      </button>
    </div>
  )
}

// ── Send Tenant Notice Intent ─────────────────────────────────────────────────

function AISendTenantNoticeIntent({
  intent,
  token,
}: {
  intent: ActionIntent
  token?: string | null
}): React.ReactElement | null {
  const p = intent.payload as {
    notice_type?: string
    subject?: string
    template?: string
    api_endpoint: string
  }

  const uniquePlaceholders = useMemo(() => {
    const matches = [...(p.template ?? '').matchAll(/\[([^\]]+)\]/g)]
    return [...new Set(matches.map((m) => m[1]))]
  }, [p.template])

  const [values, setValues]         = useState<Record<string, string>>(
    () => Object.fromEntries(uniquePlaceholders.map((ph) => [ph, ''])),
  )
  const [submitting, setSubmitting] = useState(false)
  const [sentCount, setSentCount]   = useState<number | null>(null)
  const [error, setError]           = useState<string | null>(null)

  const filledTemplate = (p.template ?? '').replace(
    /\[([^\]]+)\]/g,
    (_, name: string) => values[name] || `[${name}]`,
  )

  if (sentCount !== null) {
    return (
      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-950/30">
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Notice sent successfully!</p>
          <p className="mt-0.5 text-[0.7rem] text-emerald-700 dark:text-emerald-300">
            Delivered to {sentCount} tenant{sentCount !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>
    )
  }

  const handleSend = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(p.api_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subject: p.subject,
          body: filledTemplate,
          recipient_type: 'overdue_tenants',
        }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = (await res.json()) as { data?: { sent?: number; count?: number } }
      setSentCount(json.data?.sent ?? json.data?.count ?? 0)
    } catch {
      setError('Failed to send. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-violet-500" />
        <p className="text-xs font-bold text-foreground">
          {p.notice_type ?? 'Tenant Notice'}
          {p.subject && (
            <span className="ml-1.5 font-normal text-muted-foreground">— {p.subject}</span>
          )}
        </p>
      </div>

      {uniquePlaceholders.length > 0 && (
        <div className="space-y-2">
          {uniquePlaceholders.map((ph) => (
            <div key={ph}>
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{ph}</p>
              <input
                type="text"
                value={values[ph] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [ph]: e.target.value }))}
                placeholder={`Enter ${ph.toLowerCase()}`}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300/50"
              />
            </div>
          ))}
        </div>
      )}

      {p.template && (
        <div className="max-h-36 overflow-y-auto rounded-xl border border-border bg-muted/25 px-3 py-2.5">
          <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">Preview</p>
          <p className="whitespace-pre-wrap text-[0.72rem] leading-relaxed text-foreground">{filledTemplate}</p>
        </div>
      )}

      {error && <p className="text-[0.68rem] font-medium text-red-500">{error}</p>}

      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
          : 'Send to All Overdue Tenants'}
      </button>
    </div>
  )
}

// ── Bookings Approved Intent ──────────────────────────────────────────────────

function AIBookingsApprovedIntent({ intent }: { intent: ActionIntent }): React.ReactElement {
  const p = intent.payload as { approved_count?: number; emails_sent?: number }
  const count  = p.approved_count ?? 0
  const emails = p.emails_sent ?? 0
  return (
    <div className="mt-3 space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-950/30">
      <div className="flex items-start gap-2.5">
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            {count} booking{count !== 1 ? 's' : ''} approved
            {emails > 0 && ` — ${emails} welcome email${emails !== 1 ? 's' : ''} sent`}
          </p>
          <p className="mt-0.5 text-[0.68rem] text-emerald-700 dark:text-emerald-400">
            All tenants have been notified.
          </p>
        </div>
      </div>
      <a
        href="/admin/bookings"
        className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-emerald-700 underline decoration-dotted underline-offset-2 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
      >
        View Bookings →
      </a>
    </div>
  )
}

// ── Publish Property Listing Intent ───────────────────────────────────────────

function AIPublishPropertyIntent({
  intent,
  token,
}: {
  intent: ActionIntent
  token?: string | null
}): React.ReactElement | null {
  const p = intent.payload as {
    property_id?: string | number
    property_name?: string
    api_endpoint: string
  }
  const [status, setStatus]   = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError]     = useState<string | null>(null)
  const [listingSlug, setListingSlug] = useState<string | null>(null)

  const handlePublish = async () => {
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch(p.api_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json().catch(() => ({}))
      setListingSlug((json?.data?.slug as string | undefined) ?? null)
      setStatus('done')
    } catch {
      setError('Failed to publish. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="mt-3 space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-950/30">
        <div className="flex items-center gap-2.5">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Property is now live!</p>
        </div>
        {listingSlug && (
          <a
            href={publicListingUrl(listingSlug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-emerald-700 underline decoration-dotted underline-offset-2 dark:text-emerald-300"
          >
            <ExternalLink className="h-3 w-3" />
            View Public Listing
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">
        Publish{' '}
        {p.property_name && (
          <span className="font-semibold text-foreground">{p.property_name}</span>
        )}{' '}
        to the public marketplace?
      </p>
      {error && <p className="text-[0.68rem] font-medium text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={status === 'submitting'}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'submitting'
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing…</>
            : <><ExternalLink className="h-3.5 w-3.5" /> Publish Now</>}
        </button>
      </div>
    </div>
  )
}

// ── Reminders Sent Intent ─────────────────────────────────────────────────────

function AIRemindersSentIntent({ intent }: { intent: ActionIntent }): React.ReactElement {
  const p = intent.payload as { overdue_count?: number; emails_sent?: number }
  const count  = p.overdue_count ?? 0
  const emails = p.emails_sent ?? 0
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-400/20 dark:bg-blue-950/30">
      <Send className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      <p className="text-xs text-blue-800 dark:text-blue-200">
        <span className="font-semibold">Reminders sent</span> to {count} overdue tenant{count !== 1 ? 's' : ''}
        {emails > 0 && ` (${emails} email${emails !== 1 ? 's' : ''})`}.
      </p>
    </div>
  )
}

// ── Hunter map / listing action intents ───────────────────────────────────────

function AIViewPropertyMapIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    maps_url?: string
    embed_url?: string
    property_name?: string
  }
  if (!p.maps_url && !p.embed_url) return null
  return (
    <div className="mt-3 space-y-2.5 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.property_name && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <MapPin className="h-3.5 w-3.5 text-violet-500" />
          {p.property_name}
        </p>
      )}
      {p.embed_url && (
        <div className="overflow-hidden rounded-xl border border-border">
          <iframe
            src={p.embed_url}
            width="100%"
            height="220"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Property map"
          />
        </div>
      )}
      {p.maps_url && (
        <a
          href={p.maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50/70 px-3 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-400/25 dark:bg-violet-900/20 dark:text-violet-300"
        >
          <MapIcon className="h-3.5 w-3.5" />
          View on Google Maps
          <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
        </a>
      )}
    </div>
  )
}

function AIViewDirectionsIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    transit_url?: string
    walking_url?: string
    property_name?: string
    address?: string
  }
  if (!p.transit_url && !p.walking_url) return null
  return (
    <div className="mt-3 space-y-2.5 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.property_name && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Navigation className="h-3.5 w-3.5 text-sky-500" />
          {p.property_name}
        </p>
      )}
      {p.address && (
        <p className="text-[0.7rem] text-muted-foreground">{p.address}</p>
      )}
      <div className="flex gap-2">
        {p.transit_url && (
          <a
            href={p.transit_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-200/80 bg-sky-50/70 px-3 py-2.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-400/25 dark:bg-sky-900/20 dark:text-sky-300"
          >
            🚌 Transit
          </a>
        )}
        {p.walking_url && (
          <a
            href={p.walking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-400/25 dark:bg-emerald-900/20 dark:text-emerald-300"
          >
            🚶 Walking
          </a>
        )}
      </div>
    </div>
  )
}

function AIViewStreetViewIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as { maps_url?: string; property_name?: string }
  if (!p.maps_url) return null
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <a
        href={p.maps_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl border border-sky-200/80 bg-sky-50/70 px-3 py-2.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-400/25 dark:bg-sky-900/20 dark:text-sky-300"
      >
        <Images className="h-3.5 w-3.5" />
        {p.property_name ? `Street View — ${p.property_name}` : 'View Street View'}
        <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
      </a>
    </div>
  )
}

function AIViewListingIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    listing_id?: string | number
    listing_slug?: string
    property_name?: string
    price?: number
    currency?: string
  }
  if (!p.listing_slug) return null
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <a
        href={publicListingUrl(p.listing_slug)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50/70 px-3 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-400/25 dark:bg-violet-900/20 dark:text-violet-300"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="min-w-0 flex-1 truncate">
          {p.property_name ?? 'View Listing'}
          {p.price ? ` — ${p.currency ?? 'KES'} ${p.price.toLocaleString()}/mo` : ''}
        </span>
        <ExternalLink className="shrink-0 h-3 w-3 opacity-60" />
      </a>
    </div>
  )
}

// ── Download PDF Intent ───────────────────────────────────────────────────────

function AIDownloadPdfIntent({
  intent,
  token,
}: {
  intent: ActionIntent
  token?: string | null
}): React.ReactElement | null {
  const p = intent.payload as {
    document_type?: string
    api_endpoint?: string
    filename?: string
  }
  const [status, setStatus] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle')

  if (!p.api_endpoint) return null

  const handleDownload = async () => {
    setStatus('downloading')
    try {
      const res = await fetch(p.api_endpoint!, {
        headers: {
          Accept: 'application/pdf',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = p.filename ?? 'document.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={status === 'downloading'}
        className="flex items-center gap-2 rounded-xl border border-rose-200/80 bg-rose-50/70 px-3 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/25 dark:bg-rose-900/20 dark:text-rose-300"
      >
        {status === 'downloading' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : status === 'done' ? (
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {status === 'downloading'
          ? 'Downloading…'
          : status === 'done'
            ? 'Downloaded!'
            : status === 'error'
              ? 'Download failed — retry'
              : `Download ${p.document_type ?? 'PDF'}`}
      </button>
    </div>
  )
}

// ── Who Am I Profile Card ─────────────────────────────────────────────────────

function AIWhoAmICard({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    name?: string
    role?: string
    email?: string
    organisation?: string
    avatar_url?: string
  }
  if (!p.name) return null

  const initials = p.name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur-sm dark:border-white/[0.07] dark:bg-[hsl(var(--card))]">
      <div className="flex items-center gap-3.5 px-4 py-4">
        {p.avatar_url ? (
          <img
            src={p.avatar_url}
            alt={p.name}
            className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-lg"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-base font-bold text-white shadow-lg">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{p.name}</p>
          {p.role && (
            <div className="mt-1">
              <span className="inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[0.65rem] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                {p.role}
              </span>
            </div>
          )}
          {p.organisation && (
            <p className="mt-1 text-[0.7rem] text-muted-foreground">{p.organisation}</p>
          )}
          {p.email && (
            <p className="text-[0.68rem] text-muted-foreground">{p.email}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Admin/Manager: STK Push confirmation ─────────────────────────────────────

function AISendStkPushIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    phone?: string
    amount?: number
    tenant_name?: string
    invoice_uuid?: string
    currency?: string
  }
  const [phone, setPhone] = useState(p.phone ?? '')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)

  const currency = p.currency ?? 'KES'
  const amount = p.amount ?? 0

  const handleSend = async () => {
    if (!phone.trim()) { setError('Enter a phone number.'); return }
    setStatus('sending')
    setError(null)
    try {
      const res = await apiPost<{ reference?: string; payment_reference?: string }>(
        '/payments/stk',
        { phone_number: phone.trim(), amount, invoice_uuid: p.invoice_uuid },
      )
      setReference(res.data?.reference ?? res.data?.payment_reference ?? null)
      setStatus('sent')
    } catch {
      setError('STK push failed. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-950/30">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            M-Pesa PIN request sent to {maskPhone(phone)}
          </p>
        </div>
        {reference && (
          <p className="text-[0.68rem] text-emerald-700 dark:text-emerald-400">
            Reference: {reference}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4 dark:border-violet-400/25 dark:from-violet-950/40 dark:to-indigo-950/40">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        <p className="text-xs font-bold text-violet-800 dark:text-violet-200">
          Send M-Pesa STK Push
          {p.tenant_name && <span className="ml-1 font-normal text-violet-600 dark:text-violet-400">— {p.tenant_name}</span>}
        </p>
      </div>
      {amount > 0 && (
        <p className="text-sm font-bold text-foreground">
          {currency} {amount.toLocaleString()}
        </p>
      )}
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-violet-700 dark:text-violet-300">
          {p.phone ? 'Phone (editable)' : 'Phone number'}
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-violet-300/60 bg-white px-3 py-2 dark:border-violet-400/20 dark:bg-white/[0.06]">
          <Phone className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XX XXX XXX"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      {error && <p className="text-[0.68rem] font-medium text-red-500">{error}</p>}
      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={status === 'sending'}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'sending'
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
          : <><Send className="h-3.5 w-3.5" /> Send STK Push</>}
      </button>
    </div>
  )
}

// ── Admin/Manager: Approve bookings (confirmation prompt) ─────────────────────

function AIApproveBookingsIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    booking_ids?: (string | number)[]
    count?: number
    property_name?: string
  }
  const count = p.count ?? p.booking_ids?.length ?? 0
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [approved, setApproved] = useState(0)

  if (status === 'done') {
    return (
      <div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-950/30">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            {approved} booking{approved !== 1 ? 's' : ''} approved — welcome emails sent.
          </p>
        </div>
        <a href="/admin/bookings" className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-emerald-700 underline decoration-dotted underline-offset-2 dark:text-emerald-300">
          View Bookings →
        </a>
      </div>
    )
  }

  const handleApprove = async () => {
    setStatus('submitting')
    setError(null)
    try {
      const res = await apiPost<{ approved_count?: number }>('/bookings/bulk-approve', {
        booking_ids: p.booking_ids ?? [],
      })
      setApproved(res.data?.approved_count ?? count)
      setStatus('done')
    } catch {
      setError('Approval failed. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <UsersRound className="h-4 w-4 text-violet-500" />
        <p className="text-xs font-bold text-foreground">Approve Pending Bookings</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Approve <span className="font-semibold text-foreground">{count} pending booking{count !== 1 ? 's' : ''}</span>
        {p.property_name && <> for <span className="font-semibold text-foreground">{p.property_name}</span></>} and send welcome emails?
      </p>
      {error && <p className="text-[0.68rem] font-medium text-red-500">{error}</p>}
      <button
        type="button"
        onClick={() => void handleApprove()}
        disabled={status === 'submitting'}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'submitting'
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Approving…</>
          : <><CheckCircle className="h-3.5 w-3.5" /> Approve & Send Emails</>}
      </button>
    </div>
  )
}

// ── Admin/Manager: Generate notice letter ─────────────────────────────────────

function AIGenerateNoticeIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    letter_text?: string
    document_type?: string
    pdf_url?: string
  }
  const [copied, setCopied] = useState(false)

  if (!p.letter_text && !p.pdf_url) return null

  const handleCopy = async () => {
    if (!p.letter_text) return
    await navigator.clipboard.writeText(p.letter_text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadPdf = () => {
    if (p.pdf_url) {
      window.open(p.pdf_url, '_blank', 'noopener,noreferrer')
      return
    }
    if (!p.letter_text) return
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${p.document_type ?? 'Notice'}</title><style>body{font-family:serif;max-width:680px;margin:3rem auto;line-height:1.7;white-space:pre-wrap}</style></head><body>${p.letter_text.replace(/</g, '&lt;')}</body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.document_type && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <FileText className="h-3.5 w-3.5 text-violet-500" />
          {p.document_type}
        </p>
      )}
      {p.letter_text && (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-muted/20 px-4 py-3">
          <p className="whitespace-pre-wrap font-mono text-[0.7rem] leading-relaxed text-foreground">{p.letter_text}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {p.letter_text && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200"
          >
            {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <FileText className="h-3.5 w-3.5" />}
            {copied ? 'Copied!' : 'Copy Text'}
          </button>
        )}
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500"
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </button>
      </div>
    </div>
  )
}

// ── Admin/Manager: Redirect to invoice create ─────────────────────────────────

function AIGenerateInvoiceIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    hints?: { tenant_id?: string; lease_id?: string; month?: string }
    tenant_name?: string
    property_name?: string
  }
  const h = p.hints ?? {}
  const params = new URLSearchParams()
  if (h.tenant_id) params.set('tenant_id', String(h.tenant_id))
  if (h.lease_id) params.set('lease_id', String(h.lease_id))
  if (h.month) params.set('month', h.month)
  const href = `/admin/invoices/create${params.size ? `?${params.toString()}` : ''}`
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {(p.tenant_name || p.property_name) && (
        <p className="mb-2 text-xs text-muted-foreground">
          {p.tenant_name && <span className="font-semibold text-foreground">{p.tenant_name}</span>}
          {p.tenant_name && p.property_name && ' · '}
          {p.property_name}
          {h.month && ` · ${h.month}`}
        </p>
      )}
      <a
        href={href}
        className="inline-flex items-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50/70 px-3 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-400/25 dark:bg-violet-900/20 dark:text-violet-300"
      >
        <FileText className="h-3.5 w-3.5" />
        Create Invoice
        <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
      </a>
    </div>
  )
}

// ── Admin/Manager: Redirect to maintenance create ─────────────────────────────

function AISendMaintenanceIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    hints?: { property_id?: string; title?: string; description?: string }
    property_name?: string
  }
  const h = p.hints ?? {}
  const params = new URLSearchParams()
  if (h.property_id) params.set('property_id', String(h.property_id))
  if (h.title) params.set('title', h.title)
  if (h.description) params.set('description', h.description)
  const href = `/admin/maintenance/create${params.size ? `?${params.toString()}` : ''}`
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.property_name && (
        <p className="mb-2 text-xs font-semibold text-foreground">{p.property_name}</p>
      )}
      <a
        href={href}
        className="inline-flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-400/25 dark:bg-amber-900/20 dark:text-amber-300"
      >
        <Building2 className="h-3.5 w-3.5" />
        Create Maintenance Request
        <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
      </a>
    </div>
  )
}

// ── Admin/Manager: Send invite PDF ────────────────────────────────────────────

function AISendInvitePdfIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as { pdf_url?: string; property_name?: string }
  if (!p.pdf_url) return null
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.property_name && (
        <p className="mb-2 text-xs font-semibold text-foreground">{p.property_name}</p>
      )}
      <a
        href={p.pdf_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50/70 px-3 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-400/25 dark:bg-violet-900/20 dark:text-violet-300"
      >
        <Download className="h-3.5 w-3.5" />
        Download Invite PDF
        <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
      </a>
    </div>
  )
}

// ── Admin/Manager: WhatsApp invite ────────────────────────────────────────────

function AIWhatsAppInviteIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as { url?: string; property_name?: string }
  if (!p.url) return null
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.property_name && (
        <p className="mb-2 text-xs font-semibold text-foreground">{p.property_name}</p>
      )}
      <a
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-400/25 dark:bg-emerald-900/20 dark:text-emerald-300"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Send WhatsApp Invite
        <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
      </a>
    </div>
  )
}

// ── Admin/Manager: Redirect to listing publish page ───────────────────────────

function AIPublishListingIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as { property_id?: string | number; property_name?: string }
  if (!p.property_id) return null
  const href = `/admin/listings/publish?property_id=${p.property_id}`
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.property_name && (
        <p className="mb-2 text-xs font-semibold text-foreground">{p.property_name}</p>
      )}
      <a
        href={href}
        className="inline-flex items-center gap-2 rounded-xl border border-sky-200/80 bg-sky-50/70 px-3 py-2.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-400/25 dark:bg-sky-900/20 dark:text-sky-300"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Publish Listing
        <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
      </a>
    </div>
  )
}

// ── Admin/Manager: Print / open PDF ──────────────────────────────────────────

function AIPrintPdfIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as { pdf_url?: string; title?: string }
  if (!p.pdf_url && !p.title) return null
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.pdf_url ? (
        <a
          href={p.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-rose-200/80 bg-rose-50/70 px-3 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-400/25 dark:bg-rose-900/20 dark:text-rose-300"
        >
          <Download className="h-3.5 w-3.5" />
          {p.title ?? 'Open PDF'}
          <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
        </a>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
          <Loader2 className="h-3.5 w-3.5 animate-pulse" />
          {p.title ?? 'PDF'} is being generated — check back shortly.
        </div>
      )}
    </div>
  )
}

// ── Admin/Manager: Rent summary card ─────────────────────────────────────────

function AIRentSummaryIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    collected?: number
    outstanding?: number
    overdue?: number
    currency?: string
    month?: string
  }
  const currency = p.currency ?? 'KES'
  const fmt = (v?: number) => v != null ? `${currency} ${v.toLocaleString()}` : '—'
  const total = (p.collected ?? 0) + (p.outstanding ?? 0) + (p.overdue ?? 0)
  const collectionRate = total > 0 ? Math.round(((p.collected ?? 0) / total) * 100) : 0

  return (
    <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      {p.month && (
        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">{p.month}</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-400/20 dark:bg-emerald-950/30">
          <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Collected</p>
          <p className="mt-1 text-sm font-bold text-emerald-800 dark:text-emerald-100">{fmt(p.collected)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/20 dark:bg-amber-950/30">
          <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Outstanding</p>
          <p className="mt-1 text-sm font-bold text-amber-800 dark:text-amber-100">{fmt(p.outstanding)}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-400/20 dark:bg-red-950/30">
          <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Overdue</p>
          <p className="mt-1 text-sm font-bold text-red-800 dark:text-red-100">{fmt(p.overdue)}</p>
        </div>
      </div>
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[0.68rem]">
            <span className="text-muted-foreground">Collection rate</span>
            <span className="font-semibold text-foreground">{collectionRate}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${collectionRate >= 80 ? 'bg-emerald-500' : collectionRate >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
              style={{ width: `${collectionRate}%` }}
            />
          </div>
        </div>
      )}
      <a
        href="/admin/payments"
        className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-violet-600 underline decoration-dotted underline-offset-2 hover:text-violet-800 dark:text-violet-400"
      >
        View all payments →
      </a>
    </div>
  )
}

// ── Tenant: Initiate STK payment ──────────────────────────────────────────────

function AITenantPaymentIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const { pushMessage } = useAIStore()
  const p = intent.payload as {
    amount?: number
    invoice_uuid?: string
    phone_number?: string
    month?: string
    currency?: string
  }
  const [phone, setPhone] = useState(p.phone_number ?? '')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'dismissed'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pollRef, setPollRef] = useState<{ reference: string } | null>(null)

  const currency = p.currency ?? 'KES'
  const amount = p.amount ?? 0

  if (status === 'dismissed') return null

  if (status === 'sent' && pollRef) {
    return <AIPaymentPoller reference={pollRef.reference} payType="rent" />
  }

  const handlePay = async () => {
    if (!phone.trim()) { setError('Enter your M-Pesa number.'); return }
    setStatus('sending')
    setError(null)
    try {
      const res = await apiPost<{ payment_reference?: string; phone_display?: string }>(
        '/tenant/payments/stk',
        { amount, invoice_uuid: p.invoice_uuid, phone_number: phone.trim() },
      )
      const ref = res.data?.payment_reference
      const display = res.data?.phone_display ?? maskPhone(phone)
      pushMessage({
        id: `pay-${Date.now().toString(36)}`,
        role: 'assistant',
        content: `M-Pesa PIN request sent to ${display}. Enter your PIN on your phone.`,
        createdAt: new Date().toISOString(),
      })
      if (ref) setPollRef({ reference: ref })
      setStatus('sent')
    } catch {
      setError('Payment request failed. Please try again.')
      setStatus('idle')
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4 dark:border-violet-400/25 dark:from-violet-950/40 dark:to-indigo-950/40">
      <div className="mb-3 flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        <div>
          <p className="text-xs font-bold text-violet-800 dark:text-violet-200">📱 M-Pesa Payment</p>
          <p className="text-xs text-violet-600 dark:text-violet-400">
            {currency} {amount.toLocaleString()}{p.month ? ` · ${p.month}` : ''}
          </p>
        </div>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-semibold text-violet-700 dark:text-violet-300">
          {p.phone_number ? 'M-Pesa Number (editable)' : 'Enter your M-Pesa number'}
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-violet-300/60 bg-white px-3 py-2 dark:border-violet-400/20 dark:bg-white/[0.06]">
          <Phone className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0712 345 678"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      {error && <p className="mb-2 text-[0.68rem] font-medium text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handlePay()}
          disabled={status === 'sending'}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'sending'
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
            : <><CheckCircle className="h-3.5 w-3.5" /> Pay {currency} {amount.toLocaleString()}</>}
        </button>
        <button
          type="button"
          onClick={() => setStatus('dismissed')}
          className="rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 dark:border-violet-400/20 dark:bg-white/[0.06] dark:text-violet-200"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Tenant: View invoice link ─────────────────────────────────────────────────

function AIViewInvoiceIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    invoice_id?: string | number
    month?: string
    amount?: number
    currency?: string
  }
  if (!p.invoice_id) return null
  const href = `/tenant/invoices/${p.invoice_id}`
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <a
        href={href}
        className="flex items-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50/70 px-3 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-400/25 dark:bg-violet-900/20 dark:text-violet-300"
      >
        <FileText className="h-3.5 w-3.5" />
        <span className="min-w-0 flex-1 truncate">
          View Invoice{p.month ? ` · ${p.month}` : ''}
          {p.amount != null ? ` — ${p.currency ?? 'KES'} ${p.amount.toLocaleString()}` : ''}
        </span>
        <ExternalLink className="shrink-0 h-3 w-3 opacity-60" />
      </a>
    </div>
  )
}

// ── Tenant: View lease link ───────────────────────────────────────────────────

function AIViewLeaseIntent({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  const p = intent.payload as {
    lease_id?: string | number
    property_name?: string
    room_number?: string
  }
  const href = p.lease_id ? `/tenant/lease/${p.lease_id}` : '/tenant/lease'
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <a
        href={href}
        className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-400/25 dark:bg-emerald-900/20 dark:text-emerald-300"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="min-w-0 flex-1 truncate">
          View Lease Agreement
          {p.property_name ? ` — ${p.property_name}` : ''}
          {p.room_number ? ` · Room ${p.room_number}` : ''}
        </span>
        <ExternalLink className="shrink-0 h-3 w-3 opacity-60" />
      </a>
    </div>
  )
}

// ── Tenant: View lease PDF ────────────────────────────────────────────────────

function AIViewLeasePdfIntent({
  intent,
  token,
}: {
  intent: ActionIntent
  token?: string | null
}): React.ReactElement | null {
  const p = intent.payload as {
    api_endpoint?: string
    lease_number?: string
    filename?: string
  }
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'pending' | 'error'>('idle')

  if (!p.api_endpoint) return null

  const handleOpen = async () => {
    setStatus('loading')
    try {
      const res = await fetch(p.api_endpoint!, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (res.status === 202) {
        setStatus('pending')
        return
      }

      if (!res.ok) throw new Error(`${res.status}`)

      const json = (await res.json()) as { data?: { url?: string } }
      const url = json?.data?.url

      if (!url) throw new Error('No PDF URL')

      window.open(url, '_blank', 'noopener,noreferrer')
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
      <button
        type="button"
        onClick={() => void handleOpen()}
        disabled={status === 'loading'}
        className="flex items-center gap-2 rounded-xl border border-rose-200/80 bg-rose-50/70 px-3 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/25 dark:bg-rose-900/20 dark:text-rose-300"
      >
        {status === 'loading' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : status === 'done' ? (
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        {status === 'loading'
          ? 'Opening…'
          : status === 'done'
            ? 'Opened!'
            : status === 'error'
              ? 'Failed to open — tap to retry'
              : status === 'pending'
                ? 'PDF being prepared — try again shortly'
                : p.lease_number
                  ? `Open Lease Agreement ${p.lease_number}`
                  : 'Open Lease Agreement PDF'}
      </button>
      {status === 'pending' && (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Your lease PDF is being generated. Please try again in a moment.
        </p>
      )}
    </div>
  )
}

// ── Tenant: Send message to manager ──────────────────────────────────────────

function AITenantSendMessageIntent({
  intent,
  token,
}: {
  intent: ActionIntent
  token?: string | null
}): React.ReactElement | null {
  const p = intent.payload as {
    manager_id?: string | number
    subject?: string
    body?: string
  }
  const [subject, setSubject] = useState(p.subject ?? '')
  const [body, setBody] = useState(p.body ?? '')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (status === 'sent') {
    return (
      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-950/30">
        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Message sent to your manager.</p>
      </div>
    )
  }

  const handleSend = async () => {
    if (!body.trim()) { setError('Please enter your message.'); return }
    setStatus('sending')
    setError(null)
    try {
      await apiPost('/tenant/messages', {
        manager_id: p.manager_id,
        subject: subject.trim() || undefined,
        body: body.trim(),
      })
      setStatus('sent')
    } catch {
      setError('Failed to send. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-violet-500" />
        <p className="text-xs font-bold text-foreground">Message Your Manager</p>
      </div>
      <div>
        <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Subject (optional)</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Maintenance follow-up"
          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300/50"
        />
      </div>
      <div>
        <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Message</label>
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message here…"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300/50"
        />
      </div>
      {error && <p className="text-[0.68rem] font-medium text-red-500">{error}</p>}
      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={status === 'sending'}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'sending'
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
          : <><Send className="h-3.5 w-3.5" /> Send Message</>}
      </button>
    </div>
  )
}

// ── Tenant: Maintenance request form ─────────────────────────────────────────

function AITenantMaintenanceRequestIntent({
  intent: _intent,
  token: _token,
}: {
  intent: ActionIntent
  token?: string | null
}): React.ReactElement | null {
  type WizardStep = 'title' | 'description' | 'category' | 'priority' | 'confirm'

  const CATEGORIES = [
    { value: 'plumbing',     label: 'Plumbing' },
    { value: 'electrical',   label: 'Electrical' },
    { value: 'furniture',    label: 'Furniture' },
    { value: 'appliance',    label: 'Appliance' },
    { value: 'structural',   label: 'Structural' },
    { value: 'cleaning',     label: 'Cleaning' },
    { value: 'pest_control', label: 'Pest Control' },
    { value: 'repair',       label: 'Repair' },
    { value: 'other',        label: 'Other' },
  ] as const

  const PRIORITIES = [
    { value: 'low',    label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high',   label: 'High' },
  ] as const

  const STEP_ORDER: WizardStep[] = ['title', 'description', 'category', 'priority', 'confirm']

  const [step, setStep]             = useState<WizardStep>('title')
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]     = useState('')
  const [priority, setPriority]     = useState('medium')
  const [status, setStatus]         = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError]           = useState<string | null>(null)

  if (status === 'done') {
    return (
      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-950/30">
        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Maintenance request submitted!</p>
      </div>
    )
  }

  const stepNum = STEP_ORDER.indexOf(step) + 1

  const handleSubmit = async () => {
    setStatus('submitting')
    setError(null)
    try {
      await apiPost('/tenant/maintenance', {
        title:       title.trim(),
        description: description.trim(),
        category:    category || 'other',
        priority,
      })
      setStatus('done')
    } catch {
      setError('Failed to submit. Please try again.')
      setStatus('error')
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300/50'
  const nextCls  = 'flex-[2] rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50'
  const backCls  = 'flex-1 rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition'
  const chipCls  = (active: boolean) =>
    `rounded-lg border py-1.5 text-[0.68rem] font-semibold capitalize transition ${
      active
        ? 'border-violet-400 bg-violet-600 text-white'
        : 'border-border bg-muted/40 text-muted-foreground hover:border-violet-300 hover:text-foreground'
    }`

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-orange-500" />
        <p className="text-xs font-bold text-foreground">Maintenance Request</p>
        {step !== 'confirm' && (
          <span className="ml-auto text-[10px] text-muted-foreground">Step {stepNum} of 4</span>
        )}
      </div>

      {/* Step 1 — Title */}
      {step === 'title' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">What is the title of the issue?</p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) setStep('description') }}
            placeholder="e.g. Leaking kitchen tap"
            className={inputCls}
            autoFocus
          />
          <button
            type="button"
            onClick={() => { if (title.trim()) setStep('description') }}
            disabled={!title.trim()}
            className={`${nextCls} w-full`}
          >
            Next
          </button>
        </div>
      )}

      {/* Step 2 — Description */}
      {step === 'description' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Describe the issue in detail.</p>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. The kitchen tap has been dripping since yesterday morning…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300/50"
            autoFocus
          />
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setStep('title')} className={backCls}>Back</button>
            <button
              type="button"
              onClick={() => { if (description.trim()) setStep('category') }}
              disabled={!description.trim()}
              className={nextCls}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Category */}
      {step === 'category' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">What category does this fall under?</p>
          <div className="grid grid-cols-3 gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => { setCategory(c.value); setStep('priority') }}
                className={chipCls(category === c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep('description')} className="text-[0.68rem] text-muted-foreground hover:text-foreground transition">
            ← Back
          </button>
        </div>
      )}

      {/* Step 4 — Priority */}
      {step === 'priority' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">How urgent is this issue?</p>
          <div className="flex gap-1.5">
            {PRIORITIES.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => { setPriority(v.value); setStep('confirm') }}
                className={`flex-1 ${chipCls(priority === v.value)}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep('category')} className="text-[0.68rem] text-muted-foreground hover:text-foreground transition">
            ← Back
          </button>
        </div>
      )}

      {/* Step 5 — Confirm */}
      {step === 'confirm' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Review your request before submitting.</p>
          <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            {[
              { label: 'Title',       value: title },
              { label: 'Description', value: description },
              { label: 'Category',    value: category.replace('_', ' ') },
              { label: 'Priority',    value: priority },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <span className="w-20 shrink-0 font-semibold capitalize text-muted-foreground">{label}</span>
                <span className="min-w-0 capitalize text-foreground">{value}</span>
              </div>
            ))}
          </div>
          {error && <p className="text-[0.68rem] font-medium text-red-500">{error}</p>}
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setStep('priority')} className={backCls}>Back</button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={status === 'submitting'}
              className={`${nextCls} flex items-center justify-center gap-2`}
            >
              {status === 'submitting'
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…</>
                : 'Submit Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Token usage chip (superadmin only) ──────────────────────────────────────
function AITokenUsageChip({ usage }: {
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}): React.ReactElement {
  return (
    <div className="mt-1.5 flex items-center gap-1 text-[0.65rem] text-muted-foreground/55">
      <Zap className="h-3 w-3 shrink-0 opacity-40" />
      <span>{usage.total_tokens.toLocaleString()} tokens</span>
    </div>
  )
}

function AIRateLimitBanner({ countdown, tier }: { countdown: number; tier: string | null }): React.ReactElement {
  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const display = mins > 0
    ? `${mins}m ${secs.toString().padStart(2, '0')}s`
    : `${secs}s`

  const tierLabel: Record<string, string> = {
    hunter: 'House Hunter',
    tenant: 'Tenant',
    admin: 'Admin',
    org: 'Organisation',
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-orange-200/80 bg-orange-50/90 px-3 py-3 text-sm dark:border-orange-400/20 dark:bg-orange-950/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40">
        <Shield className="h-4 w-4 text-orange-600 dark:text-orange-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-orange-900 dark:text-orange-100">
          {tier ? `${tierLabel[tier] ?? tier} AI limit reached` : 'AI rate limit reached'}
        </p>
        <p className="mt-0.5 text-xs text-orange-700 dark:text-orange-300/80">
          Resume in{' '}
          <span className="font-mono font-bold tabular-nums">{display}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-orange-500 dark:text-orange-400">
          Cooldown
        </div>
      </div>
    </div>
  )
}

// ─── Property map pins (view_dashboard with lat/lng) ─────────────────────────
function AIPropertyMapPins({ intent }: { intent: ActionIntent }): React.ReactElement | null {
  type MapProp = { name?: string; title?: string; lat?: number | string | null; lng?: number | string | null }
  const raw = (intent.payload?.properties as MapProp[] | undefined) ?? []
  const pinnable = raw.filter((p) => {
    const lat = Number(p.lat); const lng = Number(p.lng)
    return Number.isFinite(lat) && lat !== 0 && Number.isFinite(lng) && lng !== 0
  })
  if (pinnable.length === 0) return null
  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">Property Locations</p>
      <div className="space-y-1">
        {pinnable.map((p, i) => {
          const url = `https://www.google.com/maps/search/?api=1&query=${Number(p.lat)},${Number(p.lng)}`
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{p.name ?? p.title ?? `Property ${i + 1}`}</span>
              <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/40" />
            </a>
          )
        })}
      </div>
    </div>
  )
}

// ─── Video tour cards ─────────────────────────────────────────────────────────
function AIVideoTourCards({ listings }: { listings: import('@/api/ai').AIPropertyResult[] }): React.ReactElement | null {
  type TourVideo = { url?: string | null; thumbnail_url?: string | null }
  const tours = listings.flatMap((l) => {
    const first = (l.tour_videos as TourVideo[] | undefined)?.[0]
    if (!first?.url) return []
    return [{ title: l.title, url: first.url as string, thumb: first.thumbnail_url as string | null | undefined }]
  })
  if (tours.length === 0) return null
  return (
    <div className="mt-3 space-y-2">
      {tours.map((t, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
          {/\.mp4($|\?)/.test(t.url) && (
            <video src={t.url} poster={t.thumb ?? undefined} controls preload="metadata"
              className="w-full rounded-t-xl object-cover" style={{ maxHeight: '200px' }} />
          )}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{t.title}</p>
            <a href={t.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[0.7rem] font-bold text-primary-foreground transition hover:bg-primary/90">
              <Play className="h-3 w-3" />
              Watch Tour
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Property comparison table ────────────────────────────────────────────────
type CompProp = {
  name?: string; title?: string
  occupancy_pct?: number | null
  collection_rate?: number | null
  vacancy?: number | null
  [key: string]: unknown
}

function tlColor(v: number | null | undefined): string {
  if (v == null) return 'text-muted-foreground'
  return v >= 90 ? 'text-emerald-600 dark:text-emerald-400' : v >= 70 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'
}
function tlDot(v: number | null | undefined): string {
  if (v == null) return ''
  return v >= 90 ? '🟢' : v >= 70 ? '🟡' : '🔴'
}

function AIPropertyComparisonTable({ properties }: { properties: CompProp[] }): React.ReactElement | null {
  if (properties.length < 2) return null
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-max text-left text-[0.72rem]">
        <thead>
          <tr className="border-b border-border bg-muted/60">
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Property</th>
            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Occupancy</th>
            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Collection</th>
            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Vacancy</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((p, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30">
              <td className="max-w-[9rem] truncate px-3 py-2 font-medium text-foreground">
                {p.name ?? p.title ?? `Property ${i + 1}`}
              </td>
              <td className={`px-3 py-2 text-right font-semibold tabular-nums ${tlColor(p.occupancy_pct)}`}>
                {tlDot(p.occupancy_pct)}{p.occupancy_pct != null ? ` ${p.occupancy_pct}%` : '—'}
              </td>
              <td className={`px-3 py-2 text-right font-semibold tabular-nums ${tlColor(p.collection_rate)}`}>
                {tlDot(p.collection_rate)}{p.collection_rate != null ? ` ${p.collection_rate}%` : '—'}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-muted-foreground">
                {p.vacancy != null ? `${p.vacancy}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
