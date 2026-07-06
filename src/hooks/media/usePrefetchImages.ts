import { useEffect } from 'react'

export function usePrefetchImages(urls: Array<string | null | undefined>, enabled = true): void {
  useEffect(() => {
    if (!enabled || urls.length === 0) return undefined

    const images = urls
      .filter(Boolean)
      .slice(0, 3)
      .map((url) => {
        const image = new Image()
        image.decoding = 'async'
        image.src = String(url)
        return image
      })

    return () => {
      images.forEach((image) => {
        image.removeAttribute('src')
      })
    }
  }, [enabled, urls])
}
