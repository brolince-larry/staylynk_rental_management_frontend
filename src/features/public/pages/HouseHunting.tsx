import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { ArrowDownToLine, ArrowUpRight, BedDouble, Bot, Car, Check, Home, Loader2, MapPin, Send, ThumbsDown, ThumbsUp, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import { aiApi, type AIAction, type AIChatData, type AIChatMeta, type AIPropertyResult, type AIPropertySearchIntent, type AITable } from '@/api/ai'
import { listingsApi, type PublicListing, type PublicListingsHome } from '@/api/listings'
import { SmartImage } from '@/components/media'
import { apiBaseUrl } from '@/config/env'
import { formatCurrencyCompact } from '@/utils/format'

const SESSION_KEY = 'staylynk_ai_session'
const PLACEHOLDERS = [
  'Search for a bedsitter in Westlands...',
  'Show my rent balance',
  'Find a family home near school in Nakuru',
  'Any vacant units available?',
  'Check pending maintenance',
]

interface HunterMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  data?: AIChatData
  fullyRevealed?: boolean
  sourceQuery?: string
}

export default function HouseHunting(): React.ReactElement {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<HunterMessage[]>([])
  const [sessionToken, setSessionToken] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY))
  const [submitting, setSubmitting] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const [lastAction, setLastAction] = useState('')
  const sessionStartedAt = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const typingCleanup = useRef<(() => void) | null>(null)
  const homeQuery = useQuery({
    queryKey: ['public', 'listings', 'home'],
    queryFn: () => listingsApi.publicHome().then((response) => response.data),
  })

  useEffect(() => {
    sessionStartedAt.current = Date.now()
  }, [])

  useEffect(() => () => {
    typingCleanup.current?.()
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, submitting, isTyping])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(120, Math.max(52, textarea.scrollHeight))}px`
  }, [input])

  useEffect(() => {
    if (sessionToken) sessionStorage.setItem(SESSION_KEY, sessionToken)
  }, [sessionToken])

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!sessionToken || !lastQuery) return
      const body = JSON.stringify({
        session_token: sessionToken,
        last_query: lastQuery,
        last_action: lastAction,
        duration_seconds: Math.round((Date.now() - sessionStartedAt.current) / 1000),
      })
      navigator.sendBeacon(getFeedbackUrl('/ai/feedback/abandon'), new Blob([body], { type: 'application/json' }))
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [lastAction, lastQuery, sessionToken])

  const latestSearch = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant' && isRenderableSearch(message.data)),
    [messages],
  )

  const status = error ? 'error' : submitting ? 'thinking' : isTyping ? 'typing' : 'idle'

  const send = async (override?: string) => {
    const message = (override ?? input).trim()
    if (!message || submitting || isTyping) return

    typingCleanup.current?.()
    typingCleanup.current = null
    setInput('')
    setError(null)
    setSubmitting(true)
    setLastQuery(message)
    setMessages((items) => [
      ...items,
      { id: makeId(), role: 'user', content: message, createdAt: new Date().toISOString() },
    ])

    try {
      const response = await aiApi.chat({
        message,
        role: 'public_hunter',
        session_token: sessionToken,
      })

      if (response.success && response.data) {
        const data = response.data
        const id = makeId()
        const presentation = data.meta?.presentation
        const shouldType = presentation?.typing === true
        const typingSpeedMs = presentation?.typing_speed_ms ?? 16

        if (data.session_token) setSessionToken(data.session_token)
        setLastAction(data.meta?.action ?? '')
        setSubmitting(false)
        setIsTyping(shouldType)
        setMessages((items) => [
          ...items,
          {
            id,
            role: 'assistant',
            content: shouldType ? '' : data.message,
            createdAt: new Date().toISOString(),
            data,
            fullyRevealed: !shouldType,
            sourceQuery: message,
          },
        ])

        if (shouldType) {
          typingCleanup.current = animateWords(data.message, typingSpeedMs, (partial) => {
            setMessages((items) => items.map((item) => item.id === id ? { ...item, content: partial } : item))
          }, () => {
            typingCleanup.current = null
            setIsTyping(false)
            setMessages((items) => items.map((item) => item.id === id ? { ...item, fullyRevealed: true } : item))
          })
        }
      } else {
        const fallback = response.message ?? 'I could not search homes right now. Please try again.'
        setMessages((items) => [...items, { id: makeId(), role: 'assistant', content: fallback, createdAt: new Date().toISOString(), fullyRevealed: true }])
        setError(fallback)
        setSubmitting(false)
      }
    } catch {
      const fallback = 'I could not reach the house-hunting assistant. Please try again.'
      setMessages((items) => [...items, { id: makeId(), role: 'assistant', content: fallback, createdAt: new Date().toISOString(), fullyRevealed: true }])
      setError(fallback)
      setSubmitting(false)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <>
      <Helmet><title>StayLynk AI | House Hunting</title></Helmet>
      <main className="flex h-dvh min-h-dvh bg-background">
        <section className="mx-auto flex h-full w-full max-w-[1180px] flex-col">
          <ChatHeader status={status} />

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,780px)_minmax(300px,1fr)]">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-white/86 shadow-sm dark:bg-card/80">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-card/70 p-5 text-sm text-muted-foreground">
                      Start a conversation with StayLynk AI.
                    </div>
                  ) : null}

                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      sessionToken={sessionToken}
                      onFeedback={(value, reason) => void sendThumbFeedback(message, sessionToken, value, reason)}
                    />
                  ))}

                  {submitting ? <ThinkingOrb /> : null}
                  <div ref={endRef} />
                </div>
              </div>

              <ChatInput
                value={input}
                onChange={setInput}
                onSend={() => void send()}
                onKeyDown={onKeyDown}
                disabled={submitting || isTyping}
                placeholder={PLACEHOLDERS[0]}
                textareaRef={textareaRef}
              />
            </div>

            <aside className="min-h-0 overflow-hidden">
              {latestSearch?.data ? (
                <PropertySearchResults
                  data={latestSearch.data}
                  sessionToken={sessionToken}
                  sourceQuery={latestSearch.sourceQuery ?? lastQuery}
                  onSuggestion={(suggestion) => {
                    setInput(suggestion)
                    void sendSuggestion(suggestion, sessionToken, latestSearch.data?.context?.intent)
                    void send(suggestion)
                  }}
                />
              ) : (
                <BackendListingsPanel data={homeQuery.data} loading={homeQuery.isLoading} />
              )}
            </aside>
          </div>
        </section>
      </main>
    </>
  )
}

function ChatHeader({ status }: { status: 'idle' | 'thinking' | 'typing' | 'error' }): React.ReactElement {
  const label = status === 'thinking' ? 'Thinking...' : status === 'typing' ? 'Typing...' : status === 'error' ? 'Connection issue' : 'StayLynk AI'
  const dot = status === 'thinking'
    ? 'bg-amber-500 animate-pulse'
    : status === 'typing'
      ? 'bg-sky-500'
      : status === 'error'
        ? 'bg-red-500'
        : 'bg-emerald-500'

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-white/90 px-4 py-3 backdrop-blur dark:bg-background/90">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              <h1 className="text-sm font-extrabold text-foreground">{label}</h1>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Property and rental assistant</p>
          </div>
        </div>
        <Link to="/" className="text-xs font-semibold text-primary">StayLynk</Link>
      </div>
    </header>
  )
}

function ChatInput({
  value,
  onChange,
  onSend,
  onKeyDown,
  disabled,
  placeholder,
  textareaRef,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  disabled: boolean
  placeholder: string
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}): React.ReactElement {
  const showCounter = value.length >= 1800

  return (
    <div className="sticky bottom-0 border-t border-border bg-white/94 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur dark:bg-background/94">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-2 shadow-inner">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value.slice(0, 2000))}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="max-h-[120px] min-h-[52px] flex-1 resize-none bg-transparent px-2 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || value.trim().length === 0}
          className="mb-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
        >
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      {showCounter ? <p className="mt-1 text-right text-xs text-muted-foreground">{value.length}/2000</p> : null}
    </div>
  )
}

function MessageBubble({
  message,
  sessionToken,
  onFeedback,
}: {
  message: HunterMessage
  sessionToken: string | null
  onFeedback: (value: 'up' | 'down', reason?: string) => void
}): React.ReactElement {
  const isUser = message.role === 'user'
  const guarded = isGuarded(message.data?.meta)
  const mapUrl = getMapUrlFromText(message.content) ?? message.data?.context?.map_url ?? message.data?.meta?.map_url
  const tables = message.data?.context?.retrieval?.tables ?? message.data?.context?.tables ?? []
  const actions = getPdfActions(message.data)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[75%] ${isUser ? 'text-right' : 'text-left'}`}>
        <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
          {!isUser ? (
            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </span>
          ) : null}
          <div
            className={`rounded-[18px] px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
              isUser
                ? 'rounded-tr-sm bg-primary text-primary-foreground'
                : guarded
                  ? 'rounded-tl-sm border border-red-200 bg-red-50 text-red-950'
                  : 'rounded-tl-sm bg-[#F1F3F5] text-slate-900 dark:bg-[#2A2A3E] dark:text-slate-100'
            }`}
          >
            <MarkdownText text={stripMapUrls(message.content)} />
            {mapUrl && !guarded ? <MapLinkChip url={mapUrl} /> : null}
            {!isUser && message.data?.meta?.confidence_band === 'low' ? (
              <span className="mt-3 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                Needs more detail
              </span>
            ) : null}
          </div>
        </div>

        <div className={`mt-1 text-[13px] text-muted-foreground ${isUser ? 'text-right' : 'pl-9 text-left'}`}>
          {formatTime(message.createdAt)}
          {!isUser && message.data?.meta?.confidence_band === 'medium' ? <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" /> : null}
        </div>

        {!isUser && !guarded && message.fullyRevealed ? (
          <div className="mt-2 pl-9">
            <FeedbackBar onFeedback={onFeedback} />
          </div>
        ) : null}

        {!isUser && !guarded && tables.length > 0 ? (
          <div className="mt-3 pl-9">
            <ComparisonTable table={tables[0]} />
          </div>
        ) : null}

        {!isUser && !guarded && actions.length > 0 ? (
          <div className="mt-3 pl-9">
            <DownloadActionList actions={actions} token={sessionToken} />
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

function ThinkingOrb(): React.ReactElement {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
      <div className="flex max-w-[75%] items-center gap-2 rounded-[18px] rounded-tl-sm bg-[#F1F3F5] px-4 py-3 dark:bg-[#2A2A3E]">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            animate={{ scale: [1, 1.4, 1], opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 0.4, repeat: Infinity, delay: index * 0.15 }}
            className="h-2 w-2 rounded-full bg-primary"
          />
        ))}
      </div>
    </motion.div>
  )
}

function PropertySearchResults({
  data,
  sessionToken,
  sourceQuery,
  onSuggestion,
}: {
  data: AIChatData
  sessionToken: string | null
  sourceQuery: string
  onSuggestion: (suggestion: string) => void
}): React.ReactElement | null {
  if (isGuarded(data.meta)) return null

  const context = data.context
  const properties = context?.properties ?? []
  const suggestions = context?.suggestions ?? []
  const mapUrl = context?.map_url ?? data.meta?.map_url
  const zeroResults = context?.zero_results === true || data.meta?.zero_results === true

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border bg-card p-4 shadow-sm ${zeroResults ? 'border-amber-200 bg-amber-50/45' : 'border-border'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">Search details</p>
            <ActiveFilterChips intent={context?.intent} />
          </div>
          {mapUrl ? <MapLinkChip url={mapUrl} label="View area on Google Maps" /> : null}
        </div>
      </div>

      {properties.length > 0 ? (
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }} className="grid snap-x gap-3 overflow-x-auto sm:grid-cols-2">
          {properties.map((property) => (
            <AIPropertyCard
              key={`${property.id}-${property.slug ?? property.title}`}
              property={property}
              sessionToken={sessionToken}
              query={sourceQuery}
              intent={context?.intent}
            />
          ))}
        </motion.div>
      ) : null}

      {suggestions.length > 0 ? (
        <SuggestionChips suggestions={suggestions} onSuggestion={onSuggestion} prominent={zeroResults} />
      ) : null}
    </div>
  )
}

function SuggestionChips({
  suggestions,
  onSuggestion,
  prominent,
}: {
  suggestions: string[]
  onSuggestion: (suggestion: string) => void
  prominent?: boolean
}): React.ReactElement {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 shadow-sm ${prominent ? 'ring-2 ring-amber-200' : ''}`}>
      <p className="mb-3 text-sm font-bold text-foreground">Suggestions</p>
      <div className="flex snap-x gap-2 overflow-x-auto pb-1">
        {suggestions.map((suggestion) => (
          <motion.button
            key={suggestion}
            type="button"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => onSuggestion(suggestion)}
            className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
          >
            {suggestion}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function AIPropertyCard({
  property,
  sessionToken,
  query,
  intent,
}: {
  property: AIPropertyResult
  sessionToken: string | null
  query: string
  intent?: AIPropertySearchIntent
}): React.ReactElement {
  const location = [property.neighbourhood, property.city, property.county].filter(Boolean).join(', ')
  const price = formatRentRange(property)
  const bedrooms = formatRange(property.bedrooms_min, property.bedrooms_max, 'bed')
  const detailChips = [
    property.house_type,
    bedrooms,
    property.parking_available ? 'Parking' : null,
    property.internet_available ? 'WiFi' : null,
    property.is_family_friendly ? 'Family' : null,
  ].filter(Boolean) as string[]

  return (
    <motion.article
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      className="min-w-[280px] cursor-pointer overflow-hidden rounded-lg border border-border bg-card shadow-sm"
      onClick={() => void sendPropertyClick(property, sessionToken, query, intent)}
    >
      <div className="relative">
        <SmartImage
          src={property.cover_image ?? property.thumbnail ?? null}
          alt={property.title}
          usage="card"
          aspectRatio="4 / 3"
          sizes="(max-width: 768px) 82vw, 360px"
          className="object-cover"
        />
        {property.similarity_score !== null && property.similarity_score !== undefined ? (
          <span className="absolute right-3 top-3 rounded-full bg-white/92 px-2 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm">
            {Math.round(Number(property.similarity_score) * 100)}%
          </span>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h2 className="line-clamp-2 text-sm font-bold text-foreground">{property.title}</h2>
          {location ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{location}</span>
            </p>
          ) : null}
        </div>
        <p className="text-sm font-extrabold text-foreground">{price} / month</p>
        <div className="flex flex-wrap gap-1.5">
          {detailChips.slice(0, 6).map((chip) => (
            <span key={chip} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium capitalize text-muted-foreground">
              {chip === 'Parking' ? <Car className="h-3 w-3" /> : chip === 'WiFi' ? <Wifi className="h-3 w-3" /> : chip?.includes('bed') ? <BedDouble className="h-3 w-3" /> : null}
              {chip.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {property.map_url ? (
            <a
              href={property.map_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
            >
              View on Maps
              <MapPin className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {property.slug ? (
            <Link
              to={`/listings/${property.slug}`}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              View Listing
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>
    </motion.article>
  )
}

function BackendListingsPanel({ data, loading }: { data?: PublicListingsHome; loading: boolean }): React.ReactElement {
  const listings = extractHomeListings(data)

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col overflow-hidden rounded-xl border border-border bg-zinc-950 shadow-sm lg:h-full">
        <div className="absolute left-0 right-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-white/20" />
        </div>
        <div className="h-full animate-pulse bg-zinc-800" />
      </div>
    )
  }

  if (listings.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-zinc-950 p-6 shadow-sm lg:h-full">
        <Home className="h-12 w-12 text-white/20" />
        <p className="text-sm font-semibold text-white/50">No published homes yet</p>
      </div>
    )
  }

  return (
    <div className="relative h-[60vh] overflow-hidden rounded-xl border border-border bg-zinc-950 shadow-sm lg:h-full">
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-4 pb-8 pt-4">
        <p className="text-xs font-bold tracking-wide text-white/90">Homes</p>
        <Link to="/listings" className="text-[11px] font-semibold text-white/60 hover:text-white">Browse all</Link>
      </div>
      <div className="h-full snap-y snap-mandatory overflow-y-auto">
        {listings.slice(0, 12).map((listing, index) => (
          <BackendListingCard key={listing.uuid ?? listing.slug} listing={listing} index={index} total={Math.min(listings.length, 12)} />
        ))}
      </div>
    </div>
  )
}

function BackendListingCard({ listing, index, total }: { listing: PublicListing; index: number; total: number }): React.ReactElement {
  const location = [listing.city].filter(Boolean).join(', ')
  const rent = formatListingRentRange(listing)
  const available = listing.available_units > 0
  const houseType = listing.house_type?.replace(/_/g, ' ')

  return (
    <article className="relative h-full snap-start overflow-hidden bg-zinc-950">
      <div className="absolute inset-0">
        <SmartImage
          src={listing.media?.cover ?? listing.cover_image ?? null}
          alt={listing.title}
          usage="card"
          aspectRatio="auto"
          sizes="(max-width: 1024px) 100vw, 420px"
          wrapperClassName="h-full"
          className="object-cover"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

      <div className="absolute right-3 top-14 flex flex-col items-end gap-1.5">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${available ? 'bg-emerald-500 text-white' : 'bg-zinc-700/90 text-zinc-300'}`}>
          {available ? `${listing.available_units} available` : 'Fully booked'}
        </span>
        <span className="text-[11px] text-white/50">{index + 1} / {total}</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 pb-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {listing.is_featured ? (
            <span className="rounded-full bg-primary/90 px-2 py-0.5 text-[11px] font-semibold text-white">Featured</span>
          ) : null}
          {houseType ? (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium capitalize text-white/80">{houseType}</span>
          ) : null}
        </div>

        <h2 className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-white">{listing.title}</h2>

        {location ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-white/70">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{location}</span>
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-extrabold leading-none text-white">{rent}</p>
            <p className="mt-0.5 text-[11px] text-white/55">per month</p>
          </div>
          <Link
            to={`/listings/${listing.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-zinc-900 shadow-sm transition hover:bg-white/90 active:scale-95"
          >
            View
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  )
}

function MapLinkChip({ url, label = 'View on Google Maps' }: { url: string; label?: string }): React.ReactElement {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100">
      <MapPin className="h-3.5 w-3.5" />
      {label}
    </a>
  )
}

function MarkdownText({ text }: { text: string }): React.ReactElement {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, index) => (
        <React.Fragment key={`${line}-${index}`}>
          {renderInlineMarkdown(line)}
          {index < lines.length - 1 ? <br /> : null}
        </React.Fragment>
      ))}
    </>
  )
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
        <a key={`${value}-${match.index}`} href={value} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">
          {value}
        </a>,
      )
    }
    cursor = match.index + value.length
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

function FeedbackBar({ onFeedback }: { onFeedback: (value: 'up' | 'down', reason?: string) => void }): React.ReactElement {
  const [state, setState] = useState<'idle' | 'down' | 'thanks'>('idle')

  if (state === 'thanks') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <Check className="h-3.5 w-3.5" />
        Thanks
      </span>
    )
  }

  if (state === 'down') {
    return (
      <select
        className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground"
        defaultValue=""
        onChange={(event) => {
          if (!event.target.value) return
          onFeedback('down', event.target.value)
          setState('thanks')
        }}
      >
        <option value="" disabled>What went wrong?</option>
        <option value="wrong_location">Wrong location</option>
        <option value="not_what_i_meant">Not what I meant</option>
        <option value="missing_data">Missing data</option>
        <option value="other">Other</option>
      </select>
    )
  }

  return (
    <div className="flex gap-1">
      <button type="button" onClick={() => { onFeedback('up'); setState('thanks') }} className="rounded-full border border-border p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Thumbs up">
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => setState('down')} className="rounded-full border border-border p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Thumbs down">
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function ComparisonTable({ table }: { table: AITable }): React.ReactElement {
  const [sortIndex, setSortIndex] = useState(0)
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const rows = [...table.rows].sort((a, b) => {
    const left = String(a[sortIndex] ?? '')
    const right = String(b[sortIndex] ?? '')
    return direction === 'asc' ? left.localeCompare(right) : right.localeCompare(left)
  })

  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-max text-left text-xs">
        <thead className="sticky top-0 bg-muted text-muted-foreground">
          <tr>
            {table.columns.map((column, index) => (
              <th key={column} className="px-3 py-2 font-semibold">
                <button type="button" onClick={() => { setSortIndex(index); setDirection((current) => current === 'asc' ? 'desc' : 'asc') }}>
                  {column}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-background even:bg-muted/40">
              {table.columns.map((column, columnIndex) => (
                <td key={`${rowIndex}-${column}`} className="px-3 py-2 text-foreground">{formatCell(row[columnIndex])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DownloadActionList({ actions, token }: { actions: AIAction[]; token: string | null }): React.ReactElement {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      {actions.map((action) => (
        <button key={`${action.label}-${action.url}`} type="button" onClick={() => void downloadPdf(action, token)} className="flex w-full items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent">
          <span>{action.label || 'Document'}</span>
          <span className="inline-flex items-center gap-1 text-primary">
            <ArrowDownToLine className="h-3.5 w-3.5" />
            PDF
          </span>
        </button>
      ))}
    </div>
  )
}

function ActiveFilterChips({ intent }: { intent?: AIPropertySearchIntent }): React.ReactElement | null {
  const chips = buildFilterChips(intent)
  if (chips.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span key={chip} className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold capitalize text-foreground">
          {chip}
        </span>
      ))}
    </div>
  )
}

function getPdfActions(data?: AIChatData): AIAction[] {
  const contextActions = data?.context?.actions ?? []
  const metaActions = data?.meta?.actions ?? []
  return [...contextActions, ...metaActions].filter((action) => action.type === 'pdf_download')
}

function extractHomeListings(data?: PublicListingsHome): PublicListing[] {
  if (!data) return []
  const candidates = [
    data.featured,
    data.recommended,
    data.listings,
    data.recent,
    data.latest,
    Array.isArray(data.data) ? data.data : undefined,
    isPaginatedListings(data.data) ? data.data.data : undefined,
  ]
  const seen = new Set<string>()
  return candidates.flatMap((items) => Array.isArray(items) ? items : []).filter((listing) => {
    const key = listing.uuid ?? listing.slug
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isPaginatedListings(value: unknown): value is { data: PublicListing[] } {
  return Boolean(value && typeof value === 'object' && 'data' in value && Array.isArray((value as { data?: unknown }).data))
}

function isRenderableSearch(data?: AIChatData): boolean {
  return data?.meta?.action === 'property_search' && !isGuarded(data.meta)
}

function isGuarded(meta?: AIChatMeta): boolean {
  return meta?.blocked === true || Boolean(meta?.moderation) || Boolean(meta?.domain)
}

function buildFilterChips(intent?: AIPropertySearchIntent): string[] {
  if (!intent) return []
  const chips = [
    ...toStringArray(intent.locations),
    ...toStringArray(intent.counties),
    ...toStringArray(intent.property_types),
    ...toStringArray(intent.nearby).map((value) => `Near ${value}`),
    ...toStringArray(intent.amenities),
    intent.environment,
    intent.price_sensitivity,
    intent.style,
    intent.map_query,
  ]
  if (intent.budget_min || intent.budget_max) chips.push(formatBudget(intent.budget_min, intent.budget_max))
  return [...new Set(chips.filter((chip): chip is string => typeof chip === 'string' && chip.trim().length > 0))]
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function formatBudget(min?: number | null, max?: number | null): string {
  if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()}`
  if (min) return `From ${min.toLocaleString()}`
  if (max) return `Up to ${max.toLocaleString()}`
  return ''
}

function formatListingRentRange(listing: PublicListing): string {
  const currency = listing.currency ?? 'KES'
  const min = Number(listing.rent_min)
  const max = Number(listing.rent_max)
  if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0 && min !== max) return `${formatCurrencyCompact(min, currency)} - ${formatCurrencyCompact(max, currency)}`
  if (Number.isFinite(min) && min > 0) return formatCurrencyCompact(min, currency)
  if (Number.isFinite(max) && max > 0) return formatCurrencyCompact(max, currency)
  return 'Rent on request'
}

function formatRentRange(property: AIPropertyResult): string {
  const currency = property.currency ?? 'KES'
  const min = Number(property.rent_min ?? property.price)
  const max = Number(property.rent_max ?? property.price)
  if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0 && min !== max) return `${formatCurrencyCompact(min, currency)} - ${formatCurrencyCompact(max, currency)}`
  if (Number.isFinite(min) && min > 0) return formatCurrencyCompact(min, currency)
  return 'Rent on request'
}

function formatRange(min?: number | null, max?: number | null, unit = ''): string | null {
  if (min === null && max === null) return null
  if (min === undefined && max === undefined) return null
  const safeMin = typeof min === 'number' ? min : null
  const safeMax = typeof max === 'number' ? max : null
  if (safeMin !== null && safeMax !== null && safeMin !== safeMax) return `${safeMin}-${safeMax} ${unit}${safeMax === 1 ? '' : 's'}`
  const value = safeMin ?? safeMax
  return value !== null ? `${value} ${unit}${value === 1 ? '' : 's'}` : null
}

function animateWords(text: string, speedMs: number, onUpdate: (value: string) => void, onDone?: () => void): () => void {
  const words = text.split(' ')
  let index = 0
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

function getMapUrlFromText(text: string): string | null {
  return text.match(/https?:\/\/(?:www\.)?(?:google\.[^\s]+\/maps|maps\.app\.goo\.gl)[^\s)]+/i)?.[0] ?? null
}

function stripMapUrls(text: string): string {
  return text.replace(/https?:\/\/(?:www\.)?(?:google\.[^\s]+\/maps|maps\.app\.goo\.gl)[^\s)]+/gi, '').trim()
}

function formatCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'
  return typeof value === 'number' ? value.toLocaleString() : value
}

function formatTime(createdAt: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(createdAt))
}

async function sendPropertyClick(property: AIPropertyResult, sessionToken: string | null, query: string, intent?: AIPropertySearchIntent): Promise<void> {
  try {
    await aiApi.feedbackClick({
      property_uuid: getPropertyUuid(property),
      session_token: sessionToken,
      query,
      intent: intent ?? null,
    })
  } catch {
    // Feedback should never interrupt browsing.
  }
}

async function sendSuggestion(suggestion: string, sessionToken: string | null, intent?: AIPropertySearchIntent): Promise<void> {
  try {
    await aiApi.feedbackSuggestionActed({ suggestion, session_token: sessionToken, intent: intent ?? null })
  } catch {
    // Feedback should never interrupt follow-up search.
  }
}

async function sendThumbFeedback(message: HunterMessage, sessionToken: string | null, value: 'up' | 'down', reason?: string): Promise<void> {
  try {
    await aiApi.feedbackThumbs({
      message_id: message.id,
      session_token: sessionToken,
      value,
      reason,
      query: message.sourceQuery,
      intent: message.data?.context?.intent ?? null,
    })
  } catch {
    // Feedback should never alter the chat state.
  }
}

async function downloadPdf(action: AIAction, token?: string | null): Promise<void> {
  if (!token) {
    window.open(action.url, '_blank')
    return
  }
  const res = await fetch(action.url, {
    method: action.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function getPropertyUuid(property: AIPropertyResult): string | number | null {
  const uuid = property.uuid
  return typeof uuid === 'string' || typeof uuid === 'number' ? uuid : property.id ?? null
}

function getFeedbackUrl(path: string): string {
  return `${apiBaseUrl}${path}`
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
