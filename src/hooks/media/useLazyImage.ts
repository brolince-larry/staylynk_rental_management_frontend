import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIntersection } from './useIntersection'

export type ImageLoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

interface UseLazyImageOptions {
  src: string
  srcSet?: string
  priority?: boolean
  retryLimit?: number
}

export function useLazyImage<T extends Element = HTMLElement>({
  src,
  srcSet,
  priority = false,
  retryLimit = 1,
}: UseLazyImageOptions) {
  const { ref, isIntersecting } = useIntersection<T>({ freezeOnceVisible: true })
  const shouldLoad = priority || isIntersecting
  const [status, setStatus] = useState<ImageLoadStatus>(priority ? 'loading' : 'idle')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!shouldLoad || !src) return undefined

    let active = true
    setStatus('loading')
    const image = new Image()
    image.decoding = 'async'
    if (srcSet) image.srcset = srcSet
    image.src = src

    image.onload = async () => {
      try {
        await image.decode?.()
      } catch {
        // Some browsers reject decode after load; the loaded bitmap is still usable.
      }
      if (active) setStatus('loaded')
    }

    image.onerror = () => {
      if (active) setStatus('error')
    }

    return () => {
      active = false
      image.onload = null
      image.onerror = null
      image.removeAttribute('src')
      image.removeAttribute('srcset')
    }
  }, [attempt, shouldLoad, src, srcSet])

  const retry = useCallback(() => {
    if (attempt < retryLimit) {
      setAttempt((value) => value + 1)
    }
  }, [attempt, retryLimit])

  return useMemo(() => ({
    ref,
    shouldLoad,
    status,
    retry,
    canRetry: status === 'error' && attempt < retryLimit,
  }), [attempt, ref, retry, retryLimit, shouldLoad, status])
}
