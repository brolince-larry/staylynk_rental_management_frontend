// src/constants/routes.ts
// Typed route constants — prevents magic strings in NavLink/navigate calls.

export const ROUTES = {
  // ── Public ──────────────────────────────────────────────────────
  LOGIN:    '/login',
  REGISTER: '/register',

  // ── SuperAdmin ───────────────────────────────────────────────────
  SA: {
    DASHBOARD:     '/superadmin/dashboard',
    ORGANIZATIONS: '/superadmin/organizations',
    PLANS:         '/superadmin/plans',
    BILLING:       '/superadmin/billing',
    PAYMENT_CREDENTIALS: '/superadmin/payment-credentials',
    VERIFICATIONS: '/superadmin/verifications',
    USERS:         '/superadmin/users',
    AUDIT_LOGS:    '/superadmin/audit-logs',
    REPORTS:       '/superadmin/reports',
    SYSTEM:        '/superadmin/system',
    PROFILE:       '/superadmin/profile',
  },

  // ── Admin ────────────────────────────────────────────────────────
  ADMIN: {
    DASHBOARD:     '/admin/dashboard',
    PROPERTIES:    '/admin/properties',
    ROOM_TYPES:    '/admin/room-types',
    ROOMS:         '/admin/rooms',
    BOOKINGS:      '/admin/bookings',
    TENANTS:       '/admin/tenants',
    INVOICES:      '/admin/invoices',
    RENT:          '/admin/rent',
    LEASES:        '/admin/leases',
    REPORTS:       '/admin/reports',
    SETTINGS:      '/admin/settings',
    ORG_USERS:     '/admin/org-users',
    BILLING:       '/admin/billing',
    LISTINGS:      '/admin/listings',
    VERIFICATION:  '/admin/verification',
    ANNOUNCEMENTS: '/admin/announcements',
    PROFILE:       '/admin/profile',
  },

  // ── Manager ──────────────────────────────────────────────────────
  MANAGER: {
    DASHBOARD:    '/manager/dashboard',
    BOOKINGS:     '/manager/bookings',
    CHECK_IN_OUT: '/manager/check-in-out',
    LEASES:       '/manager/leases',
    PAYMENTS:     '/manager/payments',
    EXPENSES:     '/manager/expenses',
    ANNOUNCEMENTS:'/manager/announcements',
    MAINTENANCE:  '/manager/maintenance',
    MESSAGES:     '/manager/messages',
    PROFILE:      '/manager/profile',
  },

  // ── Tenant ───────────────────────────────────────────────────────
  TENANT: {
    DASHBOARD:    '/tenant/dashboard',
    LEASE:        '/tenant/lease',
    ROOM:         '/tenant/room',
    INVOICES:     '/tenant/invoices',
    PAYMENTS:     '/tenant/payments',
    MAINTENANCE:  '/tenant/maintenance',
    MESSAGES:     '/tenant/messages',
    ANNOUNCEMENTS:'/tenant/announcements',
    DOCUMENTS:    '/tenant/documents',
    PROFILE:      '/tenant/profile',
    SETTINGS:     '/tenant/settings',
    SUPPORT:      '/tenant/support',
  },
} as const

// Utility — build a dynamic route with an ID
export function routeWithId(base: string, id: number | string): string {
  return `${base}/${id}`
}
