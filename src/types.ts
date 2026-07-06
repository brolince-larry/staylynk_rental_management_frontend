export type Role = 'superadmin' | 'admin' | 'manager' | 'tenant'

export interface Organization {
  id: number | string
  name: string
  email?: string
  organization_email?: string
  org_email?: string
  phone?: string
  organization_phone?: string
  phone_number?: string
  address?: string
  city?: string
  country?: string
  currency?: string
  timezone?: string
  late_fee_pct?: number
  payment_due_day?: number
  [key: string]: unknown
}

export interface AuthUser {
  id: number | string
  name: string
  email: string
  phone?: string | null
  avatar_image?: Record<string, unknown> | null
  avatar_url?: string | null
  media?: Record<string, unknown> | null
  role: Role
  dashboard: string
  org?: Organization | null
  current_property?: {
    id: number
    uuid: string
    name: string
    slug: string
    permissions?: string[] | Record<string, boolean>
  } | null
  permissions?: string[]
}

export interface LoginPayload {
  email: string
  password: string
  device_name: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
  errors?: Record<string, string[]> | string[]
}

export interface PaginationMeta {
  current_page: number
  from: number | null
  last_page: number
  per_page: number
  to: number | null
  total: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta?: PaginationMeta
  links?: Record<string, string | null>
}

export type PaymentProvider = 'mpesa' | 'paypal'

export interface PaymentCredential {
  id: string
  org?: { id: number; name: string }
  property?: { id: number; name: string } | null
  property_name?: string | null
  provider: PaymentProvider
  environment: 'sandbox' | 'production'
  display_name: string
  shortcode?: string | null
  callback_url?: string | null
  public_key_set: boolean
  secret_set: boolean
  is_active: boolean
  updated_at?: string
}

export interface ApiError {
  success: false
  message: string
  data: unknown
  errors: Record<string, string[]> | string[]
  status: number
  maintenance?: boolean
  feature?: string
}
