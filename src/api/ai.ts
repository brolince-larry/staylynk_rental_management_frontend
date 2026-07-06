// src/api/ai.ts
import type { ApiResponse } from '@/types'
import { apiClient, apiGet, apiPost } from '@/api/client'

export interface AIPropertyResult {
  id: number | string
  title: string
  slug?: string
  description?: string | null
  price?: number
  location?: string
  bedrooms?: number
  bathrooms?: number
  thumbnail?: string
  rent_min?: number | null
  rent_max?: number | null
  currency?: string | null
  city?: string | null
  neighbourhood?: string | null
  county?: string | null
  house_type?: string | null
  bedrooms_min?: number | null
  bedrooms_max?: number | null
  amenities?: string[]
  parking_available?: boolean | null
  internet_available?: boolean | null
  is_family_friendly?: boolean | null
  is_student_friendly?: boolean | null
  cover_image?: string | Record<string, unknown> | null
  latitude?: number | string | null
  longitude?: number | string | null
  map_url?: string | null
  similarity_score?: number | null
  [key: string]: unknown
}

export interface AIPropertySearchIntent {
  locations?: string[]
  counties?: string[]
  property_types?: string[]
  amenities?: string[]
  nearby?: string[]
  budget_min?: number | null
  budget_max?: number | null
  environment?: string | null
  price_sensitivity?: string | null
  style?: string | null
  map_query?: string | null
  [key: string]: unknown
}

export interface AISearchResponse {
  intent?: AIPropertySearchIntent
  properties?: AIPropertyResult[]
  suggestions?: string[]
  confidence_score?: number
  cache_hit?: boolean
  message?: string
  context?: AIChatContext
  meta?: AIResponseMeta
  session_token?: string
}

export type AIRole = 'superadmin' | 'admin' | 'manager' | 'tenant' | 'public_hunter'

export type AITable = {
  title: string
  columns: string[]
  rows: Array<Array<string | number | null>>
}

export type AIAction = {
  label: string
  url: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  type?: 'pdf_download'
  requires_confirmation?: boolean
  body_hint?: Record<string, unknown>
  record?: Record<string, unknown>
}

// ─── Action Intent — in-chat payment / maintenance actions ────────────────
export interface ActionIntent {
  type: 'initiate_rent_payment' | 'initiate_subscription_payment' | 'submit_maintenance_request' | string
  label: string
  requires_confirmation: boolean
  confirm_message: string
  payload: Record<string, unknown>
  hints?: Record<string, unknown>
}

// ─── AI payment — tenant rent or admin subscription via AI chat ───────────
export interface AIPaymentInitiateResult {
  payment_reference: string
  status: string
  amount?: number
  month?: string
  plan?: string
  phone_display?: string
  tracking_type?: 'rent' | 'subscription'
}

export interface AIPaymentStatus {
  status: 'pending' | 'completed' | 'failed' | string
  confirmed?: boolean
  amount?: number
  month?: string
  balance?: number
  receipt?: string
  invoice_status?: string
  plan?: string
}

export interface AIActionResultResponse {
  message: string
  suggestions?: string[]
}

export const aiPaymentApi = {
  initiate: (data: {
    type: 'rent' | 'subscription'
    invoice_uuid: string
    phone_number: string
    amount?: number
  }) => apiPost<AIPaymentInitiateResult>('/ai/payment/initiate', data).then((r) => r.data),

  status: (type: string, reference: string) =>
    apiGet<AIPaymentStatus>('/ai/payment/status', { type, reference }).then((r) => r.data),

  actionResult: (data: {
    action_type: string
    success: boolean
    result: Record<string, unknown>
    session_token: string
  }) => apiPost<AIActionResultResponse>('/ai/action-result', data).then((r) => r.data),
}

export interface AIFeedbackPayload {
  session_token?: string | null
  message_id?: string
  query?: string
  intent?: Record<string, unknown> | AIPropertySearchIntent | null
  property_uuid?: string | number | null
  value?: 'up' | 'down'
  reason?: string
  suggestion?: string
  duration_seconds?: number
  last_query?: string
  last_action?: string
  [key: string]: unknown
}

export type AIConfidenceBand = 'high' | 'medium' | 'low'

export type AIModerationAction = 'redirect' | 'warning' | 'temporary_mute' | 'session_suspension'

export interface AIModerationMeta {
  action?: AIModerationAction
  outcome?: AIModerationAction
  message?: string
  muted_until?: string
  mute_until?: string
  mute_seconds?: number
  [key: string]: unknown
}

export interface AIDomainMeta {
  reason?: 'out_of_domain' | 'blocked_topic' | string
  [key: string]: unknown
}

export interface AISafetyMeta {
  model_circuit_open?: boolean
  [key: string]: unknown
}

export interface AIResponseMeta {
  blocked?: boolean
  moderation?: AIModerationMeta
  domain?: AIDomainMeta
  confidence?: number
  confidence_band?: AIConfidenceBand
  safety?: AISafetyMeta
  map_url?: string | null
  zero_results?: boolean
  is_continuation?: boolean
  actions?: AIAction[]
}

export interface AIChatContext {
  action?: {
    action: string
    confidence: number
    requires_model_fallback: boolean
    conversational?: boolean
  }
  metrics?: Record<string, number>
  records?: Record<string, unknown>
  tables?: AITable[]
  actions?: AIAction[]
  capabilities?: string[]
  conversation_model_used?: boolean
  fallback_model_used?: boolean
  properties?: AIPropertyResult[]
  intent?: AIPropertySearchIntent
  suggestions?: string[]
  map_url?: string | null
  zero_results?: boolean
  retrieval?: {
    tables?: AITable[]
    [key: string]: unknown
  }
}

export interface AIChatMeta extends AIResponseMeta {
  action?: string
  intent_confidence?: number
  lightweight?: boolean
  source?: 'rules' | 'ollama_conversation' | 'ollama_fallback' | 'cache' | string
  presentation?: {
    typing: boolean
    typing_mode: 'word'
    typing_speed_ms: number
    thinking_orb: boolean
  }
}

export interface AIMediaItem {
  type: 'image' | 'video' | string
  url: string
  thumbnail?: string
  alt?: string
  property?: string
  cover?: boolean
  featured?: boolean
  duration?: string
}

export interface AgentActionButton {
  label: string
  action: string
  style: 'primary' | 'ghost' | string
  url: string
}

export interface AgentAction {
  id: string | number
  type: string
  title: string
  description: string
  confidence: number
  severity?: 'low' | 'medium' | 'high' | string
  entity?: { type: string; id: string | number }
  created_at: string
  buttons: AgentActionButton[]
}

export interface AIVisual {
  kind: 'bar' | 'line' | 'pie' | 'donut'
  title: string
  labels: string[]
  values: number[]
  colors?: string[]
}

export interface AIChatData {
  session_token?: string
  session_expired?: boolean
  role?: AIRole
  message: string
  context?: AIChatContext
  meta?: AIChatMeta
  media?: AIMediaItem[]
  action_intent?: ActionIntent | null
  action_type?: string | null
  action_data?: Record<string, unknown> | null
  suggestions?: string[] | Record<string, string>
  visuals?: AIVisual[]
  listings?: AIPropertyResult[]
  data?: Record<string, unknown>
  response_type?: string
  cards?: Record<string, unknown>
  token_usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export type AIChatResponse = ApiResponse<AIChatData>

export async function sendAIMessage(params: {
  message: string
  sessionToken?: string | null
  token?: string | null
  timezone?: string
  endpoint?: string
}): Promise<AIChatResponse> {
  const res = await apiClient.post<AIChatResponse>(
    params.endpoint ?? '/ai/chat',
    {
      message: params.message,
      session_token: params.sessionToken,
      timezone: params.timezone,
    },
    params.token
      ? { headers: { Authorization: `Bearer ${params.token}` } }
      : undefined,
  )

  return res.data
}

export async function getHunterSession(): Promise<string | null> {
  try {
    const res = await apiGet<{ session_token: string }>('/hunter/session')
    return res.data?.session_token ?? null
  } catch {
    return null
  }
}

export const aiApi = {
  search: async (payload: unknown) => {
    const res = await apiPost<AISearchResponse>('/ai/search', payload)
    return res
  },
  chat: async (payload: unknown) => {
    const res = await apiPost<AIChatData>('/ai/chat', payload)
    return res
  },
  recommendations: async (payload: unknown) => {
    const res = await apiPost<AIChatData | unknown>('/ai/recommendations', payload)
    return res
  },
  session: async (payload: unknown) => {
    const res = await apiPost<{ session_token: string }>('/ai/session', payload)
    return res
  },
  history: async (session_token: string) => {
    const res = await apiGet<unknown>('/ai/history', { session_token })
    return res
  },
  feedbackClick: async (payload: AIFeedbackPayload) => {
    const res = await apiPost<unknown>('/ai/feedback/click', payload)
    return res
  },
  feedbackThumbs: async (payload: AIFeedbackPayload) => {
    const res = await apiPost<unknown>('/ai/feedback/thumbs', payload)
    return res
  },
  feedbackSuggestionActed: async (payload: AIFeedbackPayload) => {
    const res = await apiPost<unknown>('/ai/feedback/suggestion-acted', payload)
    return res
  },
}

export default aiApi
