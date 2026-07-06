import React, { type ReactNode } from 'react'
import { AppShell, type NavItem } from '@/components/layouts/AppShell'
import { PropertySwitcher } from '@/features/admin/components/PropertySwitcher'
import { KnowledgeWidget } from '@/features/admin/components/KnowledgeWidget'
import {
  LayoutDashboard, Building2, BedDouble, CalendarCheck,
  Users, FileText, DollarSign, BookOpen, BarChart3,
  Settings, UserCog, Megaphone, BookMarked,
  Home, CreditCard, User, Sparkles, Link2, Receipt,
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
  { label: 'Admins & Roles', href: '/admin/org-users', icon: UserCog, section: 'SAAS MANAGEMENT' },
  { label: 'AI Assistant', href: '/admin/ai', icon: Sparkles, section: 'AI' },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3, section: 'SYSTEM' },
  { label: 'Profile', href: '/admin/profile', icon: User, section: 'SYSTEM' },
  { label: 'Settings', href: '/admin/settings', icon: Settings, section: 'SYSTEM' },
]

export default function AdminLayout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <AppShell
      navItems={NAV}
      role="admin"
      logoLabel="StayLynk"
      logoSub="Admin Portal"
      topbarSlot={<><PropertySwitcher /><KnowledgeWidget /></>}
    >
      {children}
    </AppShell>
  )
}
