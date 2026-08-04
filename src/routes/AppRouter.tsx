// src/routes/AppRouter.tsx
// Production router:
//   - Lazy-loaded role chunks (code splitting)
//   - RBAC guards on every protected route
//   - Root redirects to role dashboard after login
//   - 404 fallback

import React, { lazy, Suspense } from 'react'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useRouteError,
} from 'react-router-dom'
import { AuthGuard, RouteRoleGuard, GuestGuard } from '@/auth/guards'
import { normalizeDashboardPath } from '@/auth/routeAccess'
import { PageLoader } from '@/components/feedback/PageLoader'
import { AuthProvider } from '@/providers/AuthProvider'
import { RealtimeProvider } from '@/providers/RealtimeProvider'
import { publicSiteUrl } from '@/config/env'
import { useAuthStore } from '@/store/auth.store'

// ─── Suspense wrapper ─────────────────────────────────────────────────────
function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

// ─── Auth ──────────────────────────────────────────────────────────────────
const LoginPage          = lazy(() => import('@/api/pages/LoginPage'))
const RegisterPage       = lazy(() => import('@/api/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/api/pages/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('@/api/pages/ResetPasswordPage'))
const NotFoundPage = lazy(() => import('@/api/pages/NotFoundPage'))
const PlaceholderPage = lazy(() => import('@/features/shared/pages/PlaceholderPage'))
const ProfilePage = lazy(() => import('@/features/shared/pages/Profile'))
const ListingDetailPage = lazy(() => import('@/features/public/pages/ListingDetail'))

// ─── Layouts ──────────────────────────────────────────────────────────────
const SuperAdminLayout = lazy(() => import('@/features/superadmin/layout/SuperAdminLayout'))
const AdminLayout      = lazy(() => import('@/features/admin/layout/AdminLayout'))
const ManagerLayout    = lazy(() => import('@/features/manager/layout/ManagerLayout'))
const TenantLayout     = lazy(() => import('@/features/tenant/pages/layout/Tenantlayout'))

// ─── SuperAdmin pages ─────────────────────────────────────────────────────
const SADashboard     = lazy(() => import('@/features/superadmin/pages/Dashboard'))
const SAOrganizations = lazy(() => import('@/features/superadmin/pages/Organizations'))
const SAPlans         = lazy(() => import('@/features/superadmin/pages/Plans'))
const SABilling       = lazy(() => import('@/features/superadmin/pages/Billing'))
const SAPaymentCredentials = lazy(() => import('@/features/superadmin/pages/PaymentCredentials'))
const SAPaymentCredentialApproval = lazy(() => import('@/features/superadmin/pages/PaymentCredentialApproval'))
const SAVerifications = lazy(() => import('@/features/superadmin/pages/Verifications'))
const SAUsers         = lazy(() => import('@/features/superadmin/pages/Users'))
const SAAuditLogs     = lazy(() => import('@/features/superadmin/pages/AuditLogs'))
const SAReports       = lazy(() => import('@/features/superadmin/pages/Reports'))
const SASystem        = lazy(() => import('@/features/superadmin/pages/System'))
const SASecurity          = lazy(() => import('@/features/superadmin/pages/Security'))
const SABlockedIPs        = lazy(() => import('@/features/superadmin/pages/BlockedIPs'))
const SAAnnouncements     = lazy(() => import('@/features/superadmin/pages/Announcements'))
const SAPermissions       = lazy(() => import('@/features/superadmin/pages/Permissions'))

// ─── Admin pages ──────────────────────────────────────────────────────────
const AdminDashboard    = lazy(() => import('@/features/admin/pages/Dashboard'))
const AdminProperties   = lazy(() => import('@/features/admin/pages/Properties'))
const AdminRooms        = lazy(() => import('@/features/admin/pages/Rooms'))
const AdminBookings     = lazy(() => import('@/features/admin/pages/Bookings'))
const AdminTenants      = lazy(() => import('@/features/admin/pages/Tenants'))
const AdminInvoices     = lazy(() => import('@/features/admin/pages/Invoices'))
const AdminRent         = lazy(() => import('@/features/admin/pages/Rent'))
const AdminLeases       = lazy(() => import('@/features/admin/pages/Leases'))
const AdminReports      = lazy(() => import('@/features/admin/pages/Reports'))
const AdminSettings     = lazy(() => import('@/features/admin/pages/Settings'))
const AdminOrgUsers     = lazy(() => import('@/features/admin/pages/OrgUsers'))
const AdminBilling      = lazy(() => import('@/features/admin/pages/Billing'))
const AdminListings     = lazy(() => import('@/features/admin/pages/Listings'))
const AdminExpenses     = lazy(() => import('@/features/admin/pages/Expenses'))
const AdminVerification  = lazy(() => import('@/features/admin/pages/Verification'))
const AdminInvites       = lazy(() => import('@/features/admin/pages/Invites'))
const AdminAnnouncements = lazy(() => import('@/features/admin/pages/Announcements'))
const AdminMessages      = lazy(() => import('@/features/admin/pages/Messages'))
const AIPage             = lazy(() => import('@/features/shared/pages/AIPage'))
const InviteRegisterPage = lazy(() => import('@/features/public/pages/InviteRegister'))
const TermsPage          = lazy(() => import('@/features/public/pages/Terms'))
const PrivacyPolicyPage  = lazy(() => import('@/features/public/pages/PrivacyPolicy'))

// ─── Manager pages ────────────────────────────────────────────────────────
const ManagerDashboard  = lazy(() => import('@/features/manager/layout/pages/Dashboard'))
const ManagerProperties = lazy(() => import('@/features/manager/layout/pages/Properties'))
const ManagerListings   = lazy(() => import('@/features/manager/layout/pages/Listings'))
const ManagerInvites    = lazy(() => import('@/features/manager/layout/pages/Invites'))
const ManagerRooms      = lazy(() => import('@/features/manager/layout/pages/Rooms'))
const ManagerBookings   = lazy(() => import('@/features/manager/layout/pages/Bookings'))
const ManagerTenants    = lazy(() => import('@/features/manager/layout/pages/Tenants'))
const ManagerCheckInOut = lazy(() => import('@/features/manager/layout/pages/CheckInOut'))
const ManagerLeases     = lazy(() => import('@/features/manager/layout/pages/Leases'))
const ManagerPayments   = lazy(() => import('@/features/manager/layout/pages/Payments'))
const ManagerExpenses   = lazy(() => import('@/features/manager/layout/pages/Expenses'))
const ManagerMaintenance    = lazy(() => import('@/features/manager/layout/pages/Maintenance'))
const ManagerMessages       = lazy(() => import('@/features/manager/layout/pages/Messages'))
const ManagerAnnouncements  = lazy(() => import('@/features/manager/layout/pages/Announcements'))

// ─── Tenant pages ─────────────────────────────────────────────────────────
const TenantDashboard   = lazy(() => import('@/features/tenant/pages/Dashboard'))
const TenantLease       = lazy(() => import('@/features/tenant/pages/Lease'))
const TenantRoom        = lazy(() => import('@/features/tenant/pages/Room'))
const TenantInvoices    = lazy(() => import('@/features/tenant/pages/Invoices'))
const TenantPayments    = lazy(() => import('@/features/tenant/pages/Payments'))
const TenantMaintenance = lazy(() => import('@/features/tenant/pages/Maintenance'))
const TenantMessages    = lazy(() => import('@/features/tenant/pages/Messages'))
const TenantDocuments       = lazy(() => import('@/features/tenant/pages/Documents'))
const TenantSupport         = lazy(() => import('@/features/tenant/pages/Support'))
const TenantAnnouncements   = lazy(() => import('@/features/tenant/pages/Announcements'))

// ─── Root redirect ────────────────────────────────────────────────────────
function RootRedirect(): React.ReactElement {
  const { isAuthenticated, isInitialising, user } = useAuthStore()
  if (isInitialising) return <PageLoader />
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  return <Navigate to={normalizeDashboardPath(user)} replace />
}

function RouteErrorFallback(): React.ReactElement {
  const error = useRouteError()
  const message = import.meta.env.DEV && error instanceof Error
    ? error.message
    : 'Please refresh the page and try again.'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4 text-destructive" aria-hidden>
        <span className="text-2xl">!</span>
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reload page
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Go back
        </button>
      </div>
    </div>
  )
}

// ─── External redirect ────────────────────────────────────────────────────
function ExternalRedirect({ to }: { to: string }): null {
  React.useEffect(() => { window.location.replace(to) }, [to])
  return null
}

// ─── Router ───────────────────────────────────────────────────────────────
const routes = [
  { path: '/', element: <RootRedirect /> },

  // Public
  {
    path: '/login',
    element: <GuestGuard><S><LoginPage /></S></GuestGuard>,
  },
  {
    path: '/dashboard',
    element: <RootRedirect />,
  },
  {
    path: '/register',
    element: <GuestGuard><S><RegisterPage /></S></GuestGuard>,
  },
  {
    path: '/forgot-password',
    element: <GuestGuard><S><ForgotPasswordPage /></S></GuestGuard>,
  },
  {
    path: '/reset-password',
    element: <GuestGuard><S><ResetPasswordPage /></S></GuestGuard>,
  },
  {
    path: '/house-hunting',
    element: <ExternalRedirect to={`${publicSiteUrl}/hunter`} />,
  },
  {
    path: '/listings/:slug',
    element: <S><ListingDetailPage /></S>,
  },
  {
    path: '/invite/:token',
    element: <S><InviteRegisterPage /></S>,
  },
  {
    path: '/terms',
    element: <S><TermsPage /></S>,
  },
  {
    path: '/privacy',
    element: <S><PrivacyPolicyPage /></S>,
  },

  // SuperAdmin
  {
    path: '/superadmin',
    element: (
      <AuthGuard>
        <RouteRoleGuard requiredRole="superadmin">
          <S><SuperAdminLayout><Outlet /></SuperAdminLayout></S>
        </RouteRoleGuard>
      </AuthGuard>
    ),
    children: [
      { index: true,           element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard',     element: <S><SADashboard /></S> },
      { path: 'organizations', element: <S><SAOrganizations /></S> },
      { path: 'plans',         element: <S><SAPlans /></S> },
      { path: 'billing',       element: <S><SABilling /></S> },
      { path: 'payment-credentials', element: <S><SAPaymentCredentials /></S> },
      { path: 'payment-credentials/approvals/:token', element: <S><SAPaymentCredentialApproval /></S> },
      { path: 'verifications', element: <S><SAVerifications /></S> },
      { path: 'users',         element: <S><SAUsers /></S> },
      { path: 'audit-logs',    element: <S><SAAuditLogs /></S> },
      { path: 'security',      element: <S><SASecurity /></S> },
      { path: 'security/blocked-ips', element: <S><SABlockedIPs /></S> },
      { path: 'reports',       element: <S><SAReports /></S> },
      { path: 'system',        element: <S><SASystem /></S> },
      { path: 'profile',       element: <S><ProfilePage /></S> },
      { path: 'revenue-sharing',  element: <S><PlaceholderPage /></S> },
      { path: 'permissions',     element: <S><SAPermissions /></S> },
      { path: 'announcements',   element: <S><SAAnnouncements /></S> },
      { path: 'performance',     element: <S><PlaceholderPage /></S> },
      { path: 'ai',            element: <S><AIPage /></S> },
    ],
  },

  // Admin
  {
    path: '/admin',
    element: (
      <AuthGuard>
        <RouteRoleGuard requiredRole="admin">
          <S><AdminLayout><Outlet /></AdminLayout></S>
        </RouteRoleGuard>
      </AuthGuard>
    ),
    children: [
      { index: true,            element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard',      element: <S><AdminDashboard /></S> },
      { path: 'properties',     element: <S><AdminProperties /></S> },
      { path: 'rooms',          element: <S><AdminRooms /></S> },
      { path: 'bookings',       element: <S><AdminBookings /></S> },
      { path: 'tenants',        element: <S><AdminTenants /></S> },
      { path: 'invoices',       element: <S><AdminInvoices /></S> },
      { path: 'rent',           element: <S><AdminRent /></S> },
      { path: 'leases',         element: <S><AdminLeases /></S> },
      { path: 'reports',        element: <S><AdminReports /></S> },
      { path: 'settings',       element: <S><AdminSettings /></S> },
      { path: 'org-users',      element: <S><AdminOrgUsers /></S> },
      { path: 'billing',        element: <S><AdminBilling /></S> },
      { path: 'listings',       element: <S><AdminListings /></S> },
      { path: 'expenses',       element: <S><AdminExpenses /></S> },
      { path: 'verification',   element: <S><AdminVerification /></S> },
            { path: 'invites',        element: <S><AdminInvites /></S> },
      { path: 'announcements',  element: <S><AdminAnnouncements role="admin" /></S> },
      { path: 'messages',       element: <S><AdminMessages /></S> },
      { path: 'profile',        element: <S><ProfilePage /></S> },
      { path: 'ai',             element: <S><AIPage /></S> },
    ],
  },

  // Manager
  {
    path: '/manager',
    element: (
      <AuthGuard>
        <RouteRoleGuard requiredRole="manager">
          <S><ManagerLayout><Outlet /></ManagerLayout></S>
        </RouteRoleGuard>
      </AuthGuard>
    ),
    children: [
      { index: true,           element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard',     element: <S><ManagerDashboard /></S> },
      { path: 'properties',    element: <S><ManagerProperties /></S> },
      { path: 'listings',      element: <S><ManagerListings /></S> },
      { path: 'invites',       element: <S><ManagerInvites /></S> },
      { path: 'rooms',         element: <S><ManagerRooms /></S> },
      { path: 'bookings',      element: <S><ManagerBookings /></S> },
      { path: 'tenants',       element: <S><ManagerTenants /></S> },
      { path: 'check-in-out',  element: <S><ManagerCheckInOut /></S> },
      { path: 'leases',        element: <S><ManagerLeases /></S> },
      { path: 'payments',      element: <S><ManagerPayments /></S> },
      { path: 'expenses',      element: <S><ManagerExpenses /></S> },
      { path: 'maintenance',   element: <S><ManagerMaintenance /></S> },
      { path: 'messages',       element: <S><ManagerMessages /></S> },
      { path: 'announcements',  element: <S><ManagerAnnouncements /></S> },
      { path: 'profile',        element: <S><ProfilePage /></S> },
      // AI Assistant — gradual rollout: admin/superadmin only for now. Restore once AI is enabled for managers.
      // { path: 'ai',          element: <S><AIPage /></S> },
    ],
  },

  // Tenant
  {
    path: '/tenant',
    element: (
      <AuthGuard>
        <RouteRoleGuard requiredRole="tenant">
          <S><TenantLayout><Outlet /></TenantLayout></S>
        </RouteRoleGuard>
      </AuthGuard>
    ),
    children: [
      { index: true,         element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard',   element: <S><TenantDashboard /></S> },
      { path: 'lease',       element: <S><TenantLease /></S> },
      { path: 'room',        element: <S><TenantRoom /></S> },
      { path: 'invoices',    element: <S><TenantInvoices /></S> },
      { path: 'payments',    element: <S><TenantPayments /></S> },
      { path: 'maintenance', element: <S><TenantMaintenance /></S> },
      { path: 'messages',    element: <S><TenantMessages /></S> },
      { path: 'documents',      element: <S><TenantDocuments /></S> },
      { path: 'announcements',  element: <S><TenantAnnouncements /></S> },
      { path: 'profile',        element: <S><ProfilePage /></S> },
      { path: 'support',     element: <S><TenantSupport /></S> },
      // AI Assistant — gradual rollout: admin/superadmin only for now. Restore once AI is enabled for tenants.
      // { path: 'ai',       element: <S><AIPage /></S> },
    ],
  },

  // 404
  { path: '*', element: <S><NotFoundPage /></S> },
]

const router = createBrowserRouter([
  {
    element: (
      <AuthProvider>
        <RealtimeProvider>
          <Outlet />
        </RealtimeProvider>
      </AuthProvider>
    ),
    errorElement: <RouteErrorFallback />,
    children: routes,
  },
])

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />
}
