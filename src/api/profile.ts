import { apiGet, apiPatch, apiPost } from './client'

export interface Profile {
  id: number | string
  name: string
  email: string
  phone?: string | null
  role?: string
  avatar_image?: Record<string, unknown> | null
  avatar_url?: string | null
}

export interface ProfileUpdatePayload {
  name: string
  phone?: string
}

export interface EmailChangePayload {
  type: 'email'
  current_password: string
  email: string
}

export interface PasswordChangePayload {
  type: 'password'
  current_password: string
  password: string
  password_confirmation: string
}

export const profileApi = {
  get: () =>
    apiGet<Profile>('/profile'),

  update: (data: ProfileUpdatePayload) =>
    apiPatch<Profile>('/profile', data),

  requestChange: (data: EmailChangePayload | PasswordChangePayload) =>
    apiPost<Record<string, unknown>>('/profile/changes', data),

  verifyChange: (type: 'email' | 'password', code: string) =>
    apiPost<Record<string, unknown>>('/profile/changes/verify', { type, code }),

  uploadPhoto: (data: FormData) =>
    apiPost<Profile | Record<string, unknown>>('/profile/photo', data),
}
