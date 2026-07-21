import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { destroyEcho, getEcho } from '@/lib/echo'
import {
  RealtimeContext,
  type EventCallback,
  type RealtimeContextValue,
} from '@/providers/realtimeContext'
import { useAuthStore } from '@/store/auth.store'

interface ChannelEntry {
  channel: {
    listen: (event: string, callback: EventCallback) => unknown
    stopListening: (event: string) => unknown
  }
  events: Map<string, Set<EventCallback>>
  dispatchers: Map<string, EventCallback>
  releaseTimer: ReturnType<typeof setTimeout> | null
}

const DEBUG_PREFIX = '[realtime]'
const STRICT_MODE_RELEASE_DELAY_MS = 250

function debug(message: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return
  if (data) console.debug(DEBUG_PREFIX, message, data)
  else console.debug(DEBUG_PREFIX, message)
}

export function RealtimeProvider({ children }: { children: ReactNode }): React.ReactElement {
  const { token } = useAuthStore()
  const tokenRef = useRef<string | null>(token)
  const channelsRef = useRef<Map<string, ChannelEntry>>(new Map())
  const authRequestCountRef = useRef(0)

  useEffect(() => {
    tokenRef.current = token

    if (!token) {
      for (const [channelName, entry] of channelsRef.current.entries()) {
        if (entry.releaseTimer) clearTimeout(entry.releaseTimer)
        debug('cleanup channel on logout', { channelName })
      }
      channelsRef.current.clear()
      authRequestCountRef.current = 0
      destroyEcho()
    }
  }, [token])

  useEffect(() => () => {
    for (const [channelName, entry] of channelsRef.current.entries()) {
      if (entry.releaseTimer) clearTimeout(entry.releaseTimer)
      debug('cleanup channel on provider unmount', { channelName })
    }
    channelsRef.current.clear()
    destroyEcho()
  }, [])

  const subscribePrivate = useCallback<RealtimeContextValue['subscribePrivate']>((channelName, eventName, callback) => {
    const currentToken = tokenRef.current
    if (!currentToken) {
      debug('skip subscribe without token', { channelName, eventName })
      return () => undefined
    }

    const echo = getEcho(currentToken)
    if (!echo) {
      debug('skip subscribe; Echo unavailable', { channelName, eventName })
      return () => undefined
    }

    let entry = channelsRef.current.get(channelName)
    if (entry?.releaseTimer) {
      clearTimeout(entry.releaseTimer)
      entry.releaseTimer = null
      debug('cancel pending channel cleanup', { channelName })
    }

    if (!entry) {
      authRequestCountRef.current += 1
      debug('broadcasting auth request expected', {
        channelName,
        authRequestCount: authRequestCountRef.current,
      })
      entry = {
        channel: echo.private(channelName) as ChannelEntry['channel'],
        events: new Map(),
        dispatchers: new Map(),
        releaseTimer: null,
      }
      channelsRef.current.set(channelName, entry)
      debug('channel subscribed', {
        channelName,
        channelSubscriptionCount: channelsRef.current.size,
      })
    } else {
      debug('reuse channel subscription', {
        channelName,
        channelSubscriptionCount: channelsRef.current.size,
      })
    }

    let callbacks = entry.events.get(eventName)
    if (!callbacks) {
      callbacks = new Set()
      entry.events.set(eventName, callbacks)

      const dispatcher: EventCallback = (payload) => {
        const activeCallbacks = channelsRef.current.get(channelName)?.events.get(eventName)
        activeCallbacks?.forEach((listener) => listener(payload))
      }

      entry.dispatchers.set(eventName, dispatcher)
      entry.channel.listen(eventName, dispatcher)
      debug('event listener attached', {
        channelName,
        eventName,
        eventListenerCount: entry.events.size,
      })
    }

    callbacks.add(callback as EventCallback)
    debug('listener registered', {
      channelName,
      eventName,
      listenerCount: callbacks.size,
    })

    let didCleanup = false
    return () => {
      if (didCleanup) return
      didCleanup = true

      const activeEntry = channelsRef.current.get(channelName)
      const activeCallbacks = activeEntry?.events.get(eventName)
      activeCallbacks?.delete(callback as EventCallback)
      debug('listener cleanup', {
        channelName,
        eventName,
        listenerCount: activeCallbacks?.size ?? 0,
      })

      if (!activeEntry || !activeCallbacks) return

      if (activeCallbacks.size === 0) {
        activeEntry.channel.stopListening(eventName)
        activeEntry.events.delete(eventName)
        activeEntry.dispatchers.delete(eventName)
        debug('event listener detached', { channelName, eventName })
      }

      if (activeEntry.events.size === 0) {
        activeEntry.releaseTimer = setTimeout(() => {
          const pendingEntry = channelsRef.current.get(channelName)
          if (!pendingEntry || pendingEntry.events.size > 0) return

          echo.leave(channelName)
          channelsRef.current.delete(channelName)
          debug('channel left', {
            channelName,
            channelSubscriptionCount: channelsRef.current.size,
          })
        }, STRICT_MODE_RELEASE_DELAY_MS)
        debug('channel cleanup scheduled', { channelName })
      }
    }
  }, [])

  const value = useMemo<RealtimeContextValue>(() => ({ subscribePrivate }), [subscribePrivate])

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}
