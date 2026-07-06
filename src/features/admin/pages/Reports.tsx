// src/features/admin/pages/Reports.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Download } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/api/client'
import { apiBaseUrl } from '@/config/env'
import { useAuthStore } from '@/store/auth.store'
import { QK } from '@/constants/queryKeys'
import { DateRangePicker } from '@/components/forms/DateRangePicker'
import { PageHeader, SectionCard, StatCard } from '@/components/ui'
import { OccupancyChart, RevenueDonut } from '@/components/charts'
import { Button } from '@/components/forms'
import { formatCurrency, formatPercent } from '@/utils/format'
import { format, subDays } from 'date-fns'
import { DollarSign, TrendingUp, BedDouble, FileText } from 'lucide-react'

export default function Reports(): React.ReactElement {
  const user  = useAuthStore(s => s.user)
  const orgId = user?.org?.id?.toString() ?? 'unknown'
  const currency = user?.org?.currency ?? 'USD'

  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to,   setTo]   = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data: revData, isLoading: revLoading } = useQuery({
    queryKey: QK.reports(orgId, 'revenue', { from, to }),
    queryFn:  () =>
      apiGet<Record<string, unknown>>('/admin/reports/revenue', { from, to })
        .then(r => r.data),
    staleTime: Infinity,
  })

  const { data: occData, isLoading: occLoading } = useQuery({
    queryKey: QK.reports(orgId, 'occupancy', { from, to }),
    queryFn:  () =>
      apiGet<Record<string, unknown>>('/admin/reports/occupancy', { from, to })
        .then(r => r.data),
    staleTime: Infinity,
  })

  const rev = revData as Record<string, unknown> | undefined
  const occ = occData as Record<string, unknown> | undefined

  return (
    <>
      <Helmet><title>Reports — StayLynk</title></Helmet>
      <div className="p-6 max-w-[1400px]">
        <PageHeader
          title="Reports"
          subtitle="Revenue, occupancy and collection analytics."
          actions={
            <div className="flex items-center gap-2">
              <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} showPresets />
              <a href={`${apiBaseUrl}/admin/reports/export?from=${from}&to=${to}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </a>
            </div>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total Revenue"   value={rev ? formatCurrency(rev.total_revenue as number, currency) : '—'} icon={<DollarSign className="h-4 w-4 text-violet-600" />} iconBg="bg-violet-100" loading={revLoading} />
          <StatCard label="Collected"       value={rev ? formatCurrency(rev.total_collected as number, currency) : '—'} icon={<TrendingUp className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-100" loading={revLoading} />
          <StatCard label="Avg Occupancy"   value={occ ? formatPercent(occ.avg_occupancy_rate as number) : '—'} icon={<BedDouble className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-100" loading={occLoading} />
          <StatCard label="Total Invoices"  value={rev?.total_invoices as number ?? '—'} icon={<FileText className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-100" loading={revLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Occupancy Over Time">
            <OccupancyChart
              data={(occ?.chart as Array<{ date: string; occupancy_rate: number }>) ?? []}
              height={220}
              loading={occLoading}
            />
          </SectionCard>
          <SectionCard title="Revenue Breakdown">
            <RevenueDonut data={rev?.breakdown as Parameters<typeof RevenueDonut>[0]['data'] ?? null} loading={revLoading} currency={currency} />
          </SectionCard>
        </div>
      </div>
    </>
  )
}
