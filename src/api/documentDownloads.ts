import { apiClient } from './client'
import type { ApiResponse } from '@/types'

export interface DocumentDownloadData {
  url?: string
  expires_in?: string
  [key: string]: unknown
}

interface OpenDocumentOptions {
  retries?: number
  delayMs?: number
  onPending?: (message: string) => void
}

export async function openSignedDocument(
  endpoint: string,
  options: OpenDocumentOptions = {},
): Promise<void> {
  const retries = options.retries ?? 5
  const delayMs = options.delayMs ?? 3000
  const popup = window.open('about:blank', '_blank')

  try {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const response = await apiClient.get<ApiResponse<DocumentDownloadData>>(endpoint)
      const url = response.data.data?.url

      if (url) {
        if (popup) popup.location.href = url
        else window.open(url, '_blank', 'noopener,noreferrer')
        return
      }

      if (response.status === 202 && attempt < retries) {
        options.onPending?.(response.data.message ?? 'Document is being generated. Retrying...')
        await wait(delayMs)
        continue
      }

      throw new Error(response.data.message ?? 'Document is not ready yet.')
    }
  } catch (error) {
    popup?.close()
    throw error
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
