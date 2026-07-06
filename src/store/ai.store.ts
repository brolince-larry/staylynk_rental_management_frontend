// src/store/ai.store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AIChatContext, AIChatMeta, AIMediaItem, ActionIntent, AIVisual, AIPropertyResult } from '@/api/ai'

const MAX_PERSISTED_MESSAGES = 60

interface AIMessage {
  id: string
  role: 'assistant' | 'user' | 'system'
  content: string
  createdAt?: string
  meta?: AIChatMeta
  context?: AIChatContext
  media?: AIMediaItem[]
  action_intent?: ActionIntent | null
  action_type?: string | null
  action_data?: Record<string, unknown> | null
  suggestions?: string[]
  visuals?: AIVisual[]
  response_type?: string
  cards?: Record<string, unknown>
  listings?: AIPropertyResult[]
  token_usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface AIState {
  sessionToken: string | null
  messages: AIMessage[]
  loading: boolean
  error: string | null
  setSession: (token: string | null) => void
  pushMessage: (msg: AIMessage) => void
  updateMessage: (id: string, patch: Partial<AIMessage>) => void
  updateLastAssistantMessage: (patch: Partial<AIMessage>) => void
  clearMessages: () => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      sessionToken: null,
      messages: [],
      loading: false,
      error: null,
      setSession: (token) => set({ sessionToken: token }),
      pushMessage: (msg) => set({ messages: [...get().messages, msg] }),
      updateMessage: (id, patch) =>
        set({ messages: get().messages.map((msg) => msg.id === id ? { ...msg, ...patch } : msg) }),
      updateLastAssistantMessage: (patch) =>
        set({
          messages: get().messages.map((msg, index, messages) => {
            const lastAssistantIndex = messages.findLastIndex((item) => item.role === 'assistant')
            return index === lastAssistantIndex ? { ...msg, ...patch } : msg
          }),
        }),
      clearMessages: () => set({ messages: [] }),
      setLoading: (v) => set({ loading: v }),
      setError: (e) => set({ error: e }),
    }),
    {
      name: 'staylynk-ai-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionToken: state.sessionToken,
        messages: state.messages.slice(-MAX_PERSISTED_MESSAGES),
      }),
    },
  ),
)

export type { AIMessage }
