// src/schemas/lease.schema.ts
import { z } from 'zod'

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
