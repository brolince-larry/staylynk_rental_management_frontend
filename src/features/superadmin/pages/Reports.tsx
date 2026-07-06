// src/features/superadmin/pages/Reports.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { apiGet } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { QK } from '@/constants/queryKeys'
import { DateRangePicker } from '@/components/forms/DateRangePicker'
import { PageHeader, SectionCard, StatCard } from '@/components/ui'
import { RevenueTrendChart, PlanDistributionDonut } from '@/components/charts'
import { formatCurrency } from '@/utils/format'
import { format, subDays } from 'date-fns'
import { DollarSign, TrendingUp, Building2 } from 'lucide-react'

interface PlatformReport {
  total_revenue:     number
  mrr:               number
  new_organizations: number
  revenue_trend:     Array<{ period: string; revenue: number }>
  plan_distribution: Array<{ plan_name: string; active_subscribers: number; mrr: number }>
  period:            { from: string; to: string }
}

export default function Reports(): React.ReactElement {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to,   setTo]   = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data, isLoading } = useQuery({
    queryKey: QK.saReport(`${from}_${to}`),
    queryFn:  () =>
      apiGet<PlatformReport>('/superadmin/reports/platform', { from, to })
        .then(r => r.data),
    staleTime: 60_000,
  })

  const report = data as PlatformReport | undefined

  const currency = (val: number | undefined) =>
    val != null && !isNaN(val) ? formatCurrency(val) : '—'

  return (
    <>
      <Helmet><title>System Reports — StayLynk</title></Helmet>
      <div className="p-6 max-w-[1400px]">
        <PageHeader
          title="System Reports"
          subtitle="Platform-wide analytics and revenue reporting."
          actions={
            <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} showPresets />
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <StatCard
            label="Platform Revenue"
            value={currency(report?.total_revenue)}
            icon={<DollarSign className="h-4 w-4 text-violet-600" />}
            iconBg="bg-violet-100"
            loading={isLoading}
          />
          <StatCard
            label="MRR"
            value={currency(report?.mrr)}
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-100"
            loading={isLoading}
          />
          <StatCard
            label="New Orgs"
            value={report?.new_organizations ?? '—'}
            icon={<Building2 className="h-4 w-4 text-blue-600" />}
            iconBg="bg-blue-100"
            loading={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Revenue Trend">
            <RevenueTrendChart
              data={report?.revenue_trend ?? []}
              height={220}
              loading={isLoading}
            />
          </SectionCard>
          <SectionCard title="Subscription Distribution">
            <PlanDistributionDonut
              data={report?.plan_distribution ?? []}
              loading={isLoading}
            />
          </SectionCard>
        </div>
      </div>
    </>
  )
}
