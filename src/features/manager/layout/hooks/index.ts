// src/features/manager/hooks/index.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { QK } from '@/constants/queryKeys'
import { leasesApi, type LeaseFilters } from '@/api/leases'
import { maintenanceApi, type MaintenanceFilters } from '@/api/maintenance'
import { paymentsApi, type PaymentFilters } from '@/api/payments'
import { listingsApi, type ListingFilters } from '@/api/listings'
import { inviteManagerApi, type InviteExport } from '@/api/invites'

function useOrgId() { return useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown') }

// ── Public Listings ──────────────────────────────────────────────────────
export function useManagerListings(params?: ListingFilters) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['manager', 'listings', orgId, params],
    queryFn: () => listingsApi.managerList(params).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

export function useManagerPublishListing() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ propertyId, data }: { propertyId: number | string; data: { title?: string; description?: string; address_display?: string } }) =>
      listingsApi.managerPublish(propertyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'listings', orgId] }),
  })
}

export function useManagerUnpublishListing() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: listingsApi.managerUnpublish,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'listings', orgId] }),
  })
}

export function useManagerSyncListing() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: listingsApi.managerSync,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'listings', orgId] }),
  })
}

export function useManagerFeatureListing() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ uuid, featured, featured_until, boost_score }: { uuid: string; featured: boolean; featured_until?: string; boost_score?: number }) =>
      listingsApi.managerFeature(uuid, { featured, featured_until, boost_score }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'listings', orgId] }),
  })
}

// ── Leases ────────────────────────────────────────────────────────────────
export function useManagerLeases(filters: LeaseFilters = {}) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.managerLeases(orgId, filters),
    queryFn: () => leasesApi.list(filters).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useManagerLease(id: number) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.managerLease(orgId, id),
    queryFn: () => leasesApi.get(id).then((r) => r.data),
    enabled: id > 0,
  })
}

export function useLeaseSummary() {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.leaseSummary(orgId),
    queryFn: () => leasesApi.summary().then((r) => r.data),
    staleTime: Infinity,
  })
}

export function useLeasesExpiring(days?: number) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.leasesExpiring(orgId, days),
    queryFn: () => leasesApi.expiring(days).then((r) => r.data),
    staleTime: Infinity,
  })
}

export function useCreateLease() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: leasesApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['manager', 'leases', orgId] })
      void qc.invalidateQueries({ queryKey: ['manager', 'dashboard', orgId] })
    },
  })
}

export function useTerminateLease() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Parameters<typeof leasesApi.terminate>[1]) =>
      leasesApi.terminate(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['manager', 'leases', orgId] })
      void qc.invalidateQueries({ queryKey: ['manager', 'dashboard', orgId] })
    },
  })
}

export function useRenewLease() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Parameters<typeof leasesApi.renew>[1]) =>
      leasesApi.renew(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'leases', orgId] }),
  })
}

export function useRecordLastPayment() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Parameters<typeof leasesApi.recordLastPayment>[1]) =>
      leasesApi.recordLastPayment(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['manager', 'leases', orgId] })
      void qc.invalidateQueries({ queryKey: ['manager', 'dashboard', orgId] })
    },
  })
}

// ── Maintenance ───────────────────────────────────────────────────────────
export function useManagerMaintenance(filters: MaintenanceFilters = {}) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.managerMaintenance(orgId, filters),
    queryFn: () => maintenanceApi.list(filters).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useMaintenanceSummary(params?: { property_id?: string | 'all' }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.maintenanceSummary(orgId, params),
    queryFn: () => maintenanceApi.summary(params).then((r) => r.data),
    staleTime: Infinity,
  })
}

export function useCreateMaintenance() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: maintenanceApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'maintenance', orgId] }),
  })
}

export function useAssignMaintenance() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, assigned_to }: { id: number; assigned_to: number }) =>
      maintenanceApi.assign(id, assigned_to),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'maintenance', orgId] }),
  })
}

export function useResolveMaintenance() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Parameters<typeof maintenanceApi.resolve>[1]) =>
      maintenanceApi.resolve(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'maintenance', orgId] }),
  })
}

export function useRejectMaintenance() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      maintenanceApi.reject(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'maintenance', orgId] }),
  })
}

// ── Messages ──────────────────────────────────────────────────────────────
export function useManagerMessages(params?: { unread?: boolean; per_page?: number; page?: number }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.managerMessages(orgId, params),
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<Record<string, unknown>>('/manager/messages', params as Record<string, unknown>).then((r) => r.data)
      ),
    staleTime: Infinity,
  })
}

export function useSendManagerMessage() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (data: { receiver_id: string; subject?: string; body: string; parent_id?: string }) =>
      import('@/api/client').then(({ apiPost }) =>
        apiPost<Record<string, unknown>>('/manager/messages', data)
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'messages', orgId] }),
  })
}

// Sidebar badge count. Nested under the same ['manager','messages',orgId]
// prefix as the inbox list and thread queries, so it's automatically
// refreshed by their existing invalidations (sending, opening a thread) —
// no separate wiring needed for those paths. A per_page=1 request is enough
// since only `meta.unread_count` is read.
export function useManagerUnreadMessagesCount() {
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['manager', 'messages', orgId, 'unread-badge'],
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<{ meta?: { unread_count?: number } }>('/manager/messages', { per_page: 1 })
          .then((r) => r.data?.meta?.unread_count ?? 0)
      ),
    staleTime: Infinity,
  })
}

// Sidebar badge for Bookings — count of pending hunter booking requests.
export function useManagerPendingBookingsCount() {
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['manager', 'bookings', orgId, 'pending-badge'],
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<{ meta?: { pending_hunter_requests?: number } }>('/manager/bookings', { per_page: 1, source: 'public', status: 'pending', property_id: 'all' })
          .then((r) => r.data?.meta?.pending_hunter_requests ?? 0)
      ),
    staleTime: Infinity,
  })
}

export interface MessageThread {
  id: string
  subject: string | null
  body: string
  is_read: boolean
  sender: { id: string; name: string } | null
  receiver: { id: string; name: string } | null
  replies: Array<{ id: string; body: string; sender: { id: string; name: string } | null; created_at: string }>
  created_at: string
}

export function useManagerMessageThread(uuid: string | null) {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useQuery({
    queryKey: ['manager', 'messages', 'thread', uuid],
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<MessageThread>(`/manager/messages/${uuid}`).then((r) => {
          void qc.invalidateQueries({ queryKey: ['manager', 'messages', orgId] })
          return r.data
        })
      ),
    enabled: !!uuid,
  })
}

export interface MessageRecipient {
  id: string
  name: string
  role: string
}

export function useMessageRecipients(search = '') {
  return useQuery({
    queryKey: ['manager', 'messages', 'recipients', search],
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<{ data: MessageRecipient[] }>('/manager/messages/recipients', { search: search || undefined })
          .then((r) => r.data?.data ?? [])
      ),
    staleTime: 60_000,
  })
}

// ── Expenses ──────────────────────────────────────────────────────────────
type ExpensePayload = {
  title: string
  description?: string
  category: string
  amount: number
  expense_date: string
  payment_method?: string
  vendor?: string
  receipt_path?: string
  is_recurring?: boolean
}

function withoutPropertyId(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) return undefined
  const {
    property_id: _propertyId,
    property_uuid: _propertyUuid,
    property_name: _propertyName,
    property: _property,
    ...rest
  } = params
  return rest
}

export function useManagerExpenses(params?: Record<string, unknown>) {
  const orgId = useOrgId()
  const cleanParams = withoutPropertyId(params)
  return useQuery({
    queryKey: QK.managerExpenses(orgId, cleanParams),
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<Record<string, unknown>>('/manager/expenses', cleanParams).then((r) => r.data)
      ),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useCreateExpense() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (data: ExpensePayload) =>
      import('@/api/client').then(({ apiPost }) =>
        apiPost<Record<string, unknown>>('/manager/expenses', data)
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'expenses', orgId] }),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (id: number) =>
      import('@/api/client').then(({ apiDelete }) =>
        apiDelete(`/manager/expenses/${id}`)
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'expenses', orgId] }),
  })
}

// ── Manager Payments ──────────────────────────────────────────────────────
export function useManagerPayments(filters: PaymentFilters = {}) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.payments(orgId, { source: 'manager', ...filters }),
    queryFn: () => paymentsApi.managerList(filters).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useManagerCreatePayment() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: paymentsApi.managerCreate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['manager', 'dashboard', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'invoices', orgId] })
    },
  })
}

export function useManagerApproveBankTransfer() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (id: number) => paymentsApi.managerApproveBankTransfer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.payments(orgId, { source: 'manager' }) }),
  })
}

export function useManagerRejectBankTransfer() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      paymentsApi.managerRejectBankTransfer(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.payments(orgId, { source: 'manager' }) }),
  })
}

// ── Check-in / Check-out ──────────────────────────────────────────────────
export function useCheckInOutList(params?: { type?: string; property_id?: string | 'all' }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.checkInOut(orgId, params),
    queryFn: () =>
      import('@/api/bookings').then(({ bookingsApi: b }) =>
        b.checkInOutList(params).then((r) => r.data)
      ),
    staleTime: Infinity,
  })
}

export function useManagerCheckIn() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (id: number) =>
      import('@/api/bookings').then(({ bookingsApi: b }) => b.managerCheckIn(id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['manager', 'check-in-out', orgId] })
      void qc.invalidateQueries({ queryKey: ['manager', 'dashboard', orgId] })
    },
  })
}

export function useManagerCheckOut() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (id: number) =>
      import('@/api/bookings').then(({ bookingsApi: b }) => b.managerCheckOut(id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['manager', 'check-in-out', orgId] })
      void qc.invalidateQueries({ queryKey: ['manager', 'dashboard', orgId] })
    },
  })
}

// ── Room Invites ──────────────────────────────────────────────────────────
export function useManagerInvites(params?: { property_id?: string | number; status?: string; page?: number; per_page?: number }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['manager', 'invites', orgId, params],
    queryFn: () => inviteManagerApi.list(params).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

export function useManagerInviteAnalytics(params?: { property_id?: string | number }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['manager', 'invites', 'analytics', orgId, params],
    queryFn: () => inviteManagerApi.analytics(params).then((r) => r.data),
    staleTime: 30_000,
  })
}

// The exports endpoint sometimes comes back paginated (`{ data: [...] }`)
// instead of a bare array — normalise either shape defensively.
function exportRows(value: unknown): InviteExport[] {
  if (Array.isArray(value)) return value
  const data = (value as { data?: unknown } | undefined)?.data
  return Array.isArray(data) ? (data as InviteExport[]) : []
}

export function useManagerInviteExports() {
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['manager', 'invites', 'exports', orgId],
    queryFn: () => inviteManagerApi.listExports().then((r) => exportRows(r.data)),
  })
}

export function useManagerBulkGenerateInvites() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: inviteManagerApi.bulkGenerate,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['manager', 'invites', orgId] }),
  })
}

export function useManagerRevokeInvite() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (uuid: string) => inviteManagerApi.revoke(uuid),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['manager', 'invites', orgId] }),
  })
}

export function useManagerRevokeAllInvites() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (property_id: string | number) => inviteManagerApi.revokeAll(property_id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['manager', 'invites', orgId] }),
  })
}
