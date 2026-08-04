import React, { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { KeyRound, Plus, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { Button, FilterBar, FormField, Input, Modal, Select, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge, StatCard } from '@/components/ui'
import { usePagination, useToast } from '@/hooks'
import type { PaymentCredential, PaymentProvider } from '@/types'
import { isApiError } from '@/utils/errors'
import { paymentCredentialsApi, type PaymentCredentialApproval } from '@/api/paymentCredentials'
import { useOrganizationProperties, useOrganizations } from '../hooks/useOrganizations'
import {
  useCreatePaymentCredential,
  useDisablePaymentCredential,
  usePaymentCredentials,
  useUpdatePaymentCredential,
} from '../hooks/usePaymentCredentials'

const credentialSchema = z.object({
  org_id: z.string().min(1, 'Select an organisation'),
  property_id: z.string().optional(),
  provider: z.enum(['mpesa', 'paypal']),
  environment: z.enum(['sandbox', 'production']),
  display_name: z.string().min(2, 'Display name is required').max(120),
  shortcode: z.string().max(50).optional(),
  consumer_key: z.string().max(500).optional(),
  consumer_secret: z.string().max(500).optional(),
  passkey: z.string().max(500).optional(),
  callback_url: z.string().url('Enter a valid callback URL').max(500).optional().or(z.literal('')),
  is_active: z.boolean(),
})

type CredentialForm = z.infer<typeof credentialSchema>

const DEFAULTS: CredentialForm = {
  org_id: '',
  property_id: '',
  provider: 'mpesa',
  environment: 'sandbox',
  display_name: '',
  shortcode: '',
  consumer_key: '',
  consumer_secret: '',
  passkey: '',
  callback_url: '',
  is_active: true,
}

function propertyIdError(err: unknown): string | null {
  if (!isApiError(err) || !err.errors || Array.isArray(err.errors)) return null
  return 'property_id' in err.errors ? 'Selected property does not belong to the selected organization.' : null
}

function approvalError(err: unknown): string | null {
  if (!isApiError(err)) return null
  const errors = !Array.isArray(err.errors) ? err.errors : null
  const hasApprovalError = Boolean(errors && ('approval' in errors || 'superadmin_email' in errors))
  return hasApprovalError || err.message.toLowerCase().includes('superadmin email')
    ? 'No active superadmin email available.'
    : null
}

function pendingApproval(data: unknown): PaymentCredentialApproval | null {
  const record = data as Partial<PaymentCredentialApproval> | null | undefined
  return record?.status === 'pending_approval' ? record as PaymentCredentialApproval : null
}

function approvalDescription(approval: PaymentCredentialApproval): string {
  if (!approval.expires_at) return 'This credential will be applied after approval.'

  const expiresAt = new Date(approval.expires_at)
  const formatted = Number.isNaN(expiresAt.getTime())
    ? approval.expires_at
    : expiresAt.toLocaleString()
  return `This credential will be applied after approval. Approval expires at ${formatted}.`
}

// email_sent can be false even on a successful request (e.g. the mail
// server is unreachable) — show that as a warning instead of quietly
// claiming an email went out, so a superadmin knows to follow up directly.
function approvalToast(approval: PaymentCredentialApproval): { title: string; description: string } {
  return approval.email_sent === false
    ? { title: 'Saved — approval email could not be sent', description: `A superadmin will need to review this request directly. ${approvalDescription(approval)}` }
    : { title: 'Approval email sent to superadmin.', description: approvalDescription(approval) }
}

export default function PaymentCredentials(): React.ReactElement {
  const [provider, setProvider] = useState('')
  const [editing, setEditing] = useState<PaymentCredential | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [otpModal, setOtpModal] = useState<{ approvalId: string } | null>(null)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { toasts, success, warning, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError, refetch, isRefetching } = usePaymentCredentials({
    provider: provider ? provider as PaymentProvider : undefined,
    page,
    per_page: perPage,
  })
  const { data: orgData } = useOrganizations({ per_page: 100 })
  const { mutate: createCredential, isPending: creating } = useCreatePaymentCredential()
  const { mutate: updateCredential, isPending: updating } = useUpdatePaymentCredential()
  const { mutate: disableCredential, isPending: disabling } = useDisablePaymentCredential()

  const rows = data?.data ?? []
  const meta = data?.meta
  const orgs = (orgData?.data ?? []) as Array<Record<string, unknown>>

  const form = useForm<CredentialForm>({
    resolver: zodResolver(credentialSchema) as Resolver<CredentialForm>,
    defaultValues: DEFAULTS,
  })
  const selectedOrgId = useWatch({ control: form.control, name: 'org_id' })
  const selectedPropertyId = useWatch({ control: form.control, name: 'property_id' })
  const { data: orgProperties = [] } = useOrganizationProperties(selectedOrgId || '')

  useEffect(() => {
    if (!modalOpen) return
    if (!editing) {
      form.reset(DEFAULTS)
      return
    }
    form.reset({
      org_id: String(editing.org?.id ?? ''),
      property_id: editing.property?.id ?? '',
      provider: editing.provider,
      environment: editing.environment,
      display_name: editing.display_name,
      shortcode: editing.shortcode ?? '',
      consumer_key: '',
      consumer_secret: '',
      passkey: '',
      callback_url: editing.callback_url ?? DEFAULTS.callback_url,
      is_active: editing.is_active,
    })
  }, [editing, form, modalOpen])

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    form.reset(DEFAULTS)
  }

  const saveCredential = (values: CredentialForm) => {
    const propertyId = values.property_id || ''
    const createPayload = {
      org_id: values.org_id,
      property_id: propertyId || null,
      provider: values.provider,
      environment: values.environment,
      display_name: values.display_name,
      shortcode: values.shortcode || null,
      callback_url: values.callback_url || null,
      consumer_key: values.consumer_key || undefined,
      consumer_secret: values.consumer_secret || undefined,
      passkey: values.passkey || undefined,
      is_active: values.is_active,
    }

    if (editing) {
      const updatePayload = {
        property_id: propertyId || null,
        display_name: values.display_name,
        callback_url: values.callback_url || null,
        is_active: values.is_active,
      }

      updateCredential({ id: editing.id, data: updatePayload }, {
        onSuccess: (response) => {
          const approval = pendingApproval(response.data)
          if (approval) {
            closeModal()
            if (approval.email_sent === false) {
              warning('Approval email could not be sent', 'A superadmin will need to review it directly.')
              return
            }
            setOtpModal({ approvalId: approval.approval_id })
            return
          }
          success('Payment credential updated')
          closeModal()
        },
        onError: (err) => {
          const message = propertyIdError(err)
          if (message) form.setError('property_id', { type: 'server', message })
          const approvalMessage = approvalError(err)
          if (approvalMessage) {
            warning(approvalMessage, 'Configure an active superadmin email before requesting approval.')
            return
          }
          toastError(err, 'Failed to update payment credential')
        },
      })
      return
    }

    createCredential(createPayload, {
      onSuccess: (response) => {
        const approval = pendingApproval(response.data)
        if (approval) {
          closeModal()
          if (approval.email_sent === false) {
            warning('Approval email could not be sent', 'A superadmin will need to review it directly.')
            return
          }
          setOtpModal({ approvalId: approval.approval_id })
          return
        }
        success('Payment credential saved')
        closeModal()
      },
      onError: (err) => {
        const message = propertyIdError(err)
        if (message) form.setError('property_id', { type: 'server', message })
        const approvalMessage = approvalError(err)
        if (approvalMessage) {
          warning(approvalMessage, 'Configure an active superadmin email before requesting approval.')
          return
        }
        toastError(err, 'Failed to save payment credential')
      },
    })
  }

  const columns: ColumnDef<PaymentCredential>[] = [
    {
      key: 'display_name', header: 'Credential',
      accessor: (row) => (
        <div>
          <p className="text-xs font-semibold text-foreground">{row.display_name}</p>
          <p className="text-xs text-muted-foreground">{row.org?.name ?? 'Unknown organisation'}</p>
        </div>
      ),
    },
    {
      key: 'property', header: 'Scope',
      accessor: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.property?.name ?? 'All properties'}
        </span>
      ),
    },
    {
      key: 'provider', header: 'Provider',
      accessor: (row) => <StatusBadge status={row.provider} />,
    },
    {
      key: 'environment', header: 'Environment',
      accessor: (row) => <span className="text-xs capitalize text-muted-foreground">{row.environment}</span>,
    },
    {
      key: 'shortcode', header: 'Shortcode',
      accessor: (row) => <span className="text-xs font-mono text-muted-foreground">{row.shortcode ?? '—'}</span>,
    },
    {
      key: 'secrets', header: 'Keys',
      accessor: (row) => (
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            Secrets {row.secret_set ? 'set' : 'missing'}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            Public key {row.public_key_set ? 'set' : 'missing'}
          </span>
        </div>
      ),
    },
    {
      key: 'is_active', header: 'Status',
      accessor: (row) => <StatusBadge status={row.is_active ? 'active' : 'disabled'} />,
    },
    {
      key: 'actions', header: '', width: 'w-32',
      accessor: (row) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setEditing(row); setModalOpen(true) }} className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10">
            Edit
          </button>
          {row.is_active && (
            <button
              disabled={disabling}
              onClick={() => disableCredential(row.id, {
                onSuccess: () => success('Payment credential disabled'),
                onError: (err) => toastError(err, 'Failed to disable payment credential'),
              })}
              className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
            >
              Disable
            </button>
          )}
        </div>
      ),
    },
  ]

  const activeCount = rows.filter((row) => row.is_active).length

  return (
    <>
      <Helmet><title>Payment Credentials — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Payment Credentials"
          subtitle="Manage platform and property payment provider settings."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" loading={isRefetching} onClick={() => { void refetch() }}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button onClick={() => { setEditing(null); setModalOpen(true) }}>
                <Plus className="h-3.5 w-3.5" /> New Credential
              </Button>
            </div>
          }
        />

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Credentials" value={meta?.total ?? rows.length} icon={<KeyRound className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-100" />
          <StatCard label="Active on Page" value={activeCount} icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-100" />
          <StatCard label="Disabled on Page" value={rows.length - activeCount} icon={<ShieldOff className="h-4 w-4 text-slate-600" />} iconBg="bg-slate-100" />
        </div>

        <FilterBar>
          <Select
            value={provider}
            onChange={(e) => { setProvider(e.target.value); setPage(1) }}
            className="w-40 text-xs"
            options={[
              { value: '', label: 'All providers' },
              { value: 'mpesa', label: 'M-Pesa' },
              { value: 'paypal', label: 'PayPal' },
            ]}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={isLoading}
          error={isError ? 'Failed to load payment credentials.' : null}
          emptyTitle="No payment credentials"
          emptyDescription="Create a provider credential to enable online payments."
          pagination={meta}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          caption="Payment credentials"
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Payment Credential' : 'New Payment Credential'}
        description="Saved secrets are never shown back in the UI."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button loading={creating || updating} onClick={form.handleSubmit(saveCredential)}>
              {editing ? 'Save Changes' : 'Save Credential'}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(saveCredential)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Organisation" htmlFor="pc-org" error={form.formState.errors.org_id?.message} required>
            <Select
              id="pc-org"
              error={!!form.formState.errors.org_id}
              value={selectedOrgId || ''}
              onChange={(event) => {
                form.setValue('org_id', event.target.value, { shouldDirty: true, shouldValidate: true })
                form.setValue('property_id', '', { shouldDirty: true, shouldValidate: true })
              }}
              onBlur={() => { void form.trigger('org_id') }}
              options={[
                { value: '', label: 'Select organisation', disabled: true },
                ...orgs.map((org) => ({ value: String(org.id), label: org.name as string })),
              ]}
            />
          </FormField>
          <FormField
            label="Property"
            htmlFor="pc-property"
            error={form.formState.errors.property_id?.message}
            hint="Leave blank to share across all properties"
          >
            <Select
              id="pc-property"
              disabled={!selectedOrgId}
              error={!!form.formState.errors.property_id}
              value={selectedPropertyId || ''}
              onChange={(event) => form.setValue('property_id', event.target.value, { shouldDirty: true, shouldValidate: true })}
              options={[
                { value: '', label: selectedOrgId ? 'Share across all properties' : 'Select organisation first' },
                ...orgProperties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </FormField>
          <FormField label="Provider" htmlFor="pc-provider" required>
            <Select
              id="pc-provider"
              {...form.register('provider')}
              options={[
                { value: 'mpesa', label: 'M-Pesa' },
                { value: 'paypal', label: 'PayPal' },
              ]}
            />
          </FormField>
          <FormField label="Environment" htmlFor="pc-env" required>
            <Select
              id="pc-env"
              {...form.register('environment')}
              options={[
                { value: 'sandbox', label: 'Sandbox' },
                { value: 'production', label: 'Production' },
              ]}
            />
          </FormField>
          <FormField label="Display Name" htmlFor="pc-name" error={form.formState.errors.display_name?.message} required>
            <Input id="pc-name" error={!!form.formState.errors.display_name} placeholder="Platform M-Pesa" {...form.register('display_name')} />
          </FormField>
          <FormField label="Shortcode" htmlFor="pc-shortcode">
            <Input id="pc-shortcode" placeholder="174379" {...form.register('shortcode')} />
          </FormField>
          <FormField label="Consumer Key" htmlFor="pc-key" hint={editing ? 'Leave blank to keep existing' : undefined}>
            <Input id="pc-key" autoComplete="off" {...form.register('consumer_key')} />
          </FormField>
          <FormField label="Consumer Secret" htmlFor="pc-secret" hint={editing ? 'Leave blank to keep existing' : undefined}>
            <Input id="pc-secret" type="password" autoComplete="new-password" {...form.register('consumer_secret')} />
          </FormField>
          <FormField label="Passkey" htmlFor="pc-passkey" hint={editing ? 'Leave blank to keep existing' : undefined}>
            <Input id="pc-passkey" type="password" autoComplete="new-password" {...form.register('passkey')} />
          </FormField>
          <FormField label="Callback URL" htmlFor="pc-callback" error={form.formState.errors.callback_url?.message} hint="Leave blank to use StayLynk's built-in callback handler (recommended)">
            <Input id="pc-callback" type="url" placeholder="Leave blank for default" error={!!form.formState.errors.callback_url} {...form.register('callback_url')} />
          </FormField>
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" {...form.register('is_active')} />
            Active credential
          </label>
        </form>
      </Modal>
      {otpModal && (
        <OtpVerifyModal
          approvalId={otpModal.approvalId}
          onClose={() => setOtpModal(null)}
          onVerified={() => {
            setOtpModal(null)
            success('Payment credential approved and applied')
            void refetch()
          }}
        />
      )}
    </>
  )
}

function OtpVerifyModal({
  approvalId,
  onClose,
  onVerified,
}: {
  approvalId: string
  onClose: () => void
  onVerified: () => void
}): React.ReactElement {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const submit = async (code: string) => {
    setVerifying(true)
    setError(null)
    try {
      await paymentCredentialsApi.verifyOtp(approvalId, code)
      onVerified()
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Verification failed. Please try again.')
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setVerifying(false)
    }
  }

  const handleChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = char
    setDigits(next)
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    if (char && index === 5) {
      const code = next.join('')
      if (code.length === 6) void submit(code)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <Modal open onClose={onClose} title="Enter verification code" size="sm">
      <p className="mb-4 text-sm text-muted-foreground">
        A 6-digit code was sent to the active superadmin email(s). It expires in 3 minutes.
      </p>
      <div className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            disabled={verifying}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="h-12 w-10 rounded-lg border border-border bg-background text-center text-lg font-semibold text-foreground disabled:opacity-50"
          />
        ))}
      </div>
      {error && <p className="mt-3 text-center text-sm text-red-500">{error}</p>}
      {verifying && <p className="mt-3 text-center text-sm text-muted-foreground">Verifying…</p>}
    </Modal>
  )
}
