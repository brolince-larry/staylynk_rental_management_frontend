// src/utils/errors.ts
import type { ApiError } from '@/types'

export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'success' in err &&
    (err as ApiError).success === false &&
    'message' in err &&
    'status' in err
  )
}

export function getErrorMessage(err: unknown): string {
  if (isApiError(err)) {
    const validationMessage = firstValidationMessage(err.errors)
    return validationMessage ?? err.message
  }
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'An unexpected error occurred.'
}

export function getValidationErrors(err: unknown): string[] {
  if (isApiError(err)) return validationMessages(err.errors)
  return []
}

function firstValidationMessage(errors: ApiError['errors']): string | null {
  return validationMessages(errors)[0] ?? null
}

function validationMessages(errors: ApiError['errors']): string[] {
  if (Array.isArray(errors)) return errors.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)

  return Object.values(errors)
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function isNotFound(err: unknown): boolean {
  return isApiError(err) && err.status === 404
}

export function isForbidden(err: unknown): boolean {
  return isApiError(err) && err.status === 403
}

export function isPayloadTooLarge(err: unknown): boolean {
  return isApiError(err) && err.status === 413
}

export function isUnprocessable(err: unknown): boolean {
  return isApiError(err) && err.status === 422
}

export function isTooManyRequests(err: unknown): boolean {
  return isApiError(err) && err.status === 429
}
