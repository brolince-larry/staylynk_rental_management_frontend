// src/schemas/tenant.schema.ts
import { z } from 'zod'

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

export const tenantSettingsSchema = z.object({
  name:                      z.string().min(2).max(150).optional(),
  phone:                     z.string().max(20).optional(),
  current_password:          z.string().optional(),
  new_password:              z.string().min(8).optional().or(z.literal('')),
  new_password_confirmation: z.string().optional(),
  preferred_payment_method:  z.enum(['mpesa', 'bank']).optional(),
  emergency_name:            z.string().max(150).optional(),
  emergency_phone:           z.string().max(20).optional(),
  emergency_relationship:    z.string().max(50).optional(),
})
.refine(d => !d.new_password || d.new_password === d.new_password_confirmation, {
  message: 'Passwords do not match',
  path:    ['new_password_confirmation'],
})
.refine(d => !d.new_password || !!d.current_password, {
  message: 'Current password is required to set a new one',
  path:    ['current_password'],
})
export type TenantSettingsSchema = z.infer<typeof tenantSettingsSchema>

export const orgUserSchema = z.object({
  name:     z.string().min(2).max(150),
  email:    z.string().email('Invalid email'),
  phone:    z.string().max(20).optional(),
  password: z.string().min(8, 'At least 8 characters'),
  role:     z.enum(['manager', 'caretaker', 'tenant']),
  property_ids: z.array(z.string()).optional(),
  property_permissions: z.record(z.record(z.boolean())).optional(),
}).refine(d => d.role === 'tenant' || (d.property_ids?.length ?? 0) >= 1, {
  message: 'Assign at least one property',
  path: ['property_ids'],
})
export type OrgUserSchema = z.infer<typeof orgUserSchema>
