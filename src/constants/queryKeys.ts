// src/constants/queryKeys.ts
// Single source of truth for all TanStack Query cache keys.
// Org-scoped keys prevent cross-tenant cache leakage.

export const QK = {
  // ── Auth ───────────────────────────────────────────────
  me: () => ['me'] as const,

  // ── Admin ──────────────────────────────────────────────
  adminDashboard: (orgId: string, filters?: object) =>
    ['admin', 'dashboard', orgId, filters] as const,

  properties: (orgId: string, params?: object) =>
    ['admin', 'properties', orgId, params] as const,
  property: (orgId: string, id: string) =>
    ['admin', 'properties', orgId, id] as const,
  propertyStats: (orgId: string, id: string) =>
    ['admin', 'properties', orgId, id, 'stats'] as const,
  deletedProperties: (orgId: string) =>
    ['admin', 'properties', orgId, 'deleted'] as const,

  rooms: (orgId: string, params?: object) =>
    ['admin', 'rooms', orgId, params] as const,
  room: (orgId: string, id: string) =>
    ['admin', 'rooms', orgId, id] as const,
  roomAvailability: (orgId: string, id: string, from: string, to: string) =>
    ['admin', 'rooms', orgId, id, 'availability', from, to] as const,

  roomTypes: (orgId: string) =>
    ['admin', 'room-types', orgId] as const,

  bookings: (orgId: string, params?: object) =>
    ['admin', 'bookings', orgId, params] as const,
  booking: (orgId: string, id: string) =>
    ['admin', 'bookings', orgId, id] as const,
  bookingSummary: (orgId: string, params?: object) =>
    ['admin', 'bookings', orgId, 'summary', params] as const,

  tenants: (orgId: string, params?: object) =>
    ['admin', 'tenants', orgId, params] as const,
  tenant: (orgId: string, id: string) =>
    ['admin', 'tenants', orgId, id] as const,
  tenantHistory: (orgId: string, id: string) =>
    ['admin', 'tenants', orgId, id, 'history'] as const,

  invoices: (orgId: string, params?: object) =>
    ['admin', 'invoices', orgId, params] as const,
  invoice: (orgId: string, id: string) =>
    ['admin', 'invoices', orgId, id] as const,
  invoiceSummary: (orgId: string, params?: object) =>
    ['admin', 'invoices', orgId, 'summary', params] as const,

  payments: (orgId: string, params?: object) =>
    ['admin', 'payments', orgId, params] as const,
  payment: (orgId: string, id: string) =>
    ['admin', 'payments', orgId, id] as const,
  paymentSummary: (orgId: string, params?: object) =>
    ['admin', 'payments', orgId, 'summary', params] as const,

  rent: (orgId: string, params?: object) =>
    ['admin', 'rent', orgId, params] as const,
  rentSummary: (orgId: string, month?: string, propertyId?: number) =>
    ['admin', 'rent', orgId, 'summary', month, propertyId] as const,

  leases: (orgId: string, params?: object) =>
    ['admin', 'leases', orgId, params] as const,
  lease: (orgId: string, id: string) =>
    ['admin', 'leases', orgId, id] as const,

  orgUsers: (orgId: string, params?: object) =>
    ['admin', 'org-users', orgId, params] as const,

  reports: (orgId: string, type: string, params?: object) =>
    ['admin', 'reports', orgId, type, params] as const,

  settings: (orgId: string) =>
    ['admin', 'settings', orgId] as const,

  adminBillingInvoices: (orgId: string, params?: object) =>
    ['admin', 'billing', orgId, 'invoices', params] as const,
  adminSubscriptionPlans: (orgId: string) =>
    ['admin', 'subscription', orgId, 'plans'] as const,
  adminSubscriptionCurrent: (orgId: string) =>
    ['admin', 'subscription', orgId, 'current'] as const,
  adminBillingPayment: (orgId: string, reference: string) =>
    ['admin', 'billing', orgId, 'payments', reference] as const,

  adminVerificationStatus: (orgId: string) =>
    ['admin', 'verification', orgId, 'status'] as const,
  adminListings: (orgId: string, params?: object) =>
    ['admin', 'listings', orgId, params] as const,
  adminListingInquiries: (orgId: string, params?: object) =>
    ['admin', 'listings', orgId, 'inquiries', params] as const,

  adminInvites: (orgId: string, params?: object) =>
    ['admin', 'invites', orgId, params] as const,
  adminInviteAnalytics: (orgId: string, params?: object) =>
    ['admin', 'invites', orgId, 'analytics', params] as const,
  adminInviteExports: (orgId: string) =>
    ['admin', 'invites', orgId, 'exports'] as const,

  // ── Manager ────────────────────────────────────────────
  managerDashboard: (orgId: string) =>
    ['manager', 'dashboard', orgId] as const,

  managerLeases: (orgId: string, params?: object) =>
    ['manager', 'leases', orgId, params] as const,
  managerLease: (orgId: string, id: string) =>
    ['manager', 'leases', orgId, id] as const,
  leaseSummary: (orgId: string) =>
    ['manager', 'leases', orgId, 'summary'] as const,
  leasesExpiring: (orgId: string, days?: number) =>
    ['manager', 'leases', orgId, 'expiring', days] as const,

  managerMaintenance: (orgId: string, params?: object) =>
    ['manager', 'maintenance', orgId, params] as const,
  maintenanceSummary: (orgId: string, params?: object) =>
    ['manager', 'maintenance', orgId, 'summary', params] as const,

  managerMessages: (orgId: string, params?: object) =>
    ['manager', 'messages', orgId, params] as const,
  managerMessage: (orgId: string, id: string) =>
    ['manager', 'messages', orgId, id] as const,

  managerExpenses: (orgId: string, params?: object) =>
    ['manager', 'expenses', orgId, params] as const,

  announcements: (orgId: string, params?: object) =>
    ['manager', 'announcements', orgId, params] as const,

  checkInOut: (orgId: string, params?: object) =>
    ['manager', 'check-in-out', orgId, params] as const,

  // ── Tenant ────────────────────────────────────────────
  tenantDashboard: (orgId: string, userId: string) =>
    ['tenant', 'dashboard', orgId, userId] as const,

  tenantLease: (orgId: string, userId: string) =>
    ['tenant', 'lease', orgId, userId] as const,
  tenantLeaseHistory: (orgId: string, userId: string) =>
    ['tenant', 'lease', orgId, userId, 'history'] as const,

  tenantInvoices: (orgId: string, userId: string, params?: object) =>
    ['tenant', 'invoices', orgId, userId, params] as const,
  tenantInvoice: (orgId: string, userId: string, id: string) =>
    ['tenant', 'invoices', orgId, userId, id] as const,

  tenantPayments: (orgId: string, userId: string, params?: object) =>
    ['tenant', 'payments', orgId, userId, params] as const,

  tenantMaintenance: (orgId: string, userId: string, params?: object) =>
    ['tenant', 'maintenance', orgId, userId, params] as const,
  tenantMaintenanceItem: (orgId: string, userId: string, id: string) =>
    ['tenant', 'maintenance', orgId, userId, id] as const,

  tenantMessages: (orgId: string, userId: string, params?: object) =>
    ['tenant', 'messages', orgId, userId, params] as const,
  tenantMessage: (orgId: string, userId: string, id: string) =>
    ['tenant', 'messages', orgId, userId, id] as const,
  tenantUnreadCount: (orgId: string, userId: string) =>
    ['tenant', 'messages', orgId, userId, 'unread'] as const,

  tenantAnnouncements: (orgId: string, userId: string, params?: object) =>
    ['tenant', 'announcements', orgId, userId, params] as const,

  tenantDocuments: (orgId: string, userId: string) =>
    ['tenant', 'documents', orgId, userId] as const,

  tenantRoom: (orgId: string, userId: string) =>
    ['tenant', 'room', orgId, userId] as const,

  // ── SuperAdmin ────────────────────────────────────────
  saDashboard: () => ['superadmin', 'dashboard'] as const,

  saOrganizations: (params?: object) =>
    ['superadmin', 'organizations', params] as const,
  saOrganization: (id: string) =>
    ['superadmin', 'organizations', id] as const,
  saOrgStats: (id: string) =>
    ['superadmin', 'organizations', id, 'stats'] as const,
  saOrgProperties: (id: string) =>
    ['superadmin', 'organizations', id, 'properties'] as const,

  saPlans: () => ['superadmin', 'plans'] as const,
  saPlanUsage: () => ['superadmin', 'plans', 'usage'] as const,

  saBilling: (params?: object) =>
    ['superadmin', 'billing', params] as const,
  saBillingOverview: () =>
    ['superadmin', 'billing', 'overview'] as const,

  saPaymentCredentials: (params?: object) =>
    ['superadmin', 'payment-credentials', params] as const,

  saVerifications: (params?: object) =>
    ['superadmin', 'verifications', params] as const,

  saUsers: (params?: object) =>
    ['superadmin', 'users', params] as const,
  saUserStats: () => ['superadmin', 'users', 'stats'] as const,

  saAuditLogs: (params?: object) =>
    ['superadmin', 'audit-logs', params] as const,
  saAuditSummary: () =>
    ['superadmin', 'audit-logs', 'summary'] as const,

  saSystem: () => ['superadmin', 'system'] as const,
  saSystemUsage: () => ['superadmin', 'system', 'usage'] as const,
  saSystemPerf: () => ['superadmin', 'system', 'performance'] as const,

  saReport: (period: string) =>
    ['superadmin', 'reports', period] as const,

  saRevenueSharing: (month?: string) =>
    ['superadmin', 'revenue-sharing', month] as const,

  // ── Security ──────────────────────────────────────────
  secDashboard: () => ['superadmin', 'security', 'dashboard'] as const,
  secEvents: (params?: object) => ['superadmin', 'security', 'events', params] as const,
  secThreats: () => ['superadmin', 'security', 'threats'] as const,
  secHeatmap: () => ['superadmin', 'security', 'heatmap'] as const,
  secBruteForce: () => ['superadmin', 'security', 'brute-force'] as const,
  secRiskyUsers: () => ['superadmin', 'security', 'risky-users'] as const,
  secCategoryStats: () => ['superadmin', 'security', 'stats', 'categories'] as const,
  secBlockedIPs: (params?: object) => ['superadmin', 'security', 'blocked-ips', params] as const,
}
