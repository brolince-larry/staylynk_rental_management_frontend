// src/schemas/misc.schema.ts
import { z } from 'zod'

export const announcementSchema = z.object({
  title:       z.string().min(3).max(255),
  content:     z.string().min(10).max(5000),
  audience:    z.enum(['all', 'tenants', 'managers', 'admins']).default('tenants'),
  is_pinned:   z.boolean().optional(),
  publish_now: z.boolean().optional(),
  expires_at:  z.string().optional(),
})
export type AnnouncementSchema = z.infer<typeof announcementSchema>

// Tenant compose: no recipient picker — the backend auto-routes to the
// property's manager/admin.
export const messageSchema = z.object({
  subject:  z.string().max(255).optional(),
  body:     z.string().min(1, 'Message cannot be empty').max(5000),
  parent_id: z.string().optional(),
})
export type MessageSchema = z.infer<typeof messageSchema>

// Manager/admin compose: the sender must pick a recipient.
export const staffMessageSchema = messageSchema.extend({
  receiver_id: z.string().min(1, 'Recipient is required'),
})
export type StaffMessageSchema = z.infer<typeof staffMessageSchema>

export const expenseSchema = z.object({
  title:          z.string().min(3).max(255),
  description:    z.string().max(1000).optional(),
  category:       z.enum([
    'maintenance', 'utilities', 'salary', 'supplies',
    'insurance', 'tax', 'marketing', 'repair', 'other',
  ]),
  amount:         z.coerce.number().positive('Amount is required'),
  expense_date:   z.string().min(1, 'Date is required'),
  payment_method: z.preprocess((value) => value === '' ? undefined : value, z.enum(['cash', 'bank_transfer', 'card', 'cheque']).optional()),
  vendor:         z.string().max(150).optional(),
  receipt_path:   z.string().max(500).optional(),
  is_recurring:   z.boolean().optional(),
})
export type ExpenseSchema = z.infer<typeof expenseSchema>
