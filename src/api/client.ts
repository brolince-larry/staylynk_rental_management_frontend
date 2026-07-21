// src/api/client.ts
// Enterprise Axios client — interceptors, retry, auth injection, error normalisation

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type Method,
  isAxiosError,
} from 'axios'
import type { ApiResponse, ApiError } from '@/types'
import { apiBaseUrl } from '@/config/env'

// ─── Retry config ─────────────────────────────────────────────────────────
const RETRY_CODES  = [500, 502, 503, 504]
const MAX_RETRIES  = 1
const RETRY_DELAY  = 1_000  // ms, doubles per attempt
const IDEMPOTENT_METHODS = new Set<Method>(['get', 'head', 'options', 'put', 'delete'])

// ─── Token / event hooks (set by AuthProvider at boot) ────────────────────
let _getToken:               (() => string | null) | null = null
let _onUnauthorized:         (() => void) | null          = null
let _onSessionTimeout:       (() => void) | null          = null
let _onForbidden:            (() => void) | null          = null
let _onSubscriptionRequired: (() => void) | null          = null

export function configureApiClient(opts: {
  getToken:                () => string | null
  onUnauthorized:          () => void
  onSessionTimeout?:       () => void
  onForbidden:             () => void
  onSubscriptionRequired?: () => void
}): void {
  _getToken               = opts.getToken
  _onUnauthorized         = opts.onUnauthorized
  _onSessionTimeout       = opts.onSessionTimeout ?? null
  _onForbidden            = opts.onForbidden
  _onSubscriptionRequired = opts.onSubscriptionRequired ?? null
}

// ─── Axios instance ───────────────────────────────────────────────────────
const apiClient: AxiosInstance = axios.create({
  baseURL:         apiBaseUrl,
  timeout:         30_000,
  withCredentials: true,
  headers: {
    'Content-Type':    'application/json',
    'Accept':          'application/json',
    'X-Requested-With':'XMLHttpRequest',
  },
})

// ─── Device fingerprint — SHA-256, 64-char hex, cached in sessionStorage ─────
let _cachedFP = ''

export async function initDeviceFP(): Promise<void> {
  const KEY = 'x-dfp'
  const hit = sessionStorage.getItem(KEY)
  if (hit && hit.length === 64) { _cachedFP = hit; return }
  const raw = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth),
  ].join('|')
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const fp = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  sessionStorage.setItem(KEY, fp)
  _cachedFP = fp
}

function getDeviceFP(): string {
  return _cachedFP || sessionStorage.getItem('x-dfp') || ''
}

// ─── Request interceptor — inject Bearer token + device FP ───────────────
let _reqId = 0
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = _getToken?.()
    if (token) config.headers.Authorization = `Bearer ${token}`
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    config.headers['X-Request-ID'] = `req-${++_reqId}-${Date.now()}`
    config.headers['X-Device-FP'] = getDeviceFP()
    return config
  },
  (err: unknown) => Promise.reject(err)
)

// ─── Response interceptor — handle errors + retry ────────────────────────
apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (err: unknown) => {
    if (!isAxiosError(err)) {
      return Promise.reject(makeError(0, 'An unexpected error occurred.'))
    }

    const { response, config } = err
    const status = response?.status ?? 0

    if (status === 401) {
      if (response?.data?.code === 'session_timeout' && _onSessionTimeout) {
        _onSessionTimeout()
      } else {
        _onUnauthorized?.()
      }
      return Promise.reject(makeError(401, 'Session expired. Please sign in again.'))
    }

    if (status === 403) {
      _onForbidden?.()
      return Promise.reject(makeError(
        403,
        response?.data?.message ?? 'Access denied.',
        response?.data?.errors,
        response?.data?.data ?? response?.data
      ))
    }

    if (status === 402) {
      _onSubscriptionRequired?.()
      return Promise.reject(makeError(
        402,
        response?.data?.message ?? 'Payment required. Please upgrade your plan.',
        response?.data?.errors,
        response?.data?.data ?? response?.data
      ))
    }

    // Retry on transient errors — but never retry a maintenance 503
    const isMaintenance = status === 503 && response?.data?.maintenance === true
    const cfg      = config as AxiosRequestConfig & { _retries?: number }
    const retries  = cfg._retries ?? 0
    const method = (cfg.method ?? 'get').toLowerCase() as Method
    if (!isMaintenance && IDEMPOTENT_METHODS.has(method) && RETRY_CODES.includes(status) && retries < MAX_RETRIES) {
      await sleep(RETRY_DELAY * Math.pow(2, retries))
      return apiClient({ ...cfg, _retries: retries + 1 } as InternalAxiosRequestConfig)
    }

    const message =
      response?.data?.message ??
      HTTP_MESSAGES[status] ??
      'An unexpected error occurred.'

    return Promise.reject(makeError(
      status,
      message,
      response?.data?.errors,
      response?.data ?? null,
      isMaintenance ? true : undefined,
      isMaintenance ? (response?.data?.feature as string | undefined) : undefined,
    ))
  }
)

// ─── Helpers ──────────────────────────────────────────────────────────────
function makeError(
  status: number,
  message: string,
  errors: ApiError['errors'] = {},
  data: unknown = null,
  maintenance?: boolean,
  feature?: string,
): ApiError {
  return { success: false, message, data, errors, status, maintenance, feature }
}
function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
const HTTP_MESSAGES: Record<number, string> = {
  400: 'Invalid request.',
  402: 'Payment required. Please upgrade your plan.',
  403: 'You do not have permission to perform this action.',
  404: 'Resource not found.',
  409: 'Conflict — resource already exists.',
  413: 'The selected file is too large.',
  422: 'Validation failed. Please check your inputs.',
  429: 'Too many requests. Please slow down.',
  500: 'Server error. Please try again shortly.',
  503: 'Service unavailable. Please try again later.',
}

// ─── Typed request helpers ────────────────────────────────────────────────
export async function apiGet<T>(
  url: string,
  params?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  const res = await apiClient.get<ApiResponse<T>>(url, { params })
  return res.data
}

export async function apiPost<T>(
  url: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  const res = await apiClient.post<ApiResponse<T>>(url, data)
  return res.data
}

export async function apiPatch<T>(
  url: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  const res = await apiClient.patch<ApiResponse<T>>(url, data)
  return res.data
}

export async function apiPut<T>(
  url: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  const res = await apiClient.put<ApiResponse<T>>(url, data)
  return res.data
}

export async function apiDelete<T = null>(
  url: string
): Promise<ApiResponse<T>> {
  const res = await apiClient.delete<ApiResponse<T>>(url)
  return res.data
}

export { apiClient }
