import React from 'react'
import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import { PageHeader, SectionCard } from '@/components/ui'

const PAGE_COPY: Record<string, { title: string; subtitle: string }> = {
  '/superadmin/revenue-sharing': {
    title: 'Revenue Sharing',
    subtitle: 'Revenue sharing controls will appear here when enabled.',
  },
  '/superadmin/permissions': {
    title: 'Permissions',
    subtitle: 'Platform permission management will appear here when enabled.',
  },
  '/superadmin/announcements': {
    title: 'Announcements',
    subtitle: 'Platform-wide announcement management will appear here when enabled.',
  },
  '/superadmin/performance': {
    title: 'Performance Monitor',
    subtitle: 'Detailed performance monitoring will appear here when enabled.',
  },
  '/admin/room-types': {
    title: 'Room Types',
    subtitle: 'Room type management will appear here when enabled.',
  },
  '/admin/announcements': {
    title: 'Announcements',
    subtitle: 'Organization announcement management will appear here when enabled.',
  },
  '/manager/announcements': {
    title: 'Announcements',
    subtitle: 'Property announcement tools will appear here when enabled.',
  },
  '/tenant/announcements': {
    title: 'Announcements',
    subtitle: 'Property announcements will appear here when enabled.',
  },
  '/tenant/profile': {
    title: 'Profile',
    subtitle: 'Tenant profile management will appear here when enabled.',
  },
  '/tenant/settings': {
    title: 'Settings',
    subtitle: 'Tenant settings will appear here when enabled.',
  },
  '/tenant/support': {
    title: 'Help & Support',
    subtitle: 'Support options will appear here when enabled.',
  },
}

export default function PlaceholderPage(): React.ReactElement {
  const location = useLocation()
  const copy = PAGE_COPY[location.pathname] ?? {
    title: 'Coming Soon',
    subtitle: 'This page is available as an independent route.',
  }

  return (
    <>
      <Helmet><title>{copy.title} — StayLynk</title></Helmet>
      <div className="p-6">
        <PageHeader title={copy.title} subtitle={copy.subtitle} />
        <SectionCard title="Not enabled yet">
          <p className="text-sm text-muted-foreground">
            This sidebar item opens independently and does not make background requests until a real data view is added.
          </p>
        </SectionCard>
      </div>
    </>
  )
}
