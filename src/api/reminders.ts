import { apiGet, apiPost, apiDelete } from './client'

export interface AIReminder {
  uuid: string
  reminder_type: string
  message: string
  context_summary: string | null
  remind_at: string
  status: 'pending' | 'sent'
  delivery_channel: 'websocket' | 'in_app' | 'email'
  is_due: boolean
}

export interface CreateReminderPayload {
  reminder_type: string
  message: string
  remind_at: string
  context_summary?: string
  delivery_channel?: 'websocket' | 'in_app' | 'email'
}

export const remindersApi = {
  list: (sessionToken?: string | null) =>
    apiGet<AIReminder[]>('/ai/reminders', sessionToken ? { session_token: sessionToken } : undefined),

  create: (data: CreateReminderPayload) =>
    apiPost<AIReminder>('/ai/reminders', data),

  dismiss: (uuid: string) =>
    apiDelete<void>(`/ai/reminders/${uuid}`),
}
