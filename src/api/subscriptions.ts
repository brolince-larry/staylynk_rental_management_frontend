import { apiGet, apiPost } from './client'

export type BillingCycle = 'monthly' | 'annual'

export interface SubscriptionPlan {
  slug: string
  name: string
  description?: string | null
  monthly_price: number
  annual_price?: number | null
  annual_savings?: number | null
  trial_days?: number | null
  grace_period_days?: number | null
  limits?: {
    properties?: number | null
    rooms?: number | null
    tenants?: number | null
    users?: number | null
    admins?: number | null
    workers?: number | null
    storage_mb?: number | null
    images?: number | null
    api_requests_per_day?: number | null
    [key: string]: number | null | undefined
  }
  capabilities?: {
    public_listing?: boolean
    ai_matching?: boolean
    map_listing?: boolean
    websocket?: boolean
    sms?: boolean
    whatsapp?: boolean
    analytics?: boolean
    payroll?: boolean
    multi_admin?: boolean
    worker_module?: boolean
    reports?: boolean
    [key: string]: boolean | undefined
  }
  features?: string[]
  is_featured?: boolean
  is_recommended?: boolean
  sort_order?: number
}

export interface CurrentSubscription {
  uuid: string
  status: string
  billing_cycle?: BillingCycle
  amount?: number
  starts_at?: string
  ends_at?: string
  trial_ends_at?: string | null
  grace_ends_at?: string | null
  renewed_at?: string | null
  cancelled_at?: string | null
  payment_method?: string | null
  days_remaining?: number | null
  is_trial?: boolean
  trial_days_remaining?: number | null
  plan?: SubscriptionPlan | null
}

export interface CurrentSubscriptionPayload {
  subscription: CurrentSubscription | null
  usage: {
    properties: number
    units: number
    tenants: number
    admins: number
    workers: number
  }
}

export interface SubscriptionInvoice {
  uuid: string
  invoice_number: string
  amount: number
  tax?: number
  total: number
  status: string
  due_date?: string | null
  paid_at?: string | null
  payment_reference?: string | null
  line_items?: Array<{ description: string; amount: number }>
  created_at?: string
}

export interface SubscribePaymentPending {
  status: string
  payment_reference: string
  message: string
  tracking_endpoint: string
}

export interface SubscribeResult {
  subscription: CurrentSubscription
  invoice?: SubscriptionInvoice
  trial?: boolean
  trial_ends_at?: string | null
  trial_days_remaining?: number
  payment?: SubscribePaymentPending
}

export const subscriptionsApi = {
  plans: () => apiGet<SubscriptionPlan[]>('/admin/subscription/plans'),
  current: () => apiGet<CurrentSubscriptionPayload>('/admin/subscription/current'),
  subscribe: (data: { plan_slug: string; billing_cycle: BillingCycle; phone_number?: string }) =>
    apiPost<SubscribeResult>('/admin/subscription/subscribe', data),
  markPlanIntroSeen: () => apiPost<null>('/admin/subscription/plan-intro-seen', {}),
}
