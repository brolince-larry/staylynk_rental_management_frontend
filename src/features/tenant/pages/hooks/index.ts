// src/features/tenant/hooks/index.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { QK } from '@/constants/queryKeys'
import { leasesApi } from '@/api/leases'
import { invoicesApi } from '@/api/invoices'
import { paymentsApi } from '@/api/payments'
import { maintenanceApi } from '@/api/maintenance'
import { roomsApi } from '@/api/rooms'

interface TenantDashboardData {
  has_active_lease?: boolean
  message?: string
  lease?: {
    lease_number: string
    start_date: string
    end_date: string
    term_months: number
    monthly_rent: number
    security_deposit: number
    payment_due_day: number
    payment_method?: string
    status: string
    days_remaining?: number
  } | null
  room?: {
    room_number: string
    type?: string
    room_type?: string
    block?: string
    floor?: string
    monthly_rent?: number
    current_occupants?: number
    capacity?: number
    cover_image?: unknown
  } | null
  next_payment?: {
    due_date: string
    amount?: number
    days_until_due: number
  } | null
  payment_overview?: {
    total_paid: number
    total_pending: number
    total_overdue: number
  } | null
  account_balance?: {
    total_outstanding: number
    is_up_to_date: boolean
  } | null
  recent_invoices?: Array<{
    id: number | string
    invoice_number?: string
    due_date?: string
    amount?: number
    total?: number
    status: string
  }>
  payment_history?: Array<{
    id: number | string
    payment_uuid?: string | null
    invoice_number: string
    invoice_month: string
    due_date: string
    total_amount: number
    status: string
    paid_at?: string | null
  }>
  announcements?: Array<{
    id: number | string
    title: string
    body?: string
    content?: string
    category?: string
    created_at?: string
    published_at: string
  }>
  open_maintenance?: number | null
  open_maintenance_count?: number | null
  currency?: string
  manager_contact?: {
    phone?: string
    email?: string
  } | null
  property?: {
    phone?: string
    email?: string
  } | null
}

function useOrgId()  { return useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown') }
function useUserId() { return useAuthStore((s) => s.user?.id?.toString() ?? 'unknown') }

// ── Dashboard ─────────────────────────────────────────────────────────────
export function useTenantDashboard() {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantDashboard(orgId, userId),
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<TenantDashboardData>('/tenant/dashboard').then((r) => r.data)
      ),
    enabled: !!useAuthStore.getState().user,
  })
}

// ── Lease ─────────────────────────────────────────────────────────────────
export function useTenantLease() {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantLease(orgId, userId),
    queryFn: () => leasesApi.tenantLease().then((r) => r.data),
  })
}

export function useTenantLeaseHistory() {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantLeaseHistory(orgId, userId),
    queryFn: () => leasesApi.tenantHistory().then((r) => r.data),
  })
}

// ── Invoices ──────────────────────────────────────────────────────────────
export function useTenantInvoices(params?: { status?: string; page?: number; per_page?: number }) {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantInvoices(orgId, userId, params),
    queryFn: () => invoicesApi.tenantList(params).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

export function useTenantInvoice(uuid: string) {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantInvoice(orgId, userId, uuid),
    queryFn: () => invoicesApi.tenantGet(uuid).then((r) => r.data),
    enabled: !!uuid,
  })
}

// ── Payments ──────────────────────────────────────────────────────────────
export function useTenantPayments(params?: { page?: number; per_page?: number }) {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantPayments(orgId, userId, params),
    queryFn: () => paymentsApi.tenantList(params).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

export function useInitiateMpesa() {
  const qc = useQueryClient(); const orgId = useOrgId(); const userId = useUserId()
  return useMutation({
    mutationFn: ({ invoiceId, phone_number, amount }: { invoiceId: number; phone_number: string; amount?: number }) =>
      paymentsApi.initiateMpesa(invoiceId, phone_number, amount),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.tenantInvoices(orgId, userId) })
      void qc.invalidateQueries({ queryKey: QK.tenantPayments(orgId, userId) })
      void qc.invalidateQueries({ queryKey: QK.tenantDashboard(orgId, userId) })
    },
  })
}

// Polling fallback alongside the realtime broadcast — covers a missed
// websocket event (dropped connection, backgrounded tab). Stops the moment
// the payment resolves either way.
export function useTenantPaymentStatus(paymentId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: QK.tenantPaymentStatus(paymentId ?? 'none'),
    queryFn: () => paymentsApi.tenantPaymentStatus(paymentId as string).then((r) => r.data),
    enabled: enabled && !!paymentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && status !== 'pending' ? false : 4_000
    },
    refetchIntervalInBackground: true,
  })
}

export function useTenantBankInfo() {
  return useQuery({
    queryKey: ['tenant', 'bank-info'],
    queryFn: () => paymentsApi.tenantBankInfo().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })
}

export function useSubmitBankTransfer() {
  const qc = useQueryClient(); const orgId = useOrgId(); const userId = useUserId()
  return useMutation({
    mutationFn: ({ data, onProgress }: { data: FormData; onProgress?: (percent: number) => void }) =>
      paymentsApi.tenantBankTransfer(data, onProgress),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.tenantInvoices(orgId, userId) })
      void qc.invalidateQueries({ queryKey: QK.tenantPayments(orgId, userId) })
      void qc.invalidateQueries({ queryKey: QK.tenantDashboard(orgId, userId) })
    },
  })
}

export function useTenantReceiptUrl(paymentId: number) {
  return useQuery({
    queryKey: ['tenant', 'receipt', paymentId],
    queryFn: () => paymentsApi.tenantReceipt(paymentId).then((r) => r.data),
    enabled: paymentId > 0,
  })
}

// ── Maintenance ───────────────────────────────────────────────────────────
export function useTenantMaintenanceList(params?: { status?: string; page?: number }) {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantMaintenance(orgId, userId, params),
    queryFn: () => maintenanceApi.tenantList(params).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

export function useTenantMaintenanceItem(id: number) {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantMaintenanceItem(orgId, userId, id),
    queryFn: () => maintenanceApi.tenantGet(id).then((r) => r.data),
    enabled: id > 0,
  })
}

export function useSubmitMaintenance() {
  const qc = useQueryClient(); const orgId = useOrgId(); const userId = useUserId()
  return useMutation({
    mutationFn: maintenanceApi.tenantCreate,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: QK.tenantMaintenance(orgId, userId) }),
  })
}

// ── Messages ──────────────────────────────────────────────────────────────
export function useTenantMessages(params?: { unread?: boolean; per_page?: number }) {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantMessages(orgId, userId, params),
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<Record<string, unknown>>('/tenant/messages', params as Record<string, unknown>).then((r) => r.data)
      ),
  })
}

export interface TenantMessageThread {
  id: string
  subject: string | null
  body: string
  is_read: boolean
  sender: { id: string; name: string } | null
  receiver: { id: string; name: string } | null
  replies: Array<{ id: string; body: string; sender: { id: string; name: string } | null; created_at: string }>
  created_at: string
}

export function useTenantMessageThread(uuid: string | null) {
  const orgId = useOrgId(); const userId = useUserId()
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['tenant', 'messages', 'thread', uuid],
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<TenantMessageThread>(`/tenant/messages/${uuid}`).then((r) => {
          void qc.invalidateQueries({ queryKey: QK.tenantMessages(orgId, userId) })
          void qc.invalidateQueries({ queryKey: QK.tenantUnreadCount(orgId, userId) })
          return r.data
        })
      ),
    enabled: !!uuid,
  })
}

export function useTenantUnreadCount() {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantUnreadCount(orgId, userId),
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<{ unread: number }>('/tenant/messages/unread-count').then((r) => r.data)
      ),
  })
}

export function useSendMessage() {
  const qc = useQueryClient(); const orgId = useOrgId(); const userId = useUserId()
  return useMutation({
    mutationFn: (data: { subject?: string; body: string; parent_id?: string }) =>
      import('@/api/client').then(({ apiPost }) =>
        apiPost<Record<string, unknown>>('/tenant/messages', data)
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.tenantMessages(orgId, userId) })
      void qc.invalidateQueries({ queryKey: QK.tenantUnreadCount(orgId, userId) })
    },
  })
}

// ── Room ──────────────────────────────────────────────────────────────────
export function useTenantRoom() {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantRoom(orgId, userId),
    queryFn: () => roomsApi.tenantRoom().then((r) => r.data),
  })
}

// ── Documents ─────────────────────────────────────────────────────────────
export function useTenantDocuments() {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantDocuments(orgId, userId),
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<Array<{
          id: number
          title?: string | null
          file_name?: string | null
          document_type?: string | null
          size?: number | null
          created_at?: string | null
        }>>('/tenant/documents').then((r) => r.data)
      ),
  })
}

// ── Announcements ─────────────────────────────────────────────────────────
export function useTenantAnnouncements(params?: { per_page?: number; page?: number }) {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: QK.tenantAnnouncements(orgId, userId, params),
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<Record<string, unknown>>('/tenant/announcements', params as Record<string, unknown>).then((r) => r.data)
      ),
  })
}

// ── Settings ──────────────────────────────────────────────────────────────
export function useTenantSettings() {
  const orgId = useOrgId(); const userId = useUserId()
  return useQuery({
    queryKey: ['tenant', 'settings', orgId, userId],
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<Record<string, unknown>>('/tenant/settings').then((r) => r.data)
      ),
  })
}

export function useUpdateTenantSettings() {
  const qc = useQueryClient(); const orgId = useOrgId(); const userId = useUserId()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      import('@/api/client').then(({ apiPatch }) =>
        apiPatch<Record<string, unknown>>('/tenant/settings', data)
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['tenant', 'settings', orgId, userId] }),
  })
}
