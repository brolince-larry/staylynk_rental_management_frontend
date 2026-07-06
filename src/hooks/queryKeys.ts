// src/constants/queryKeys.ts
// Central query key registry — every TanStack Query key defined here.
// Org-scoped keys prevent cross-tenant cache leakage.

export const QK = {
  // ── Auth ────────────────────────────────────────────────────────
  me: () => ['me'] as const,

  // ── Admin — properties ──────────────────────────────────────────
  properties:    (orgId: string, p?: object) => ['admin', 'properties', orgId, p] as const,
  property:      (orgId: string, id: number) => ['admin', 'properties', orgId, id] as const,
  propertyStats: (orgId: string, id: number) => ['admin', 'properties', orgId, id, 'stats'] as const,

  // ── Admin — rooms ────────────────────────────────────────────────
  rooms:           (orgId: string, p?: object) => ['admin', 'rooms', orgId, p] as const,
  room:            (orgId: string, id: number) => ['admin', 'rooms', orgId, id] as const,
  roomTypes:       (orgId: string)             => ['admin', 'room-types', orgId] as const,
  roomAvailability:(orgId: string, id: number, from: string, to: string) =>
    ['admin', 'rooms', orgId, id, 'availability', from, to] as const,

  // ── Admin — bookings ─────────────────────────────────────────────
  bookings:      (orgId: string, p?: object) => ['admin', 'bookings', orgId, p] as const,
  booking:       (orgId: string, id: number) => ['admin', 'bookings', orgId, id] as const,
  bookingSummary:(orgId: string, p?: object) => ['admin', 'bookings', orgId, 'summary', p] as const,

  // ── Admin — tenants ──────────────────────────────────────────────
  tenants:       (orgId: string, p?: object) => ['admin', 'tenants', orgId, p] as const,
  tenant:        (orgId: string, id: number) => ['admin', 'tenants', orgId, id] as const,
  tenantHistory: (orgId: string, id: number) => ['admin', 'tenants', orgId, id, 'history'] as const,

  // ── Admin — invoices ─────────────────────────────────────────────
  invoices:      (orgId: string, p?: object) => ['admin', 'invoices', orgId, p] as const,
  invoice:       (orgId: string, id: number) => ['admin', 'invoices', orgId, id] as const,
  invoiceSummary:(orgId: string, p?: object) => ['admin', 'invoices', orgId, 'summary', p] as const,

  // ── Admin — payments ─────────────────────────────────────────────
  payments:       (orgId: string, p?: object) => ['admin', 'payments', orgId, p] as const,
  paymentSummary: (orgId: string, p?: object) => ['admin', 'payments', orgId, 'summary', p] as const,

  // ── Admin — rent ─────────────────────────────────────────────────
  rent:        (orgId: string, p?: object)    => ['admin', 'rent', orgId, p] as const,
  rentSummary: (orgId: string, m?: string)    => ['admin', 'rent', orgId, 'summary', m] as const,

  // ── Admin — leases ───────────────────────────────────────────────
  leases: (orgId: string, p?: object) => ['admin', 'leases', orgId, p] as const,
  lease:  (orgId: string, id: number) => ['admin', 'leases', orgId, id] as const,

  // ── Admin — misc ─────────────────────────────────────────────────
  orgUsers:       (orgId: string, p?: object) => ['admin', 'org-users', orgId, p] as const,
  settings:       (orgId: string)             => ['admin', 'settings', orgId] as const,
  reports:        (orgId: string, type: string, p?: object) =>
    ['admin', 'reports', orgId, type, p] as const,

  // ── Admin dashboard ──────────────────────────────────────────────
  adminDashboard: (orgId: string, p?: object) => ['admin', 'dashboard', orgId, p] as const,

  // ── Manager ──────────────────────────────────────────────────────
  managerDashboard:  (orgId: string)             => ['manager', 'dashboard', orgId] as const,
  managerLeases:     (orgId: string, p?: object) => ['manager', 'leases', orgId, p] as const,
  managerLease:      (orgId: string, id: number) => ['manager', 'leases', orgId, id] as const,
  leaseSummary:      (orgId: string)             => ['manager', 'leases', orgId, 'summary'] as const,
  leasesExpiring:    (orgId: string, d?: number) => ['manager', 'leases', orgId, 'expiring', d] as const,
  managerMaintenance:(orgId: string, p?: object) => ['manager', 'maintenance', orgId, p] as const,
  maintenanceSummary:(orgId: string, p?: object) => ['manager', 'maintenance', orgId, 'summary', p] as const,
  managerMessages:   (orgId: string, p?: object) => ['manager', 'messages', orgId, p] as const,
  managerMessage:    (orgId: string, id: number) => ['manager', 'messages', orgId, id] as const,
  managerExpenses:   (orgId: string, p?: object) => ['manager', 'expenses', orgId, p] as const,
  announcements:     (orgId: string, p?: object) => ['manager', 'announcements', orgId, p] as const,
  checkInOut:        (orgId: string, p?: object) => ['manager', 'check-in-out', orgId, p] as const,

  // ── Tenant ───────────────────────────────────────────────────────
  tenantDashboard:    (orgId: string, uid: string) => ['tenant', 'dashboard', orgId, uid] as const,
  tenantLease:        (orgId: string, uid: string) => ['tenant', 'lease', orgId, uid] as const,
  tenantLeaseHistory: (orgId: string, uid: string) => ['tenant', 'lease', orgId, uid, 'history'] as const,
  tenantInvoices:     (orgId: string, uid: string, p?: object) =>
    ['tenant', 'invoices', orgId, uid, p] as const,
  tenantInvoice:      (orgId: string, uid: string, id: number) =>
    ['tenant', 'invoices', orgId, uid, id] as const,
  tenantPayments:     (orgId: string, uid: string, p?: object) =>
    ['tenant', 'payments', orgId, uid, p] as const,
  tenantMaintenance:  (orgId: string, uid: string, p?: object) =>
    ['tenant', 'maintenance', orgId, uid, p] as const,
  tenantMaintenanceItem:(orgId: string, uid: string, id: number) =>
    ['tenant', 'maintenance', orgId, uid, id] as const,
  tenantMessages:     (orgId: string, uid: string, p?: object) =>
    ['tenant', 'messages', orgId, uid, p] as const,
  tenantMessage:      (orgId: string, uid: string, id: number) =>
    ['tenant', 'messages', orgId, uid, id] as const,
  tenantUnreadCount:  (orgId: string, uid: string) =>
    ['tenant', 'messages', orgId, uid, 'unread'] as const,
  tenantAnnouncements:(orgId: string, uid: string, p?: object) =>
    ['tenant', 'announcements', orgId, uid, p] as const,
  tenantDocuments:    (orgId: string, uid: string) =>
    ['tenant', 'documents', orgId, uid] as const,
  tenantRoom:         (orgId: string, uid: string) =>
    ['tenant', 'room', orgId, uid] as const,

  // ── SuperAdmin ───────────────────────────────────────────────────
  saDashboard:      ()              => ['superadmin', 'dashboard'] as const,
  saOrganizations:  (p?: object)    => ['superadmin', 'organizations', p] as const,
  saOrganization:   (id: number)    => ['superadmin', 'organizations', id] as const,
  saOrgStats:       (id: number)    => ['superadmin', 'organizations', id, 'stats'] as const,
  saPlans:          ()              => ['superadmin', 'plans'] as const,
  saPlanUsage:      ()              => ['superadmin', 'plans', 'usage'] as const,
  saBilling:        (p?: object)    => ['superadmin', 'billing', p] as const,
  saBillingOverview:()              => ['superadmin', 'billing', 'overview'] as const,
  saUsers:          (p?: object)    => ['superadmin', 'users', p] as const,
  saUserStats:      ()              => ['superadmin', 'users', 'stats'] as const,
  saAuditLogs:      (p?: object)    => ['superadmin', 'audit-logs', p] as const,
  saAuditSummary:   ()              => ['superadmin', 'audit-logs', 'summary'] as const,
  saSystem:         ()              => ['superadmin', 'system'] as const,
  saSystemUsage:    ()              => ['superadmin', 'system', 'usage'] as const,
  saSystemPerf:     ()              => ['superadmin', 'system', 'performance'] as const,
  saReport:         (period: string)=> ['superadmin', 'reports', period] as const,
  saRevenueSharing: (month?: string)=> ['superadmin', 'revenue-sharing', month] as const,
}
