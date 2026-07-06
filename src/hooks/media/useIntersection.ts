import { useEffect, useRef, useState, type RefObject } from 'react'

interface UseIntersectionOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean
}

export function useIntersection<T extends Element = HTMLElement>(
  options: UseIntersectionOptions = {},
): { ref: RefObject<T | null>; isIntersecting: boolean; entry?: IntersectionObserverEntry } {
  const ref = useRef<T | null>(null)
  const [entry, setEntry] = useState<IntersectionObserverEntry>()
  const frozen = entry?.isIntersecting && options.freezeOnceVisible

  useEffect(() => {
    const node = ref.current
    if (!node || frozen || typeof IntersectionObserver === 'undefined') return undefined

    const observer = new IntersectionObserver(([nextEntry]) => {
      setEntry(nextEntry)
    }, {
      root: options.root ?? null,
      rootMargin: options.rootMargin ?? '280px 0px',
      threshold: options.threshold ?? 0.01,
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [frozen, options.root, options.rootMargin, options.threshold])

  return { ref, isIntersecting: Boolean(entry?.isIntersecting), entry }
}
