import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface MasonryGridProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  getKey: (item: T, index: number) => React.Key
  estimateHeight?: number
  minColumnWidth?: number
  gap?: number
  className?: string
}

export function MasonryGrid<T>({
  items,
  renderItem,
  getKey,
  estimateHeight = 360,
  minColumnWidth = 260,
  gap = 16,
  className = '',
}: MasonryGridProps<T>): React.ReactElement {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = parentRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const columnCount = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)))
  const rows = useMemo(() => {
    const nextRows: T[][] = []
    items.forEach((item, index) => {
      const rowIndex = Math.floor(index / columnCount)
      nextRows[rowIndex] = nextRows[rowIndex] ?? []
      nextRows[rowIndex].push(item)
    })
    return nextRows
  }, [columnCount, items])

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateHeight,
    overscan: 4,
  })

  return (
    <div ref={parentRef} className={`h-full overflow-auto ${className}`}>
      <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index] ?? []

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 grid w-full"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                gap,
              }}
            >
              {row.map((item, rowOffset) => {
                const itemIndex = virtualRow.index * columnCount + rowOffset
                return <React.Fragment key={getKey(item, itemIndex)}>{renderItem(item, itemIndex)}</React.Fragment>
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
