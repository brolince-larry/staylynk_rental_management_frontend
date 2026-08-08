import React, { type ReactNode, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AppShell, type NavItem } from '@/components/layouts/AppShell'
import { PropertySwitcher } from '@/features/admin/components/PropertySwitcher'
import { KnowledgeWidget } from '@/features/admin/components/KnowledgeWidget'
import { PlanIntroModal } from '@/features/admin/components/PlanIntroModal'
import { useAdminUnreadMessagesCount, useAdminPendingBookingsCount } from './hooks'
import { useAuthStore } from '@/store/auth.store'
import { useRealtime } from '@/providers/realtimeContext'
import { useToast } from '@/hooks'
import { ToastContainer } from '@/components/forms'
import {
  LayoutDashboard, Building2, BedDouble, CalendarCheck,
  Users, FileText, DollarSign, BookOpen, BarChart3,
  Settings, UserCog, Megaphone, BookMarked,
  Home, CreditCard, User, Sparkles, Link2, Receipt, MessageSquare,
} from 'lucide-react'

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, section: '' },
  { label: 'Tenants', href: '/admin/tenants', icon: Users, section: 'TENANT MANAGEMENT' },
  { label: 'Bookings', href: '/admin/bookings', icon: CalendarCheck, section: 'TENANT MANAGEMENT' },
  { label: 'Rooms', href: '/admin/rooms', icon: BedDouble, section: 'TENANT MANAGEMENT' },
  { label: 'Room Invites', href: '/admin/invites', icon: Link2, section: 'TENANT MANAGEMENT' },
  { label: 'Rent Collection', href: '/admin/rent', icon: DollarSign, section: 'TENANT MANAGEMENT' },
  { label: 'Invoices', href: '/admin/invoices', icon: FileText, section: 'TENANT MANAGEMENT' },
  { label: 'Properties', href: '/admin/properties', icon: Building2, section: 'PROPERTY MANAGEMENT' },
  { label: 'Leases', href: '/admin/leases', icon: BookMarked, section: 'PROPERTY MANAGEMENT' },
  { label: 'Public Listings', href: '/admin/listings', icon: Home, section: 'PROPERTY MANAGEMENT' },
  { label: 'Expenses', href: '/admin/expenses', icon: Receipt, section: 'PROPERTY MANAGEMENT' },
  { label: 'Subscription Billing', href: '/admin/billing', icon: CreditCard, section: 'SAAS MANAGEMENT' },
  { label: 'Trusted Verification', href: '/admin/verification', icon: BookOpen, section: 'SAAS MANAGEMENT' },
  { label: 'Announcements', href: '/admin/announcements', icon: Megaphone, section: 'SAAS MANAGEMENT' },
  { label: 'Messages', href: '/admin/messages', icon: MessageSquare, section: 'COMMUNICATION' },
  { label: 'Admins & Roles', href: '/admin/org-users', icon: UserCog, section: 'SAAS MANAGEMENT' },
  { label: 'AI Assistant', href: '/admin/ai', icon: Sparkles, section: 'AI' },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3, section: 'SYSTEM' },
  { label: 'Profile', href: '/admin/profile', icon: User, section: 'SYSTEM' },
  { label: 'Settings', href: '/admin/settings', icon: Settings, section: 'SYSTEM' },
]

// Sidebar badge — server-driven count kept fresh from any page via a
// WebSocket subscription, not just while the Messages page is mounted.
function useUnreadMessagesBadge(): number {
  const { token, user } = useAuthStore()
  const userId = user?.id?.toString() ?? ''
  const { data: unread = 0 } = useAdminUnreadMessagesCount()
  const qc = useQueryClient()
  const { subscribePrivate } = useRealtime()
  const userChannel = useMemo(() => (
    token && userId ? `users.${userId}` : null
  ), [token, userId])

  useEffect(() => {
    if (!userChannel) return
    const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'messages'] })
    const cleanupSent = subscribePrivate(userChannel, '.message.sent', refresh)
    const cleanupRead = subscribePrivate(userChannel, '.message.read', refresh)
    return () => { cleanupSent(); cleanupRead() }
  }, [userChannel, subscribePrivate, qc])

  return unread
}

// Sidebar badge for Bookings, plus a global toast — kept live from any page
// via the same private notification channel the bell already subscribes to,
// filtered to booking-category events (new hunter requests).
function useBookingRequestAlerts(): { count: number; toasts: ReturnType<typeof useToast>['toasts']; dismiss: (id: string) => void } {
  const { token, user } = useAuthStore()
  const userId = user?.id?.toString() ?? ''
  const { data: count = 0 } = useAdminPendingBookingsCount()
  const qc = useQueryClient()
  const { subscribePrivate } = useRealtime()
  const { toasts, info, dismiss } = useToast()
  const notificationsChannel = useMemo(() => (
    token && userId ? `notifications.${userId}` : null
  ), [token, userId])

  useEffect(() => {
    if (!notificationsChannel) return

    return subscribePrivate<{ category?: string; type?: string; title?: string; body?: string }>(
      notificationsChannel,
      '.new.notification',
      (payload) => {
        if (payload.type !== 'new_booking_request') return
        void qc.invalidateQueries({ queryKey: ['admin', 'bookings'] })
        info(payload.title ?? 'New Booking Request', payload.body)
      },
    )
  }, [notificationsChannel, subscribePrivate, qc, info])

  return { count, toasts, dismiss }
}

export default function AdminLayout({ children }: { children: ReactNode }): React.ReactElement {
  const unreadMessages = useUnreadMessagesBadge()
  const { count: pendingBookings, toasts: bookingToasts, dismiss: dismissBookingToast } = useBookingRequestAlerts()
  const nav = useMemo(
    () => NAV.map((item) => {
      if (item.href === '/admin/messages') return { ...item, badge: unreadMessages > 0 ? unreadMessages : undefined }
      if (item.href === '/admin/bookings') return { ...item, badge: pendingBookings > 0 ? pendingBookings : undefined }
      return item
    }),
    [unreadMessages, pendingBookings],
  )

  return (
    <AppShell
      navItems={nav}
      role="admin"
      logoLabel="StayLynk"
      logoSub="Admin Portal"
      topbarSlot={<><PropertySwitcher /><span className="hidden sm:inline-flex"><KnowledgeWidget /></span></>}
    >
      {children}
      <PlanIntroModal />
      <ToastContainer toasts={bookingToasts} dismiss={dismissBookingToast} />
    </AppShell>
  )
}
