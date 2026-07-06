// src/features/admin/hooks/index.ts
// All TanStack Query hooks for the admin role.
// Each hook is org-scoped via queryKey to prevent cross-tenant cache leakage.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { QK } from '@/constants/queryKeys'
import { bookingsApi, type BookingFilters } from '@/api/bookings'
import { propertiesApi, type PropertyFilters } from '@/api/properties'
import { roomsApi, type RoomFilters } from '@/api/rooms'
import { tenantsApi, type TenantFilters } from '@/api/tenants'
import { invoicesApi, type InvoiceFilters } from '@/api/invoices'
import { paymentsApi, type PaymentFilters, type RentFilters } from '@/api/payments'
import { leasesApi, type LeaseFilters } from '@/api/leases'

function useOrgId() { return useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown') }

// ══════════════════════════════════════════════════════════════════════════
// PROPERTIES
// ══════════════════════════════════════════════════════════════════════════
export function useProperties(filters: PropertyFilters = {}) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.properties(orgId, filters),
    queryFn: () => propertiesApi.list(filters).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useProperty(id: string) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.property(orgId, id),
    queryFn: () => propertiesApi.get(id).then((r) => r.data),
    enabled: !!id,
  })
}

export function usePropertyStats(id: string) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.propertyStats(orgId, id),
    queryFn: () => propertiesApi.stats(id).then((r) => r.data),
    staleTime: Infinity,
    enabled: !!id,
  })
}

export function useCreateProperty() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: propertiesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'properties', orgId] }),
  })
}

export function useUpdateProperty(id: string) {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (data: Parameters<typeof propertiesApi.update>[1]) => propertiesApi.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.property(orgId, id) })
      void qc.invalidateQueries({ queryKey: ['admin', 'properties', orgId] })
    },
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: propertiesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'properties', orgId] }),
  })
}

export function useUpdatePropertyStatus(id: string) {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (status: Parameters<typeof propertiesApi.updateStatus>[1]) =>
      propertiesApi.updateStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.property(orgId, id) })
      void qc.invalidateQueries({ queryKey: ['admin', 'properties', orgId] })
    },
  })
}

// ══════════════════════════════════════════════════════════════════════════
// ROOMS
// ══════════════════════════════════════════════════════════════════════════
export function useRooms(filters: RoomFilters = {}) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.rooms(orgId, filters),
    queryFn: () => roomsApi.list(filters).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useRoom(id: string) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.room(orgId, id),
    queryFn: () => roomsApi.get(id).then((r) => r.data),
    enabled: !!id,
  })
}

export function useRoomAvailability(id: string, from: string, to: string) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.roomAvailability(orgId, id, from, to),
    queryFn: () => roomsApi.availability(id, from, to).then((r) => r.data),
    enabled: !!id && !!from && !!to,
    staleTime: Infinity,
  })
}

export function useRoomTypes(params: { active_only?: 0 | 1 | boolean; search?: string } = { active_only: 1 }, enabled = true) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: [...QK.roomTypes(orgId), params],
    queryFn: () => roomsApi.roomTypes(params).then((r) => r.data),
    enabled,
    staleTime: Infinity,
  })
}

export function useCreateRoom() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: roomsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'rooms', orgId] }),
  })
}

export function useUpdateRoom(id: string) {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (data: Parameters<typeof roomsApi.update>[1]) => roomsApi.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.room(orgId, id) })
      void qc.invalidateQueries({ queryKey: ['admin', 'rooms', orgId] })
    },
  })
}

export function useUpdateRoomStatus(id: string) {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (status: Parameters<typeof roomsApi.updateStatus>[1]) =>
      roomsApi.updateStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.room(orgId, id) })
      void qc.invalidateQueries({ queryKey: ['admin', 'rooms', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard', orgId] })
    },
  })
}

export function useDeleteRoom() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: roomsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'rooms', orgId] }),
  })
}

// ══════════════════════════════════════════════════════════════════════════
// BOOKINGS
// ══════════════════════════════════════════════════════════════════════════
export function useBookings(filters: BookingFilters = {}) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.bookings(orgId, filters),
    queryFn: () => bookingsApi.list(filters).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useBooking(id: string) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.booking(orgId, id),
    queryFn: () => bookingsApi.get(id).then((r) => r.data),
    enabled: !!id,
  })
}

export function useBookingSummary(params?: { property_id?: string | 'all' }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.bookingSummary(orgId, params),
    queryFn: () => bookingsApi.summary(params).then((r) => r.data),
    staleTime: Infinity,
  })
}

export function useCreateBooking() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: bookingsApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'bookings', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard', orgId] })
    },
  })
}

export function useConfirmBooking() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: bookingsApi.confirm,
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: QK.booking(orgId, id) })
      void qc.invalidateQueries({ queryKey: ['admin', 'bookings', orgId] })
    },
  })
}

export function useCheckIn() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: bookingsApi.checkIn,
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: QK.booking(orgId, id) })
      void qc.invalidateQueries({ queryKey: ['admin', 'bookings', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'rooms', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard', orgId] })
    },
  })
}

export function useCheckOut() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: bookingsApi.checkOut,
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: QK.booking(orgId, id) })
      void qc.invalidateQueries({ queryKey: ['admin', 'bookings', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'rooms', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard', orgId] })
    },
  })
}

export function useCancelBooking() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      bookingsApi.cancel(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'bookings', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard', orgId] })
    },
  })
}

export function useRejectBooking() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      bookingsApi.reject(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'bookings', orgId] })
    },
  })
}

export function useNoShowBooking() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (id: string) => bookingsApi.noShow(id),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: QK.booking(orgId, id) })
      void qc.invalidateQueries({ queryKey: ['admin', 'bookings', orgId] })
    },
  })
}

export function useClearRejectedBookings() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: () => bookingsApi.clearRejected(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'bookings', orgId] })
    },
  })
}

// ══════════════════════════════════════════════════════════════════════════
// TENANTS
// ══════════════════════════════════════════════════════════════════════════
export function useTenants(filters: TenantFilters = {}) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.tenants(orgId, filters),
    queryFn: () => tenantsApi.list(filters).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useTenant(id: string) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.tenant(orgId, id),
    queryFn: () => tenantsApi.get(id).then((r) => r.data),
    enabled: !!id,
  })
}

export function useTenantHistory(id: string) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.tenantHistory(orgId, id),
    queryFn: () => tenantsApi.history(id).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreateTenant() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: tenantsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants', orgId] }),
  })
}

export function useUpdateTenant(id: string) {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (data: Parameters<typeof tenantsApi.update>[1]) =>
      tenantsApi.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.tenant(orgId, id) })
      void qc.invalidateQueries({ queryKey: ['admin', 'tenants', orgId] })
    },
  })
}

export function useVerifyTenant() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: tenantsApi.verify,
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: QK.tenant(orgId, id) })
      void qc.invalidateQueries({ queryKey: ['admin', 'tenants', orgId] })
    },
  })
}

export function useUpdateTenantStatus() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      tenantsApi.updateStatus(id, status, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants', orgId] }),
  })
}

// ══════════════════════════════════════════════════════════════════════════
// INVOICES
// ══════════════════════════════════════════════════════════════════════════
export function useInvoices(filters: InvoiceFilters = {}) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.invoices(orgId, filters),
    queryFn: () => invoicesApi.list(filters).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useInvoice(id: string) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.invoice(orgId, id),
    queryFn: () => invoicesApi.get(id).then((r) => r.data),
    enabled: !!id,
  })
}

export function useInvoiceSummary(params?: { property_id?: string | 'all'; month?: string }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.invoiceSummary(orgId, params),
    queryFn: () => invoicesApi.summary(params).then((r) => r.data),
    staleTime: Infinity,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'invoices', orgId] }),
  })
}

export function useGenerateMonthlyInvoices() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ invoice_month }: { invoice_month: string }) =>
      invoicesApi.generateMonthly(invoice_month),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'invoices', orgId] }),
  })
}

export function useVoidInvoice() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      invoicesApi.void(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'invoices', orgId] }),
  })
}

export function useSendInvoice() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: invoicesApi.send,
    onSuccess: (_, id) =>
      qc.invalidateQueries({ queryKey: QK.invoice(orgId, id) }),
  })
}

// ══════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ══════════════════════════════════════════════════════════════════════════
export function usePayments(filters: PaymentFilters = {}) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.payments(orgId, filters),
    queryFn: () => paymentsApi.list(filters).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function usePaymentSummary(params?: { property_id?: string | 'all'; month?: string }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.paymentSummary(orgId, params),
    queryFn: () => paymentsApi.summary(params).then((r) => r.data),
    staleTime: Infinity,
  })
}

export function useCreatePayment() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'payments', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'invoices', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard', orgId] })
    },
  })
}

// Rent collection
export function useRentCollection(filters: RentFilters = {}) {
  const orgId      = useOrgId()
  const propertyId = useAuthStore((s) => s.user?.current_property?.uuid ?? undefined)
  const merged     = { ...filters, ...(propertyId ? { property_id: propertyId } : {}) }
  return useQuery({
    queryKey: QK.rent(orgId, merged),
    queryFn: () => paymentsApi.rentList(merged).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useRentSummary(month?: string) {
  const orgId      = useOrgId()
  const propertyId = useAuthStore((s) => s.user?.current_property?.uuid ?? undefined)
  const params     = { ...(month ? { month } : {}), ...(propertyId ? { property_id: propertyId } : {}) }
  return useQuery({
    queryKey: QK.rentSummary(orgId, month, propertyId),
    queryFn: () => paymentsApi.rentSummary(params).then((r) => r.data),
    staleTime: Infinity,
  })
}

export function useRecordRentPayment() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({
      invoiceId, ...data
    }: { invoiceId: string } & Parameters<typeof paymentsApi.recordRent>[1]) =>
      paymentsApi.recordRent(invoiceId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'rent', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'invoices', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard', orgId] })
    },
  })
}

// ══════════════════════════════════════════════════════════════════════════
// LEASES
// ══════════════════════════════════════════════════════════════════════════
export function useAdminLeases(filters: LeaseFilters = {}) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.leases(orgId, filters),
    queryFn: () => leasesApi.adminList(filters).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useAdminLease(id: string) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.lease(orgId, id),
    queryFn: () => leasesApi.adminGet(id).then((r) => r.data),
    enabled: !!id,
  })
}

export function useAdminTerminateLease() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Parameters<typeof leasesApi.adminTerminate>[1]) =>
      leasesApi.adminTerminate(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'leases', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'rooms', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard', orgId] })
    },
  })
}

// ══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════
export function useOrgSettings() {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.settings(orgId),
    queryFn: () =>
      import('@/api/client').then(({ apiGet }) =>
        apiGet<Record<string, unknown>>('/admin/settings').then((r) => r.data)
      ),
    staleTime: Infinity,
  })
}

export function useUpdateOrgSettings() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      const { late_fee_pct, payment_due_day, invoice_prefix, reminder_days, bank_account, ...orgFields } = data
      const payload: Record<string, unknown> = { ...orgFields }
      const settingsNested: Record<string, unknown> = {}
      if (late_fee_pct    !== undefined) settingsNested.late_fee_pct    = late_fee_pct
      if (payment_due_day !== undefined) settingsNested.payment_due_day = payment_due_day
      if (invoice_prefix  !== undefined) settingsNested.invoice_prefix  = invoice_prefix
      if (reminder_days   !== undefined) settingsNested.reminder_days   = reminder_days
      if (bank_account    !== undefined) settingsNested.bank_account    = bank_account
      if (Object.keys(settingsNested).length > 0) payload.settings = settingsNested
      return import('@/api/client').then(({ apiPut }) =>
        apiPut<Record<string, unknown>>('/admin/settings', payload)
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.settings(orgId) }),
  })
}

export function useApproveBankTransfer() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: (id: string) => paymentsApi.adminApproveBankTransfer(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'payments', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'invoices', orgId] })
    },
  })
}

export function useRejectBankTransfer() {
  const qc = useQueryClient(); const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      paymentsApi.adminRejectBankTransfer(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'payments', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'invoices', orgId] })
    },
  })
}
