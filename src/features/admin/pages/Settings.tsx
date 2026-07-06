// src/features/admin/pages/Settings.tsx
import React, { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useOrgSettings, useUpdateOrgSettings } from '../hooks/index'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsApi } from '@/api/tenants'
import { useToast } from '@/hooks'
import { PageHeader, SectionCard } from '@/components/ui'
import { Button, FormField, Input, Select, Textarea, ToastContainer } from '@/components/forms'
import { MediaUploadField } from '@/components/media'
import { mediaService } from '@/services/media'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/api/auth'
import { AlertTriangle, Building2, Camera, ImageIcon } from 'lucide-react'

const settingsSchema = z.object({
  name:          z.string().min(2),
  email:         z.string().email().optional().or(z.literal('')),
  phone:         z.string().max(20).optional(),
  address:       z.string().max(300).optional(),
  city:          z.string().max(100).optional(),
  country:       z.string().length(2).optional(),
  currency:      z.string().length(3).default('USD'),
  timezone:      z.string().optional(),
  late_fee_pct:  z.coerce.number().min(0).max(100).optional(),
  payment_due_day: z.coerce.number().int().min(1).max(28).optional(),
})
type SettingsForm = z.infer<typeof settingsSchema>

const bankAccountSchema = z.object({
  bank_name:      z.string().min(1, 'Bank name is required'),
  account_name:   z.string().min(1, 'Account name is required'),
  account_number: z.string().min(1, 'Account number is required'),
  branch:         z.string().optional(),
  swift_code:     z.string().optional(),
  instructions:   z.string().optional(),
})
type BankAccountForm = z.infer<typeof bankAccountSchema>

function textValue(source: Record<string, unknown> | null | undefined, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return fallback
}

function numberValue(source: Record<string, unknown> | null | undefined, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return fallback
}

export default function Settings(): React.ReactElement {
  const { toasts, success, error: toastError, dismiss } = useToast()
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const currentProperty = useAuthStore(s => s.user?.current_property)
  const qc = useQueryClient()
  const [logoFiles, setLogoFiles] = useState<File[]>([])
  const [logoProgress, setLogoProgress] = useState<number | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [coverFiles, setCoverFiles] = useState<File[]>([])
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [savingBank, setSavingBank] = useState(false)
  const [penaltyEnabled, setPenaltyEnabled] = useState(false)
  const [penaltyType, setPenaltyType] = useState<'daily' | 'monthly'>('monthly')
  const [penaltyAmount, setPenaltyAmount] = useState('')
  const [penaltyGraceDays, setPenaltyGraceDays] = useState('0')
  const coverInputRef = useRef<HTMLInputElement>(null)
  const { data: settingsData, isLoading } = useOrgSettings()
  const { mutate: updateSettings, isPending: saving } = useUpdateOrgSettings()

  const { mutate: savePenalty, isPending: savingPenalty } = useMutation({
    mutationFn: () => tenantsApi.updatePropertyPenalty(currentProperty?.uuid as string, {
      penalty_enabled: penaltyEnabled,
      penalty_type: penaltyType,
      penalty_amount: parseFloat(penaltyAmount) || 0,
      penalty_grace_days: parseInt(penaltyGraceDays) || 0,
    }),
    onSuccess: () => { success('Penalty settings saved'); void qc.invalidateQueries({ queryKey: ['admin', 'org-settings'] }) },
    onError: (err) => toastError(err, 'Failed to save penalty settings'),
  })

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema) as Resolver<SettingsForm>,
    defaultValues: { currency: 'USD', payment_due_day: 1 },
  })

  const bankForm = useForm<BankAccountForm>({
    resolver: zodResolver(bankAccountSchema) as Resolver<BankAccountForm>,
    defaultValues: { bank_name: '', account_name: '', account_number: '', branch: '', swift_code: '', instructions: '' },
  })

  // Populate form when data loads
  useEffect(() => {
    // Response shape: { data: { org: { ... } } }
    const raw = settingsData as Record<string, unknown> | null | undefined
    const org = (raw?.org as Record<string, unknown> | null | undefined)
      ?? (user?.org as Record<string, unknown> | null | undefined)
    if (!org) return

    const orgSettings = org.settings as Record<string, unknown> | null | undefined

    form.reset({
      name:            textValue(org, ['name']),
      email:           textValue(org, ['email']),
      phone:           textValue(org, ['phone']),
      address:         textValue(org, ['address']),
      city:            textValue(org, ['city']),
      country:         textValue(org, ['country']),
      currency:        textValue(org, ['currency'], 'USD'),
      timezone:        textValue(org, ['timezone']),
      late_fee_pct:    numberValue(orgSettings, ['late_fee_pct', 'late_fee_percentage'], 0),
      payment_due_day: numberValue(orgSettings, ['payment_due_day'], 1),
    })

    // Bank account is nested in org.settings.bank_account
    const ba = orgSettings?.bank_account as Record<string, unknown> | null | undefined
    if (ba) {
      bankForm.reset({
        bank_name:      textValue(ba, ['bank_name']),
        account_name:   textValue(ba, ['account_name']),
        account_number: textValue(ba, ['account_number']),
        branch:         textValue(ba, ['branch']),
        swift_code:     textValue(ba, ['swift_code']),
        instructions:   textValue(ba, ['instructions']),
      })
    }
  }, [settingsData, user?.org, form, bankForm])

  const handleSaveBank = (values: BankAccountForm) => {
    setSavingBank(true)
    updateSettings(
      { bank_account: values } as unknown as Parameters<typeof updateSettings>[0],
      {
        onSuccess: () => { success('Bank account saved'); setSavingBank(false) },
        onError:   (err) => { toastError(err, 'Failed to save bank account'); setSavingBank(false) },
      }
    )
  }

  const handleSave = (values: SettingsForm) => {
    updateSettings(values as unknown as Parameters<typeof updateSettings>[0], {
      onSuccess: () => {
        if (user?.org) {
          setUser({
            ...user,
            org: {
              ...user.org,
              name: values.name,
              email: values.email,
              organization_email: values.email,
              phone: values.phone,
              organization_phone: values.phone,
              address: values.address,
              city: values.city,
              country: values.country,
              currency: values.currency,
              timezone: values.timezone,
              late_fee_pct: values.late_fee_pct,
              payment_due_day: values.payment_due_day,
            },
          })
          void authApi.me().then((res) => setUser(res.data)).catch(() => undefined)
        }

        const orgId = user?.org?.id
        if (!orgId || (logoFiles.length === 0 && coverFiles.length === 0)) {
          success('Settings saved')
          return
        }

        void (async () => {
          try {
            if (logoFiles.length > 0) {
              setUploadingLogo(true)
              await mediaService.uploadFilesForEntity({
                files: logoFiles,
                media_type: 'organization_logo',
                entity_type: 'organization',
                entity_id: orgId,
                is_public: true,
                cover_index: 0,
                alt_text: `${values.name} logo`,
              }, ({ progress }) => setLogoProgress(progress))
              setLogoFiles([])
            }
            if (coverFiles.length > 0) {
              setUploadingCover(true)
              await mediaService.uploadFilesForEntity({
                files: coverFiles,
                media_type: 'organization_cover',
                entity_type: 'organization',
                entity_id: orgId,
                is_public: true,
                cover_index: 0,
                alt_text: `${values.name} cover`,
              }, () => undefined)
              setCoverFiles([])
            }
            success('Settings saved. Media is processing.')
          } catch (err) {
            toastError(err, 'Settings saved, but media upload failed')
          } finally {
            setUploadingLogo(false)
            setUploadingCover(false)
            setLogoProgress(null)
          }
        })()
      },
      onError: (err) => toastError(err, 'Failed to save settings'),
    })
  }

  // Response shape: { data: { org: { logo_image: { optimized_urls: { medium, large, thumbnail } } } } }
  const orgRecord = ((settingsData as Record<string, unknown> | null)?.org as Record<string, unknown> | null | undefined)
    ?? (user?.org as Record<string, unknown> | null | undefined)

  function resolveMediaUrl(field: unknown): string | undefined {
    const m = field as Record<string, unknown> | undefined
    if (!m) return undefined
    const urls = m.optimized_urls as Record<string, string> | undefined
    return urls?.medium ?? urls?.large ?? urls?.thumbnail ?? (m.url as string | undefined)
  }

  const existingLogoUrl = (orgRecord?.logo_url as string | undefined) ?? resolveMediaUrl(orgRecord?.logo_image)
  const existingCoverUrl = (orgRecord?.cover_url as string | undefined)
    ?? resolveMediaUrl(orgRecord?.cover_image)
    ?? existingLogoUrl
  const activeCoverSrc = coverPreview ?? existingCoverUrl ?? null

  const onCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFiles([file])
    const reader = new FileReader()
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <>
      <Helmet><title>Settings — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Organisation Settings"
          subtitle={`Configure settings for ${user?.org?.name ?? 'your organisation'}.`}
          actions={
            <Button loading={saving || uploadingLogo || uploadingCover} onClick={form.handleSubmit(handleSave)}>
              Save Changes
            </Button>
          }
        />

        <div className="space-y-4">
          {/* General */}
          <SectionCard title="General Information">
            {isLoading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
                {/* ── Form fields ── */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Organisation Name" htmlFor="oname" error={form.formState.errors.name?.message} required className="col-span-2">
                    <Input id="oname" {...form.register('name')} error={!!form.formState.errors.name} />
                  </FormField>
                  <FormField label="Email" htmlFor="oemail" error={form.formState.errors.email?.message}>
                    <Input id="oemail" type="email" {...form.register('email')} error={!!form.formState.errors.email} />
                  </FormField>
                  <FormField label="Phone" htmlFor="ophone">
                    <Input id="ophone" {...form.register('phone')} />
                  </FormField>
                  <FormField label="Address" htmlFor="oaddress" className="col-span-2">
                    <Input id="oaddress" {...form.register('address')} />
                  </FormField>
                  <FormField label="City" htmlFor="ocity">
                    <Input id="ocity" {...form.register('city')} />
                  </FormField>
                  <FormField label="Country Code" htmlFor="ocountry" hint="2-letter e.g. KE">
                    <Input id="ocountry" maxLength={2} {...form.register('country')} />
                  </FormField>
                  <div className="col-span-2">
                    <MediaUploadField
                      label="Organisation Logo"
                      mediaType="organization_logo"
                      files={logoFiles}
                      onChange={setLogoFiles}
                      hint="PNG, JPG, or WebP up to 2MB."
                      progress={uploadingLogo ? logoProgress : null}
                    />
                  </div>
                </div>

                {/* ── Cover image panel ── */}
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">Cover Image</p>
                  <div className="group relative flex-1 overflow-hidden rounded-xl border border-border bg-muted shadow-sm" style={{ minHeight: '240px' }}>
                    {activeCoverSrc ? (
                      <img
                        src={activeCoverSrc}
                        alt="Organisation cover"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/10 via-violet-100/60 to-indigo-100/40 dark:from-primary/20 dark:via-violet-900/20 dark:to-indigo-900/10">
                        <ImageIcon className="h-10 w-10 text-primary/40" />
                        <p className="text-xs text-muted-foreground">No cover image</p>
                      </div>
                    )}

                    {/* Camera overlay button */}
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      title="Change cover image"
                    >
                      <Camera className="h-4 w-4" />
                    </button>

                    {/* Click-anywhere overlay when no image */}
                    {!activeCoverSrc && (
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="absolute inset-0 cursor-pointer focus:outline-none"
                        aria-label="Upload cover image"
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Recommended: 1200×400px. PNG, JPG, or WebP up to 5MB.</p>

                  {/* Hidden file input */}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={onCoverFileChange}
                  />

                  {coverFiles.length > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                      <p className="truncate text-xs text-muted-foreground">{coverFiles[0].name}</p>
                      <button
                        type="button"
                        onClick={() => { setCoverFiles([]); setCoverPreview(null) }}
                        className="ml-2 shrink-0 text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Finance */}
          <SectionCard title="Finance Settings">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Currency" htmlFor="ocurrency">
                <Select id="ocurrency" {...form.register('currency')}
                  options={[{ value:'USD', label:'USD — US Dollar' }, { value:'KES', label:'KES — Kenyan Shilling' }, { value:'NGN', label:'NGN — Nigerian Naira' }, { value:'GHS', label:'GHS — Ghanaian Cedi' }, { value:'ZAR', label:'ZAR — South African Rand' }]}
                />
              </FormField>
              <FormField label="Payment Due Day" htmlFor="opay-day" hint="1–28 of each month">
                <Input id="opay-day" type="number" min={1} max={28} {...form.register('payment_due_day')} />
              </FormField>
              <FormField label="Late Fee (%)" htmlFor="olatefee" hint="Applied after due date">
                <Input id="olatefee" type="number" min={0} max={100} step="0.5" {...form.register('late_fee_pct')} />
              </FormField>
            </div>
          </SectionCard>

          {/* Bank Account */}
          <SectionCard
            title="Bank Account"
            action={
              <Button size="sm" loading={savingBank} onClick={bankForm.handleSubmit(handleSaveBank)}>
                Save Bank Account
              </Button>
            }
          >
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Tenants will see this account when they choose "Bank Transfer" as their payment method. Leave blank to disable bank transfer for this organisation.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Bank Name" htmlFor="ba-bank" error={bankForm.formState.errors.bank_name?.message} required>
                <Input id="ba-bank" placeholder="e.g. Equity Bank Kenya" error={!!bankForm.formState.errors.bank_name} {...bankForm.register('bank_name')} />
              </FormField>
              <FormField label="Account Name" htmlFor="ba-aname" error={bankForm.formState.errors.account_name?.message} required>
                <Input id="ba-aname" placeholder="e.g. Green View Properties Ltd" error={!!bankForm.formState.errors.account_name} {...bankForm.register('account_name')} />
              </FormField>
              <FormField label="Account Number" htmlFor="ba-anum" error={bankForm.formState.errors.account_number?.message} required>
                <Input id="ba-anum" placeholder="e.g. 0123456789" error={!!bankForm.formState.errors.account_number} {...bankForm.register('account_number')} />
              </FormField>
              <FormField label="Branch" htmlFor="ba-branch" hint="Optional">
                <Input id="ba-branch" placeholder="e.g. Westlands, Nairobi" {...bankForm.register('branch')} />
              </FormField>
              <FormField label="SWIFT / BIC Code" htmlFor="ba-swift" hint="For international transfers">
                <Input id="ba-swift" placeholder="e.g. EQBLKENAXXX" {...bankForm.register('swift_code')} />
              </FormField>
              <FormField label="Transfer Instructions" htmlFor="ba-instructions" hint="Shown to tenants" className="col-span-2">
                <Textarea id="ba-instructions" rows={2} placeholder="e.g. Use your invoice number as the payment reference." {...bankForm.register('instructions')} />
              </FormField>
            </div>
          </SectionCard>

          {/* Penalty Settings */}
          <SectionCard
            title="Late Payment Penalty"
            action={
              currentProperty?.id ? (
                <Button size="sm" loading={savingPenalty} onClick={() => savePenalty()}>
                  Save Penalty Settings
                </Button>
              ) : undefined
            }
          >
            {!currentProperty?.id ? (
              <p className="text-xs text-muted-foreground">Select a property first to configure penalty settings.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Penalty settings apply to <strong>{currentProperty.name}</strong>. All tenants in this property will see the penalty notice on their dashboard when enabled.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={penaltyEnabled}
                    onClick={() => setPenaltyEnabled(p => !p)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${penaltyEnabled ? 'bg-red-600' : 'bg-muted'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${penaltyEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <label className="text-sm font-medium text-foreground">
                    Enable late payment penalty for <span className="font-bold">{currentProperty.name}</span>
                  </label>
                </div>
                {penaltyEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Penalty Type" htmlFor="pen-type">
                      <Select id="pen-type" value={penaltyType} onChange={e => setPenaltyType(e.target.value as 'daily' | 'monthly')}
                        options={[
                          { value: 'monthly', label: 'Monthly (fixed amount per month overdue)' },
                          { value: 'daily',   label: 'Daily (amount × days overdue)' },
                        ]}
                      />
                    </FormField>
                    <FormField label={penaltyType === 'daily' ? 'Amount Per Day' : 'Monthly Penalty Amount'} htmlFor="pen-amount">
                      <Input id="pen-amount" type="number" min={0} step="0.01" value={penaltyAmount}
                        onChange={e => setPenaltyAmount(e.target.value)}
                        placeholder="e.g. 500" />
                    </FormField>
                    <FormField label="Grace Days" htmlFor="pen-grace" hint="Days after due date before penalty kicks in">
                      <Input id="pen-grace" type="number" min={0} max={30} value={penaltyGraceDays}
                        onChange={e => setPenaltyGraceDays(e.target.value)}
                        placeholder="0" />
                    </FormField>
                    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-400 self-end">
                      {penaltyType === 'daily'
                        ? `Penalty: ${penaltyAmount || 0} × (days overdue − ${penaltyGraceDays || 0} grace days)`
                        : `Penalty: flat ${penaltyAmount || 0} if overdue after ${penaltyGraceDays || 0} grace days`}
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* M-Pesa */}
          <SectionCard title="M-Pesa">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-4 py-3">
              <span className="text-lg leading-none">📱</span>
              <div className="text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
                <p className="font-semibold">M-Pesa (Daraja API)</p>
                <p>M-Pesa is configured via your Daraja API credentials in the server environment. Tenants can use M-Pesa STK push directly from the invoices page.</p>
                <p className="text-emerald-600 dark:text-emerald-400">Contact your system administrator to update M-Pesa credentials.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  )
}
