import React, { type ReactNode } from 'react'
import { AppShell, type NavItem } from '@/components/layouts/AppShell'
import { PropertySwitcher } from '@/features/admin/components/PropertySwitcher'
import {
  LayoutDashboard, CalendarCheck, ArrowLeftRight, BookMarked,
  DollarSign, Receipt, Wrench, MessageSquare, Megaphone, Building2, BedDouble, Home, User, Sparkles,
} from 'lucide-react'

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/manager/dashboard', icon: LayoutDashboard, section: '' },
  { label: 'Properties', href: '/manager/properties', icon: Building2, section: 'PROPERTY MANAGEMENT' },
  { label: 'Rooms & Beds', href: '/manager/rooms', icon: BedDouble, section: 'PROPERTY MANAGEMENT' },
  { label: 'Bookings', href: '/manager/bookings', icon: CalendarCheck, section: 'BOOKINGS & TENANTS' },
  { label: 'Tenants', href: '/manager/tenants', icon: Home, section: 'BOOKINGS & TENANTS' },
  { label: 'Check-In / Out', href: '/manager/check-in-out', icon: ArrowLeftRight, section: 'BOOKINGS & TENANTS' },
  { label: 'Lease Agreements', href: '/manager/leases', icon: BookMarked, section: 'BOOKINGS & TENANTS' },
  { label: 'Payments', href: '/manager/payments', icon: DollarSign, section: 'FINANCE' },
  { label: 'Expenses', href: '/manager/expenses', icon: Receipt, section: 'FINANCE' },
  { label: 'Announcements', href: '/manager/announcements', icon: Megaphone, section: 'COMMUNICATION' },
  { label: 'Messages', href: '/manager/messages', icon: MessageSquare, section: 'COMMUNICATION' },
  { label: 'Maintenance', href: '/manager/maintenance', icon: Wrench, section: 'COMMUNICATION' },
  { label: 'AI Assistant', href: '/manager/ai', icon: Sparkles, section: 'AI' },
  { label: 'Profile', href: '/manager/profile', icon: User, section: 'ACCOUNT' },
]

export default function ManagerLayout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <AppShell
      navItems={NAV}
      role="manager"
      logoLabel="StayLynk"
      logoSub="Manager Portal"
      topbarSlot={<PropertySwitcher role="manager" />}
    >
      {children}
    </AppShell>
  )
}
