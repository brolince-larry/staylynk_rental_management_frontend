// src/schemas/invoice.schema.ts
import { z } from 'zod'

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

export const generateMonthlySchema = z.object({
  invoice_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format: YYYY-MM'),
})
export type GenerateMonthlySchema = z.infer<typeof generateMonthlySchema>

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
