import React, { type ReactNode, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AppShell, type NavItem } from '@/components/layouts/AppShell'
import { PropertySwitcher } from '@/features/admin/components/PropertySwitcher'
import { useManagerUnreadMessagesCount, useManagerPendingBookingsCount } from './hooks'
import { useAuthStore } from '@/store/auth.store'
import { useRealtime } from '@/providers/realtimeContext'
import { useToast } from '@/hooks'
import { ToastContainer } from '@/components/forms'
import {
  LayoutDashboard, CalendarCheck, ArrowLeftRight, BookMarked,
  DollarSign, Receipt, Wrench, MessageSquare, Megaphone, Building2, BedDouble, Home, User, Sparkles, Globe, Link2,
} from 'lucide-react'

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/manager/dashboard', icon: LayoutDashboard, section: '' },
  { label: 'Properties', href: '/manager/properties', icon: Building2, section: 'PROPERTY MANAGEMENT' },
  { label: 'Rooms & Beds', href: '/manager/rooms', icon: BedDouble, section: 'PROPERTY MANAGEMENT' },
  { label: 'Public Listings', href: '/manager/listings', icon: Globe, section: 'PROPERTY MANAGEMENT' },
  { label: 'Room Invites', href: '/manager/invites', icon: Link2, section: 'PROPERTY MANAGEMENT' },
  { label: 'Bookings', href: '/manager/bookings', icon: CalendarCheck, section: 'BOOKINGS & TENANTS' },
  { label: 'Tenants', href: '/manager/tenants', icon: Home, section: 'BOOKINGS & TENANTS' },
  { label: 'Check-In / Out', href: '/manager/check-in-out', icon: ArrowLeftRight, section: 'BOOKINGS & TENANTS' },
  { label: 'Lease Agreements', href: '/manager/leases', icon: BookMarked, section: 'BOOKINGS & TENANTS' },
  { label: 'Payments', href: '/manager/payments', icon: DollarSign, section: 'FINANCE' },
  { label: 'Expenses', href: '/manager/expenses', icon: Receipt, section: 'FINANCE' },
  { label: 'Announcements', href: '/manager/announcements', icon: Megaphone, section: 'COMMUNICATION' },
  { label: 'Messages', href: '/manager/messages', icon: MessageSquare, section: 'COMMUNICATION' },
  { label: 'Maintenance', href: '/manager/maintenance', icon: Wrench, section: 'COMMUNICATION' },
  // AI Assistant — gradual rollout: admin/superadmin only for now. Restore once AI is enabled for managers.
  // { label: 'AI Assistant', href: '/manager/ai', icon: Sparkles, section: 'AI' },
  { label: 'Profile', href: '/manager/profile', icon: User, section: 'ACCOUNT' },
]

// Sidebar badge — server-driven count kept fresh from any page via a
// WebSocket subscription, not just while the Messages page is mounted.
function useUnreadMessagesBadge(): number {
  const { token, user } = useAuthStore()
  const userId = user?.id?.toString() ?? ''
  const { data: unread = 0 } = useManagerUnreadMessagesCount()
  const qc = useQueryClient()
  const { subscribePrivate } = useRealtime()
  const userChannel = useMemo(() => (
    token && userId ? `users.${userId}` : null
  ), [token, userId])

  useEffect(() => {
    if (!userChannel) return
    const refresh = () => void qc.invalidateQueries({ queryKey: ['manager', 'messages'] })
    const cleanupSent = subscribePrivate(userChannel, '.message.sent', refresh)
    const cleanupRead = subscribePrivate(userChannel, '.message.read', refresh)
    return () => { cleanupSent(); cleanupRead() }
  }, [userChannel, subscribePrivate, qc])

  return unread
}

// Sidebar badge for Bookings, plus a global toast — same pattern as the
// Messages badge above, filtered to booking-category realtime events.
function useBookingRequestAlerts(): { count: number; toasts: ReturnType<typeof useToast>['toasts']; dismiss: (id: string) => void } {
  const { token, user } = useAuthStore()
  const userId = user?.id?.toString() ?? ''
  const { data: count = 0 } = useManagerPendingBookingsCount()
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
        void qc.invalidateQueries({ queryKey: ['manager', 'bookings'] })
        info(payload.title ?? 'New Booking Request', payload.body)
      },
    )
  }, [notificationsChannel, subscribePrivate, qc, info])

  return { count, toasts, dismiss }
}

export default function ManagerLayout({ children }: { children: ReactNode }): React.ReactElement {
  const unreadMessages = useUnreadMessagesBadge()
  const { count: pendingBookings, toasts: bookingToasts, dismiss: dismissBookingToast } = useBookingRequestAlerts()
  const nav = useMemo(
    () => NAV.map((item) => {
      if (item.href === '/manager/messages') return { ...item, badge: unreadMessages > 0 ? unreadMessages : undefined }
      if (item.href === '/manager/bookings') return { ...item, badge: pendingBookings > 0 ? pendingBookings : undefined }
      return item
    }),
    [unreadMessages, pendingBookings],
  )

  return (
    <AppShell
      navItems={nav}
      role="manager"
      logoLabel="StayLynk"
      logoSub="Manager Portal"
      topbarSlot={<PropertySwitcher role="manager" />}
    >
      {children}
      <ToastContainer toasts={bookingToasts} dismiss={dismissBookingToast} />
    </AppShell>
  )
}
