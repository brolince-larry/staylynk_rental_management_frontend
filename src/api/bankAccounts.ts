// src/api/bankAccounts.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './client'

export interface BankAccount {
  id: string
  bank_name: string
  account_name: string
  account_number: string
  branch?: string | null
  swift_code?: string | null
  instructions?: string | null
  applies_to_all_properties: boolean
  properties: { id: string; name: string }[]
  created_at: string
}

export interface BankAccountInput {
  bank_name: string
  account_name: string
  account_number: string
  branch?: string
  swift_code?: string
  instructions?: string
  applies_to_all_properties: boolean
  property_uuids?: string[]
}

export const bankAccountsApi = {
  list: () =>
    apiGet<{ data: BankAccount[] }>('/admin/bank-accounts'),

  create: (data: BankAccountInput) =>
    apiPost<BankAccount>('/admin/bank-accounts', data),

  update: (id: string, data: Partial<BankAccountInput>) =>
    apiPatch<BankAccount>(`/admin/bank-accounts/${id}`, data),

  remove: (id: string) =>
    apiDelete<void>(`/admin/bank-accounts/${id}`),
}
