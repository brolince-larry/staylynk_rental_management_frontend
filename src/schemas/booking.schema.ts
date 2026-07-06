// src/schemas/booking.schema.ts
import { z } from 'zod'

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
  reason: z.string().min(5, 'Please provide a reason (min 5 characters)').max(500),
})
export type CancelBookingSchema = z.infer<typeof cancelBookingSchema>

export const checkInSchema = z.object({
  actual_check_in: z.string().min(1, 'Check-in datetime is required'),
  notes:           z.string().max(500).optional(),
})
export type CheckInSchema = z.infer<typeof checkInSchema>
