// src/schemas/maintenance.schema.ts
import { z } from 'zod'

const CATEGORIES = [
  'electrical', 'plumbing', 'furniture', 'appliance',
  'structural', 'cleaning', 'pest_control', 'repair', 'other',
] as const

export const maintenanceSchema = z.object({
  room_id:      z.string().optional(),
  tenant_id:    z.string().optional(),
  title:        z.string().min(3, 'Title is required').max(255),
  description:  z.string().min(10, 'Please describe the issue').max(2000),
  category:     z.enum(CATEGORIES, { errorMap: () => ({ message: 'Select a category' }) }),
  priority:     z.enum(['low', 'medium', 'high', 'urgent']).optional(),
})
export type MaintenanceSchema = z.infer<typeof maintenanceSchema>

// Tenant version — no property_id (resolved from lease), no urgent priority
export const tenantMaintenanceSchema = z.object({
  title:       z.string().min(3, 'Title is required').max(255),
  description: z.string().min(10, 'Please describe the issue').max(2000),
  category:    z.enum(CATEGORIES, { errorMap: () => ({ message: 'Select a category' }) }),
  priority:    z.enum(['low', 'medium', 'high']).optional(),
})
export type TenantMaintenanceSchema = z.infer<typeof tenantMaintenanceSchema>

export const resolveMaintenanceSchema = z.object({
  resolution_notes: z.string().min(5, 'Please describe the resolution').max(2000),
  repair_cost:      z.coerce.number().min(0).optional(),
})
export type ResolveMaintenanceSchema = z.infer<typeof resolveMaintenanceSchema>

export const rejectMaintenanceSchema = z.object({
  reason: z.string().min(5, 'Please provide a reason').max(500),
})
export type RejectMaintenanceSchema = z.infer<typeof rejectMaintenanceSchema>
