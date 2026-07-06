import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie,
  AreaChart, Area,
} from 'recharts'
import { BarChart3, TrendingUp, PieChart as PieIcon, Activity } from 'lucide-react'
import type { AIVisual } from '@/api/ai'

// ─── Premium Jewel-Tone Palette ───────────────────────────────────────────────

const P_FILL   = ['#7c3aed','#0284c7','#047857','#b45309','#be123c','#4338ca','#0f766e','#9333ea','#c2410c','#0e7490']
const P_STROKE = ['#a78bfa','#38bdf8','#34d399','#fbbf24','#fb7185','#818cf8','#2dd4bf','#d946ef','#fb923c','#22d3ee']

const SEMANTIC: Array<{ kw: string[]; fill: string; stroke: string }> = [
  { kw: ['revenue','income','collected','receipts','earning','cumulative payment'],       fill: '#047857', stroke: '#34d399' },
  { kw: ['expense','cost','expenditure','spending','leakage','maintenance cost'],         fill: '#be123c', stroke: '#fb7185' },
  { kw: ['noi','net operating','net income','profit','margin'],                           fill: '#1d4ed8', stroke: '#60a5fa' },
  { kw: ['overdue','arrear','unpaid','outstanding'],                                      fill: '#991b1b', stroke: '#f87171' },
  { kw: ['paid','settled','cleared'],                                                     fill: '#0f766e', stroke: '#5eead4' },
  { kw: ['elapsed','days elapsed','days used'],                                           fill: '#6d28d9', stroke: '#c4b5fd' },
  { kw: ['remaining','days remaining'],                                                   fill: '#0e7490', stroke: '#67e8f9' },
  { kw: ['balance','due amount'],                                                         fill: '#b45309', stroke: '#fcd34d' },
  { kw: ['vacant','empty','unoccupied'],                                                  fill: '#b45309', stroke: '#fcd34d' },
  { kw: ['available'],                                                                    fill: '#047857', stroke: '#34d399' },
  { kw: ['occupied','filled','booked','tenanted'],                                        fill: '#7c3aed', stroke: '#a78bfa' },
  { kw: ['open','active'],                                                                fill: '#0891b2', stroke: '#22d3ee' },
  { kw: ['pending'],                                                                      fill: '#b45309', stroke: '#fbbf24' },
  { kw: ['in progress','in-progress','working'],                                          fill: '#c2410c', stroke: '#fb923c' },
  { kw: ['resolved','done','completed','closed'],                                         fill: '#065f46', stroke: '#6ee7b7' },
  { kw: ['maintenance','repair','recurring issue'],                                       fill: '#c2410c', stroke: '#f97316' },
  { kw: ['critical','p1 critical','urgent'],                                              fill: '#dc2626', stroke: '#ef4444' },
  { kw: ['high','p2 high'],                                                               fill: '#ea580c', stroke: '#fb923c' },
  { kw: ['medium','p3 medium'],                                                           fill: '#ca8a04', stroke: '#fbbf24' },
  { kw: ['low','p4 low'],                                                                 fill: '#4d7c0f', stroke: '#a3e635' },
  { kw: ['roi','return on investment','payback period'],                                  fill: '#047857', stroke: '#6ee7b7' },
  { kw: ['improvement','renovation'],                                                     fill: '#059669', stroke: '#34d399' },
  { kw: ['subscription','plan distribution'],                                             fill: '#0284c7', stroke: '#38bdf8' },
  { kw: ['growth','new','added'],                                                         fill: '#0d9488', stroke: '#2dd4bf' },
  { kw: ['tenant','user','member'],                                                       fill: '#7c3aed', stroke: '#a78bfa' },
  { kw: ['organisation','organization','org'],                                            fill: '#4338ca', stroke: '#818cf8' },
  { kw: ['platform revenue'],                                                             fill: '#6d28d9', stroke: '#c4b5fd' },
  { kw: ['ai service','ai request','service request','service breakdown'],               fill: '#9333ea', stroke: '#d946ef' },
  { kw: ['score','match','budget fit','amenity','location demand'],                      fill: '#1d4ed8', stroke: '#60a5fa' },
  { kw: ['demand','search volume','search'],                                              fill: '#0e7490', stroke: '#22d3ee' },
  { kw: ['market rate','pricing gap','gap','competitor'],                                 fill: '#be123c', stroke: '#fb7185' },
  { kw: ['worker','staff','resolution time'],                                             fill: '#1d4ed8', stroke: '#60a5fa' },
  { kw: ['category','frequency','volume','count'],                                        fill: '#475569', stroke: '#94a3b8' },
  { kw: ['invoice'],                                                                      fill: '#0891b2', stroke: '#22d3ee' },
  { kw: ['predicted','forecast','projected','churn'],                                    fill: '#7c3aed', stroke: '#a78bfa' },
  { kw: ['room occupancy','occupancy rate'],                                              fill: '#047857', stroke: '#34d399' },
  { kw: ['collection rate','trend'],                                                      fill: '#0284c7', stroke: '#38bdf8' },
  { kw: ['total','all','overall'],                                                        fill: '#475569', stroke: '#94a3b8' },
  { kw: ['cache','hit'],                                                                  fill: '#0f766e', stroke: '#2dd4bf' },
  { kw: ['blocked','failed','error'],                                                     fill: '#9f1239', stroke: '#fb7185' },
]

function semanticFallback(label: string, idx: number): { fill: string; stroke: string } {
  const lower = label.toLowerCase()
  for (const entry of SEMANTIC) {
    if (entry.kw.some((k) => lower.includes(k))) return { fill: entry.fill, stroke: entry.stroke }
  }
  return {
    fill:   P_FILL[idx % P_FILL.length]   ?? '#7c3aed',
    stroke: P_STROKE[idx % P_STROKE.length] ?? '#a78bfa',
  }
}

// ─── Chart-type identity ──────────────────────────────────────────────────────

const TYPE_META = {
  bar: {
    label: 'Bar',
    Icon: BarChart3,
    accent:     'text-violet-600 dark:text-violet-400',
    iconBg:     'bg-violet-100 dark:bg-violet-500/15',
    accentLine: 'bg-gradient-to-r from-violet-500/70 via-violet-400/25 to-transparent',
    badge:      'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  },
  line: {
    label: 'Trend',
    Icon: TrendingUp,
    accent:     'text-sky-600 dark:text-sky-400',
    iconBg:     'bg-sky-100 dark:bg-sky-500/15',
    accentLine: 'bg-gradient-to-r from-sky-500/70 via-sky-400/25 to-transparent',
    badge:      'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  },
  pie: {
    label: 'Pie',
    Icon: PieIcon,
    accent:     'text-emerald-600 dark:text-emerald-400',
    iconBg:     'bg-emerald-100 dark:bg-emerald-500/15',
    accentLine: 'bg-gradient-to-r from-emerald-500/70 via-emerald-400/25 to-transparent',
    badge:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  donut: {
    label: 'Donut',
    Icon: Activity,
    accent:     'text-amber-600 dark:text-amber-400',
    iconBg:     'bg-amber-100 dark:bg-amber-500/15',
    accentLine: 'bg-gradient-to-r from-amber-500/70 via-amber-400/25 to-transparent',
    badge:      'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  },
} as const

// ─── Glassmorphism Tooltip ────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}): React.ReactElement | null {
  if (!active || !payload?.length) return null
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return (
    <div
      className="rounded-xl border border-white/20 bg-slate-900/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-black/80"
      style={{ maxWidth: 220 }}
    >
      {label && (
        <p className="mb-1.5 text-[0.58rem] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: entry.color,
                boxShadow: `0 0 8px ${entry.color}cc`,
              }}
            />
            <span className="shrink-0 font-semibold tabular-nums text-white">{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Gradient defs for bars ───────────────────────────────────────────────────

function BarGradients({ items }: { items: Array<{ id: string; fill: string }> }): React.ReactElement {
  return (
    <defs>
      {items.map(({ id, fill }) => (
        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={fill} stopOpacity={0.92} />
          <stop offset="55%"  stopColor={fill} stopOpacity={0.55} />
          <stop offset="100%" stopColor={fill} stopOpacity={0.12} />
        </linearGradient>
      ))}
    </defs>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  visual: AIVisual
  height?: number
}

export function AgentChart({ visual, height = 220 }: Props): React.ReactElement {
  const { kind, title, labels, values, colors = [] } = visual

  const resolvedColors = useMemo(() =>
    labels.map((lbl, i) => {
      const c = colors.length > 0 ? colors[i % colors.length] : undefined
      if (c && c.trim()) return { fill: c, stroke: c }
      return semanticFallback(lbl, i)
    }),
  [labels, colors])

  const meta = TYPE_META[kind] ?? TYPE_META.bar
  const { Icon, accent, iconBg, accentLine, badge } = meta

  const axisStyle = { fontSize: 9.5, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }
  const gridColor = 'hsl(var(--border))'

  const data = useMemo(() =>
    labels.map((name, i) => ({ name, value: values[i] ?? 0 })),
  [labels, values])

  const pieSlices = useMemo(() =>
    labels.map((name, i) => ({
      name,
      value: values[i] ?? 0,
      fill: resolvedColors[i]?.fill ?? P_FILL[i % P_FILL.length] ?? '#7c3aed',
    })),
  [labels, values, resolvedColors])

  const totalPie = pieSlices.reduce((s, e) => s + e.value, 0)

  const primaryColor = resolvedColors[0] ?? { fill: P_FILL[0] ?? '#7c3aed', stroke: P_STROKE[0] ?? '#a78bfa' }

  const barGradDefs = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ id: string; fill: string }> = []
    resolvedColors.forEach(({ fill }) => {
      if (!seen.has(fill)) {
        seen.add(fill)
        result.push({ id: `bg-${fill.replace('#', '')}`, fill })
      }
    })
    return result
  }, [resolvedColors])

  const isPie   = kind === 'pie'
  const isDonut = kind === 'donut'
  const isLine  = kind === 'line'

  const manyBars      = !isPie && !isDonut && !isLine && labels.length > 5
  const barScrollable = !isPie && !isDonut && !isLine && labels.length > 6
  const barMinWidth   = barScrollable ? Math.max(labels.length * 80, 320) : 0
  const xAxisHeight   = manyBars ? 64 : 28
  const barHeight     = height + (manyBars ? 30 : 0)

  const pieDiameter = Math.min(height * 0.82, 168)

  const fmtTotal = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 10_000   ? `${Math.round(n / 1_000)}K`
    : n.toLocaleString()

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-[0_2px_14px_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-white/[0.06] dark:bg-[hsl(var(--card))] dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)]">

      {/* Accent gradient line across the top */}
      <div className={`absolute inset-x-0 top-0 h-px ${accentLine}`} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-3 w-3 ${accent}`} />
        </div>
        {title && (
          <p className="min-w-0 flex-1 text-[0.73rem] font-semibold leading-snug tracking-tight text-foreground">
            {title}
          </p>
        )}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.52rem] font-bold uppercase tracking-widest ${badge}`}>
          {meta.label}
        </span>
      </div>

      {/* Subtle divider */}
      <div className="mx-3 border-b border-slate-100/70 dark:border-white/[0.05]" />

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="px-3 pb-3 pt-3">

        {/* ─ Pie / Donut ───────────────────────────────────────────────────── */}
        {(isPie || isDonut) ? (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">

            {/* Ring */}
            <div className="relative shrink-0" style={{ width: pieDiameter, height: pieDiameter }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieSlices}
                    cx="50%"
                    cy="50%"
                    innerRadius={isDonut ? '52%' : '0%'}
                    outerRadius="88%"
                    paddingAngle={pieSlices.length > 1 ? 3 : 0}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive
                  >
                    {pieSlices.map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={entry.fill}
                        style={{ filter: `drop-shadow(0 2px 8px ${entry.fill}55)` }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Donut center total */}
              {isDonut && totalPie > 0 && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-px">
                  <span className="text-sm font-extrabold tabular-nums leading-none text-foreground">
                    {fmtTotal(totalPie)}
                  </span>
                  <span className="text-[0.52rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    Total
                  </span>
                </div>
              )}
            </div>

            {/* Premium legend with glow swatches + progress bars */}
            <div className="flex w-full min-w-0 flex-col gap-2.5 sm:flex-1">
              {pieSlices.map((entry) => {
                const pct = totalPie > 0 ? (entry.value / totalPie) * 100 : 0
                return (
                  <div key={entry.name} className="space-y-1">
                    <div className="flex items-center gap-2 text-[0.7rem]">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[4px]"
                        style={{
                          background: entry.fill,
                          boxShadow: `0 0 7px ${entry.fill}99`,
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.name}</span>
                      <span className="shrink-0 text-[0.6rem] font-medium text-muted-foreground">
                        {pct.toFixed(1)}%
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-foreground">
                        {entry.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="ml-[18px] h-[3px] overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: entry.fill,
                          boxShadow: `0 0 4px ${entry.fill}88`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        ) : isLine ? (
          /* ─ Area / Line ──────────────────────────────────────────────────── */
          <div style={{ width: '100%', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={height}>
              <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="al-0" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={primaryColor.stroke} stopOpacity={0.45} />
                    <stop offset="65%"  stopColor={primaryColor.stroke} stopOpacity={0.08} />
                    <stop offset="100%" stopColor={primaryColor.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.25} />
                <XAxis
                  dataKey="name"
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={36} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={primaryColor.stroke}
                  strokeWidth={2.5}
                  fill="url(#al-0)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    stroke: '#fff',
                    fill: primaryColor.stroke,
                    style: { filter: `drop-shadow(0 0 6px ${primaryColor.stroke}aa)` },
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        ) : (
          /* ─ Bar ─────────────────────────────────────────────────────────── */
          <div style={{ width: '100%', minWidth: 0, overflowX: barScrollable ? 'auto' : 'visible' }}>
            <div style={{ minWidth: barScrollable ? barMinWidth : '100%' }}>
              <ResponsiveContainer width="100%" height={barHeight}>
                <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
                  <BarGradients items={barGradDefs} />
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.22} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={manyBars
                      ? { fontSize: 8.5, fill: 'hsl(var(--muted-foreground))', angle: -45, textAnchor: 'end' as const, fontWeight: 500 }
                      : axisStyle
                    }
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    height={xAxisHeight}
                  />
                  <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={36} />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35, radius: 6 }}
                  />
                  <Bar dataKey="value" radius={[7, 7, 0, 0]}>
                    {data.map((_, i) => {
                      const { fill } = resolvedColors[i] ?? { fill: P_FILL[i % P_FILL.length] ?? '#7c3aed' }
                      return (
                        <Cell
                          key={`c-${i}`}
                          fill={`url(#bg-${fill.replace('#', '')})`}
                          style={{ filter: `drop-shadow(0 3px 6px ${fill}33)` }}
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
