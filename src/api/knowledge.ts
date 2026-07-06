import { apiGet, apiPatch } from './client'

export interface KBQuestion {
  uuid: string
  question: string
  category: string
  ai_suggested_answer: string | null
  answer_status: 'pending' | 'ai_generated'
  asked_count: number
  last_asked_at: string
  property_id: number | null
}

export interface KBStats {
  pending: number
  ai_generated: number
  admin_approved: number
  dismissed: number
  top_categories: Record<string, number>
}

export interface KBListResponse {
  data: KBQuestion[]
  meta: { total: number; current_page: number; last_page: number }
}

export const knowledgeApi = {
  list: (params?: { page?: number; per_page?: number }) =>
    apiGet<KBListResponse>('/admin/ai/knowledge', params as Record<string, unknown>),

  stats: () =>
    apiGet<KBStats>('/admin/ai/knowledge/stats'),

  approve: (uuid: string, answer: string) =>
    apiPatch<void>(`/admin/ai/knowledge/${uuid}/approve`, { answer }),

  dismiss: (uuid: string) =>
    apiPatch<void>(`/admin/ai/knowledge/${uuid}/dismiss`, {}),
}
