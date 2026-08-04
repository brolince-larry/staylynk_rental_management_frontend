// src/schemas/index.ts
// Zod validation schemas for every form in the app.
// Types inferred — no duplication between schema and TypeScript types.

import { z } from 'zod'

const moneyValue = (schema: z.ZodNumber) => z.preprocess((value) => {
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '')
    return cleaned ? Number(cleaned) : value
  }
  return value
}, schema)

// ─── Auth ─────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email:    z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
export type LoginSchema = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  org_name:              z.string().min(2, 'Organisation name is required').max(150),
  org_email:             z.string().email('Invalid organisation email'),
  name:                  z.string().min(2, 'Your name is required').max(150),
  email:                 z.string().email('Invalid email'),
  password:              z.string().min(8, 'At least 8 characters'),
  password_confirmation: z.string(),
  country:               z.string().length(2).optional(),
}).refine(d => d.password === d.password_confirmation, {
  message: 'Passwords do not match',
  path:    ['password_confirmation'],
})
export type RegisterSchema = z.infer<typeof registerSchema>

// ─── Property ────────────────────────────────────────────────────────────
export const propertySchema = z.object({
  name:          z.string().min(2, 'Name is required').max(150),
  address:       z.string().min(5, 'Address is required').max(300),
  city:          z.string().min(2, 'City is required').max(100),
  state:         z.string().max(100).optional(),
  country:       z.string().length(2).optional(),
  phone:         z.string().max(20).optional(),
  email:         z.string().email('Invalid email').optional().or(z.literal('')),
  description:   z.string().max(2000).optional(),
  total_floors:  z.coerce.number().int().min(1).max(200).optional(),
  status:        z.enum(['active', 'inactive', 'maintenance']).default('active'),
})
export type PropertySchema = z.infer<typeof propertySchema>

// ─── Room ─────────────────────────────────────────────────────────────────
export const roomSchema = z.object({
  room_type_id:     z.coerce.number().int().positive('Room type is required'),
  room_number:      z.string().min(1, 'Room number is required').max(20),
  floor:            z.string().max(20).optional(),
  block:            z.string().max(50).optional(),
  monthly_rent:     moneyValue(z.coerce.number().positive('Rent must be greater than 0')),
  security_deposit: moneyValue(z.coerce.number().min(0)).optional(),
  capacity:         z.coerce.number().int().min(1).max(20).default(1),
  status:           z.preprocess(
    (value) => typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '_') : value,
    z.enum(['available', 'occupied', 'maintenance', 'reserved']).default('available')
  ),
  notes:            z.string().max(1000).optional(),
})
export type RoomSchema = z.infer<typeof roomSchema>

// ─── Booking ──────────────────────────────────────────────────────────────
export const bookingSchema = z.object({
  room_id:        z.string().min(1, 'Room is required'),
  bed_id:         z.string().optional(),
  tenant_id:      z.string().min(1, 'Tenant is required'),
  check_in_date:  z.string().min(1, 'Check-in date is required'),
  check_out_date: z.string().optional(),
  amount:         z.coerce.number().positive('Amount must be greater than 0'),
  deposit_paid:   z.coerce.number().min(0).optional(),
  notes:          z.string().max(1000).optional(),
})
export type BookingSchema = z.infer<typeof bookingSchema>

export const cancelBookingSchema = z.object({
  reason: z.string().min(5, 'Please provide a reason').max(500),
})
export type CancelBookingSchema = z.infer<typeof cancelBookingSchema>

// ─── Tenant ───────────────────────────────────────────────────────────────
export const tenantSchema = z.object({
  name:                    z.string().min(2, 'Name is required').max(150),
  email:                   z.string().email('Invalid email'),
  phone_number:            z.string().min(7, 'Phone number is required').max(20),
  alternative_phone:       z.string().max(20).optional(),
  password:                z.string().min(8).optional().or(z.literal('')),
  property_id:             z.string().optional(),
  room_id:                 z.string().optional(),
  room_uuid:               z.string().optional(),
  room_number:             z.string().max(50).optional(),
  move_in_date:            z.string().optional(),
  first_payment_due_date:  z.string().optional(),
  lease_status:            z.enum(['pending', 'active', 'expired', 'terminated', 'cancelled']).optional(),
  emergency_name:          z.string().max(150).optional(),
  emergency_phone:         z.string().max(20).optional(),
  emergency_relationship:  z.string().max(50).optional(),
  notes:                   z.string().max(2000).optional(),
})
export type TenantSchema = z.infer<typeof tenantSchema>

// ─── Invoice ──────────────────────────────────────────────────────────────
export const invoiceSchema = z.object({
  lease_id:        z.coerce.number().int().positive('Lease is required'),
  invoice_month:   z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format: YYYY-MM'),
  due_date:        z.string().min(1, 'Due date is required'),
  rent_amount:     z.coerce.number().min(0, 'Rent amount is required'),
  late_fee:        z.coerce.number().min(0).optional(),
  utility_charges: z.coerce.number().min(0).optional(),
  other_charges:   z.coerce.number().min(0).optional(),
  discount:        z.coerce.number().min(0).optional(),
  notes:           z.string().max(1000).optional(),
})
export type InvoiceSchema = z.infer<typeof invoiceSchema>

export const voidInvoiceSchema = z.object({
  reason: z.string().min(5, 'Please provide a reason').max(500),
})
export type VoidInvoiceSchema = z.infer<typeof voidInvoiceSchema>

// ─── Payment ──────────────────────────────────────────────────────────────
export const paymentSchema = z.object({
  invoice_id:     z.coerce.number().int().positive('Invoice is required'),
  tenant_id:      z.coerce.number().int().positive('Tenant is required'),
  amount:         z.coerce.number().positive('Amount must be greater than 0'),
  method:         z.enum(['bank_transfer', 'mpesa', 'card', 'cheque'], {
    errorMap: () => ({ message: 'Please select a payment method' }),
  }),
  transaction_id: z.string().max(100).optional(),
  phone_number:   z.string().max(20).optional(),
  paid_at:        z.string().optional(),
  notes:          z.string().max(500).optional(),
}).refine(d => d.method !== 'mpesa' || !!d.phone_number, {
  message: 'Phone number is required for M-Pesa',
  path:    ['phone_number'],
})
export type PaymentSchema = z.infer<typeof paymentSchema>

export const rentPaymentSchema = z.object({
  amount:         z.coerce.number().positive('Amount is required'),
  method:         z.enum(['bank_transfer', 'mpesa', 'card', 'cheque']),
  transaction_id: z.string().max(100).optional(),
  phone_number:   z.string().max(20).optional(),
  notes:          z.string().max(500).optional(),
})
export type RentPaymentSchema = z.infer<typeof rentPaymentSchema>

// ─── Lease ────────────────────────────────────────────────────────────────
export const leaseSchema = z.object({
  room_id:           z.string().min(1, 'Room is required'),
  bed_id:            z.string().optional(),
  tenant_id:         z.string().min(1, 'Tenant is required'),
  booking_id:        z.string().optional(),
  start_date:        z.string().min(1, 'Start date is required'),
  lease_term_months: z.coerce.number().int().min(1, 'Min 1 month').max(60),
  monthly_rent:      z.coerce.number().positive('Monthly rent is required'),
  security_deposit:  z.coerce.number().min(0).optional(),
  advance_rent:      z.coerce.number().min(0).optional(),
  payment_due_day:   z.coerce.number().int().min(1).max(28).optional(),
  payment_method:    z.enum(['cash', 'bank_transfer', 'mpesa', 'card']).optional(),
  terms:             z.string().max(5000).optional(),
})
export type LeaseSchema = z.infer<typeof leaseSchema>

export const terminateLeaseSchema = z.object({
  reason:           z.string().min(5, 'Please provide a reason').max(500),
  termination_date: z.string().optional(),
})
export type TerminateLeaseSchema = z.infer<typeof terminateLeaseSchema>

export const renewLeaseSchema = z.object({
  lease_term_months: z.coerce.number().int().min(1).max(60),
  monthly_rent:      z.coerce.number().positive().optional(),
  payment_due_day:   z.coerce.number().int().min(1).max(28).optional(),
})
export type RenewLeaseSchema = z.infer<typeof renewLeaseSchema>

// ─── Maintenance ──────────────────────────────────────────────────────────
export const maintenanceSchema = z.object({
  room_id:      z.string().optional(),
  tenant_id:    z.string().optional(),
  title:        z.string().min(3, 'Title is required').max(255),
  description:  z.string().min(10, 'Please describe the issue').max(2000),
  category:     z.enum(
    ['electrical','plumbing','furniture','appliance','structural','cleaning','pest_control','repair','other'],
    { errorMap: () => ({ message: 'Select a category' }) }
  ),
  priority:     z.enum(['low','medium','high','urgent']).optional(),
})
export type MaintenanceSchema = z.infer<typeof maintenanceSchema>

export const tenantMaintenanceSchema = z.object({
  title:       z.string().min(3, 'Title is required').max(255),
  description: z.string().min(10, 'Please describe the issue').max(2000),
  category:    z.enum(
    ['electrical','plumbing','furniture','appliance','structural','cleaning','pest_control','repair','other'],
    { errorMap: () => ({ message: 'Select a category' }) }
  ),
  priority:    z.enum(['low','medium','high']).optional(),
})
export type TenantMaintenanceSchema = z.infer<typeof tenantMaintenanceSchema>

export const resolveMaintenanceSchema = z.object({
  resolution_notes: z.string().min(5, 'Please describe the resolution').max(2000),
  repair_cost:      z.coerce.number().min(0).optional(),
})
export type ResolveMaintenanceSchema = z.infer<typeof resolveMaintenanceSchema>

// ─── Announcement ─────────────────────────────────────────────────────────
export const announcementSchema = z.object({
  title:       z.string().min(3).max(255),
  content:     z.string().min(10).max(5000),
  audience:    z.enum(['all','tenants','managers','admins']).default('tenants'),
  is_pinned:   z.boolean().optional(),
  publish_now: z.boolean().optional(),
  expires_at:  z.string().optional(),
})
export type AnnouncementSchema = z.infer<typeof announcementSchema>

// ─── Message ──────────────────────────────────────────────────────────────
export const messageSchema = z.object({
  receiver_id: z.coerce.number().int().positive('Recipient is required'),
  subject:     z.string().max(255).optional(),
  body:        z.string().min(1, 'Message cannot be empty').max(5000),
  parent_id:   z.coerce.number().int().positive().optional(),
})
export type MessageSchema = z.infer<typeof messageSchema>

// ─── Expense ──────────────────────────────────────────────────────────────
export const expenseSchema = z.object({
  title:          z.string().min(3).max(255),
  description:    z.string().max(1000).optional(),
  category:       z.enum(['maintenance','utilities','salary','supplies','insurance','tax','marketing','repair','other']),
  amount:         z.coerce.number().positive('Amount is required'),
  expense_date:   z.string().min(1, 'Date is required'),
  payment_method: z.preprocess((value) => value === '' ? undefined : value, z.enum(['cash','bank_transfer','card','cheque']).optional()),
  vendor:         z.string().max(150).optional(),
  receipt_path:   z.string().max(500).optional(),
  is_recurring:   z.boolean().optional(),
})
export type ExpenseSchema = z.infer<typeof expenseSchema>

// ─── Tenant settings ──────────────────────────────────────────────────────
export const tenantSettingsSchema = z.object({
  name:                      z.string().min(2).max(150).optional(),
  phone:                     z.string().max(20).optional(),
  current_password:          z.string().optional(),
  new_password:              z.string().min(8).optional().or(z.literal('')),
  new_password_confirmation: z.string().optional(),
  preferred_payment_method:  z.enum(['mpesa','bank']).optional(),
  emergency_name:            z.string().max(150).optional(),
  emergency_phone:           z.string().max(20).optional(),
  emergency_relationship:    z.string().max(50).optional(),
})
.refine(
  d => !d.new_password || d.new_password === d.new_password_confirmation,
  { message: 'Passwords do not match', path: ['new_password_confirmation'] }
)
.refine(
  d => !d.new_password || !!d.current_password,
  { message: 'Current password is required to set a new one', path: ['current_password'] }
)
export type TenantSettingsSchema = z.infer<typeof tenantSettingsSchema>

// ─── Org user (admin creates managers) ────────────────────────────────────
export const orgUserSchema = z.object({
  name:     z.string().min(2).max(150),
  email:    z.string().email(),
  phone:    z.string().max(20).optional(),
  password: z.string().min(8, 'At least 8 characters'),
  role:     z.enum(['manager']),
  property_ids: z.array(z.string()).optional(),
  property_permissions: z.record(z.record(z.boolean())).optional(),
}).refine(d => (d.property_ids?.length ?? 0) === 1, {
  message: 'Assign the current property',
  path: ['property_ids'],
})
export type OrgUserSchema = z.infer<typeof orgUserSchema>
