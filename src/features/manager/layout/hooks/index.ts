// src/features/manager/hooks/index.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { QK } from '@/constants/queryKeys'
import { leasesApi, type LeaseFilters } from '@/api/leases'
import { maintenanceApi, type MaintenanceFilters } from '@/api/maintenance'
import { paymentsApi, type PaymentFilters } from '@/api/payments'

function useOrgId() { return useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown') }

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
    mutationFn: (data: { receiver_id: number; subject?: string; body: string }) =>
      import('@/api/client').then(({ apiPost }) =>
        apiPost<Record<string, unknown>>('/manager/messages', data)
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager', 'messages', orgId] }),
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
