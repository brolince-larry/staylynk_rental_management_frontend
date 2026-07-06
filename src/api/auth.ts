// src/api/auth.ts
import { apiGet, apiPost } from './client'
import type { AuthUser, LoginPayload, LoginResponse } from '@/types'

export const authApi = {
  login: (payload: LoginPayload) =>
    apiPost<LoginResponse>('/auth/login', payload),

  logout: () =>
    apiPost<null>('/auth/logout'),

  logoutAll: () =>
    apiPost<null>('/auth/logout-all'),

  me: () =>
    apiGet<AuthUser>('/auth/me'),

  register: (payload: {
    org_name:              string
    org_email:             string
    org_phone:             string
    name:                  string
    email:                 string
    password:              string
    password_confirmation: string
    country?:              string
  }) =>
    apiPost<LoginResponse>('/auth/register', payload),
}