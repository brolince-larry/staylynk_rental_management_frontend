import React, { type ReactNode } from 'react'
import { AppShell, type NavItem } from '@/components/layouts/AppShell'
import {
  LayoutDashboard, Building2, Users, CreditCard,
  Settings, Shield, BarChart3, Share2,
  Crown, Lock, Megaphone, AlertCircle, KeyRound, User, Sparkles,
  ShieldAlert, Ban,
} from 'lucide-react'

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/superadmin/dashboard', icon: LayoutDashboard, section: '' },
  { label: 'Organizations', href: '/superadmin/organizations', icon: Building2, section: 'TENANT MANAGEMENT' },
  { label: 'Admins', href: '/superadmin/users', icon: Users, section: 'TENANT MANAGEMENT' },
  { label: 'Subscription Plans', href: '/superadmin/plans', icon: Crown, section: 'SAAS MANAGEMENT' },
  { label: 'Billing & Payments', href: '/superadmin/billing', icon: CreditCard, section: 'SAAS MANAGEMENT' },
  { label: 'Payment Credentials', href: '/superadmin/payment-credentials', icon: KeyRound, section: 'SAAS MANAGEMENT' },
  { label: 'Revenue Sharing', href: '/superadmin/revenue-sharing', icon: Share2, section: 'SAAS MANAGEMENT' },
  { label: 'Permissions', href: '/superadmin/permissions', icon: Lock, section: 'SYSTEM MANAGEMENT' },
  { label: 'System Settings', href: '/superadmin/system', icon: Settings, section: 'SYSTEM MANAGEMENT' },
  { label: 'Announcements', href: '/superadmin/announcements', icon: Megaphone, section: 'SYSTEM MANAGEMENT' },
  { label: 'Landlord Verifications', href: '/superadmin/verifications', icon: Shield, section: 'SYSTEM MANAGEMENT' },
  { label: 'Audit Logs', href: '/superadmin/audit-logs', icon: Shield, section: 'SYSTEM MANAGEMENT' },
  { label: 'Security', href: '/superadmin/security', icon: ShieldAlert, section: 'SECURITY' },
  { label: 'Blocked IPs', href: '/superadmin/security/blocked-ips', icon: Ban, section: 'SECURITY' },
  { label: 'System Reports', href: '/superadmin/reports', icon: BarChart3, section: 'REPORTS & ANALYTICS' },
  { label: 'Performance Monitor', href: '/superadmin/performance', icon: AlertCircle, section: 'REPORTS & ANALYTICS' },
  { label: 'AI Assistant', href: '/superadmin/ai', icon: Sparkles, section: 'ACCOUNT' },
  { label: 'Profile', href: '/superadmin/profile', icon: User, section: 'ACCOUNT' },
]

export default function SuperAdminLayout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <AppShell navItems={NAV} role="superadmin" logoLabel="StayLynk" logoSub="Super Admin">
      {children}
    </AppShell>
  )
}
