import { createContext, useContext } from 'react'

export type EventCallback<T = unknown> = (payload: T) => void

export interface RealtimeContextValue {
  subscribePrivate: <T = unknown>(
    channelName: string,
    eventName: string,
    callback: EventCallback<T>,
  ) => () => void
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext)
  if (!context) throw new Error('useRealtime must be used within RealtimeProvider')
  return context
}
