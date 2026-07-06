// src/schemas/auth.schema.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email:    z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
export type LoginSchema = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  org_name:              z.string().min(2, 'Organisation name is required').max(150),
  org_email:             z.string().email('Invalid organisation email'),
  org_phone:             z.string().min(7, 'Organisation phone is required').max(20),
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

export const changePasswordSchema = z.object({
  current_password:          z.string().min(1, 'Current password is required'),
  new_password:              z.string().min(8, 'At least 8 characters'),
  new_password_confirmation: z.string(),
}).refine(d => d.new_password === d.new_password_confirmation, {
  message: 'Passwords do not match',
  path:    ['new_password_confirmation'],
})
export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>