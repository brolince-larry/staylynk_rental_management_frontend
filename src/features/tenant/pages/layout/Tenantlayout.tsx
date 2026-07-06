import React, { type ReactNode, useEffect, useMemo, useState } from 'react'
import { AppShell, type NavItem } from '@/components/layouts/AppShell'
import {
  LayoutDashboard, FileText, BedDouble, Receipt, History,
  Wrench, MessageSquare, Megaphone, FileArchive,
  User, HelpCircle, Sparkles,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useTenantAnnouncements } from '@/features/admin/layout/hooks/useAnnouncements'

const STORAGE_KEY = (orgId: string) => `ann_read_${orgId}`

function getReadIds(orgId: string): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(orgId))
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
  } catch {
    return new Set()
  }
}

function useUnreadAnnouncementCount(): number {
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? '')
  const { data } = useTenantAnnouncements({ per_page: 50 })
  const rows = data?.data ?? []

  const [readIds, setReadIds] = useState<Set<number>>(() => getReadIds(orgId))

  // Re-sync from localStorage when storage changes (e.g. tenant marks items read)
  useEffect(() => {
    const onStorage = () => setReadIds(getReadIds(orgId))
    window.addEventListener('storage', onStorage)
    // Also poll localStorage every 5 s to catch same-tab updates
    const timer = setInterval(() => setReadIds(getReadIds(orgId)), 5000)
    return () => { window.removeEventListener('storage', onStorage); clearInterval(timer) }
  }, [orgId])

  return useMemo(() => rows.filter((r) => !readIds.has(r.id)).length, [rows, readIds])
}

export default function TenantLayout({ children }: { children: ReactNode }): React.ReactElement {
  const unread = useUnreadAnnouncementCount()

  const nav: NavItem[] = [
    { label: 'Dashboard',            href: '/tenant/dashboard',    icon: LayoutDashboard, section: '' },
    { label: 'My Lease',             href: '/tenant/lease',        icon: FileText,        section: 'MY ACCOMMODATION' },
    { label: 'My Room',              href: '/tenant/room',         icon: BedDouble,       section: 'MY ACCOMMODATION' },
    { label: 'Bills & Payments',     href: '/tenant/invoices',     icon: Receipt,         section: 'MY ACCOMMODATION' },
    { label: 'Payment History',      href: '/tenant/payments',     icon: History,         section: 'MY ACCOMMODATION' },
    { label: 'Maintenance Requests', href: '/tenant/maintenance',  icon: Wrench,          section: 'MY ACCOMMODATION' },
    { label: 'Messages',             href: '/tenant/messages',     icon: MessageSquare,   section: 'COMMUNICATION' },
    {
      label: 'Announcements', href: '/tenant/announcements', icon: Megaphone, section: 'COMMUNICATION',
      badge: unread > 0 ? unread : undefined,
    },
    { label: 'Documents',            href: '/tenant/documents',    icon: FileArchive,     section: 'COMMUNICATION' },
    { label: 'AI Assistant',         href: '/tenant/ai',           icon: Sparkles,        section: 'ACCOUNT' },
    { label: 'Profile',              href: '/tenant/profile',      icon: User,            section: 'ACCOUNT' },
    { label: 'Help & Support',       href: '/tenant/support',      icon: HelpCircle,      section: 'ACCOUNT' },
  ]

  return (
    <AppShell navItems={nav} role="tenant" logoLabel="StayLynk" logoSub="Tenant Portal">
      {children}
    </AppShell>
  )
}
