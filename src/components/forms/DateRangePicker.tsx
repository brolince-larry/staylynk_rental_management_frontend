// src/components/forms/DateRangePicker.tsx
// Date range picker with quick presets.
// Used on dashboard and report pages.

import React from 'react'
import { clsx } from 'clsx'
import { subDays, startOfYear, format } from 'date-fns'

interface Preset {
  label: string
  range: () => [Date, Date]
}

const DEFAULT_PRESETS: Preset[] = [
  { label: 'Last 7 days',  range: () => [subDays(new Date(), 7), new Date()] },
  { label: 'Last 30 days', range: () => [subDays(new Date(), 30), new Date()] },
  { label: 'Last 90 days', range: () => [subDays(new Date(), 90), new Date()] },
  // Calendar year to date (Jan 1 → today), not a rolling 365-day window.
  { label: 'This year',    range: () => [startOfYear(new Date()), new Date()] },
]

interface DateRangePickerProps {
  from:          string              // yyyy-MM-dd
  to:            string              // yyyy-MM-dd
  onFromChange:  (v: string) => void
  onToChange:    (v: string) => void
  className?:    string
  presets?:      Preset[]
  showPresets?:  boolean
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className,
  presets = DEFAULT_PRESETS,
  showPresets = true,
}: DateRangePickerProps): React.ReactElement {
  const applyPreset = (preset: Preset) => {
    const [fromDate, toDate] = preset.range()
    onFromChange(format(fromDate, 'yyyy-MM-dd'))
    onToChange(format(toDate, 'yyyy-MM-dd'))
  }

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {/* Quick presets */}
      {showPresets && presets.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => applyPreset(p)}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {p.label}
        </button>
      ))}

      {/* Date inputs */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="From date"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => onToChange(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="To date"
        />
      </div>
    </div>
  )
}