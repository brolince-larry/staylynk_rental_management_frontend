import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Award, BadgeCheck, CheckCircle, FileText, FileUp, Lock, Mail, Phone, Shield, ShieldCheck, Star } from 'lucide-react'
import { Button, FormField, Input, Select, ToastContainer } from '@/components/forms'
import { PageHeader, SectionCard, StatusBadge, StatCard } from '@/components/ui'
import { useToast } from '@/hooks'
import { useLandlordVerificationStatus, useSubmitLandlordVerification } from '../layout/hooks/useVerification'
import type { VerificationApiStatusValue } from '@/api/verification'
import { useAuthStore } from '@/store/auth.store'
import { isApiError } from '@/utils/errors'

const DOCUMENT_TYPES = [
  { value: 'national_id', label: 'National ID' },
  { value: 'business_registration', label: 'Business Registration' },
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'lease_ownership', label: 'Lease Ownership' },
  { value: 'property_deed', label: 'Property Deed' },
  { value: 'manager_auth', label: 'Manager Authorization' },
]
const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf'])

const WHY_VERIFY = [
  { icon: <BadgeCheck className="h-5 w-5 text-amber-600" />, bg: 'bg-amber-50 dark:bg-amber-950/30', title: 'Trusted Landlord Badge', desc: 'Your listings display a prominent "Trusted" badge that immediately builds credibility with potential tenants.' },
  { icon: <Star className="h-5 w-5 text-violet-600" />, bg: 'bg-violet-50 dark:bg-violet-950/30', title: 'Higher Booking Rate', desc: 'Verified properties receive up to 3× more inquiries and bookings than unverified ones.' },
  { icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />, bg: 'bg-emerald-50 dark:bg-emerald-950/30', title: 'Priority Listing', desc: 'Verified landlords are ranked higher in search results and featured in curated home-hunting lists.' },
  { icon: <Award className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-50 dark:bg-blue-950/30', title: 'Premium Features', desc: 'Unlock access to premium analytics, AI-powered tenant matching, and advanced listing tools.' },
]

const REQUIREMENTS = [
  { step: '1', label: 'Organization Contacts', desc: 'Save your official email and phone number in Organization Settings. They must exactly match the documents you submit.' },
  { step: '2', label: 'Identity Document', desc: 'A clear photo or scan of a National ID, Business Registration Certificate, or Manager Authorization letter.' },
  { step: '3', label: 'Property Evidence', desc: 'A Property Deed, Lease Ownership document, or a recent Utility Bill showing your name and address.' },
  { step: '4', label: 'File Format', desc: 'Documents must be JPG, PNG, or PDF and no larger than 5 MB. Ensure all text is legible and corners are visible.' },
]

function displayStatus(status?: VerificationApiStatusValue): 'none' | 'pending' | 'rejected' | 'trusted' {
  if (status === 'approved') return 'trusted'
  return status ?? 'none'
}

function orgContactValue(org: Record<string, unknown> | null | undefined, keys: string[]): string {
  for (const key of keys) {
    const value = org?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function firstFieldError(err: unknown, field: string): string | undefined {
  if (!isApiError(err) || !err.errors || Array.isArray(err.errors)) return undefined
  const msgs = err.errors[field]
  return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : undefined
}

function verificationErrorTitle(err: unknown): string {
  if (!isApiError(err) || err.status !== 422) return 'Failed to submit verification'
  if (firstFieldError(err, 'document')) return 'Document not accepted'
  return 'Update organization settings first'
}

function verificationErrorMessage(err: unknown): string | unknown {
  if (!isApiError(err) || err.status !== 422) return err
  const docErr = firstFieldError(err, 'document')
  if (docErr) return docErr
  return 'The email or phone does not match the saved organization contact details. Save the correct contacts in organization settings first, then verify again.'
}

export default function Verification(): React.ReactElement {
  const [documentType, setDocumentType] = useState('national_id')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const { toasts, success, error: toastError, warning, dismiss } = useToast()
  const org = useAuthStore((state) => state.user?.org as Record<string, unknown> | null | undefined)
  const organizationEmail = orgContactValue(org, ['email', 'organization_email', 'org_email'])
  const organizationPhone = orgContactValue(org, ['phone', 'organization_phone', 'phone_number'])
  const { data: status, isLoading, refetch } = useLandlordVerificationStatus()
  const { mutate: submit, isPending } = useSubmitLandlordVerification()
  const phoneVerified = Boolean(status?.phone_verified)
  const emailVerified = Boolean(status?.email_verified)
  const contactsVerified = phoneVerified && emailVerified

  const handleVerifyContacts = () => {
    if (!organizationEmail || !organizationPhone) {
      warning('Organization contacts missing', 'Save the organization email and phone in settings first.')
      return
    }
    submit({ organization_email: organizationEmail, organization_phone: organizationPhone }, {
      onSuccess: () => { success('Organization contacts verified'); void refetch() },
      onError: (err) => toastError(verificationErrorMessage(err), verificationErrorTitle(err)),
    })
  }

  const handleSubmit = () => {
    if (!file) return
    setFileError(null)
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      setFileError('Unsupported file type. Please upload a JPG, JPEG, PNG, or PDF.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError('File is too large. Maximum size is 5 MB.')
      return
    }
    submit({ document_type: documentType, document: file, organization_email: organizationEmail, organization_phone: organizationPhone }, {
      onSuccess: () => { success('Document submitted for review'); setFile(null); setFileError(null); void refetch() },
      onError: (err) => {
        const docErr = firstFieldError(err, 'document')
        if (docErr) setFileError(docErr)
        toastError(verificationErrorMessage(err), verificationErrorTitle(err))
      },
    })
  }

  const submittedTypes = status?.submitted_types ?? []
  const trustedStatus = displayStatus(status?.trusted_status)
  const isTrusted = trustedStatus === 'trusted'

  return (
    <>
      <Helmet><title>Trusted Landlord Verification — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="p-6">
        <PageHeader
          title="Trusted Landlord Verification"
          subtitle="Earn the Trusted Landlord badge — more visibility, more bookings, more trust."
        />

        {/* Status stats */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Phone"
            value={phoneVerified ? 'Verified' : 'Not verified'}
            icon={phoneVerified ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <Phone className="h-4 w-4 text-blue-600" />}
            iconBg={phoneVerified ? 'bg-emerald-100' : 'bg-blue-100'}
            loading={isLoading}
          />
          <StatCard
            label="Email"
            value={emailVerified ? 'Verified' : 'Not verified'}
            icon={emailVerified ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <Mail className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-100"
            loading={isLoading}
          />
          <StatCard
            label="Trusted Badge"
            value={isTrusted || status?.badge_earned ? 'Trusted Landlord' : 'Not earned'}
            icon={<Award className="h-4 w-4 text-amber-600" />}
            iconBg="bg-amber-100"
            loading={isLoading}
          />
        </div>

        {/* Why verify */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-bold text-foreground">Why verify your property?</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_VERIFY.map((item) => (
              <div key={item.title} className={`flex flex-col gap-3 rounded-xl border border-border p-4 ${item.bg}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/80 shadow-sm dark:bg-black/20">
                  {item.icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What you need */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-bold text-foreground">What you need to verify</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REQUIREMENTS.map((req) => (
              <div key={req.step} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {req.step}
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">{req.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{req.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data security promise */}
        <div className="mb-6 overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <div className="flex items-start gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <Lock className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Our data security promise</p>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  'All uploaded documents are protected with end-to-end encryption during storage and transfer.',
                  'Your files are never shared with tenants, third parties, or other landlords.',
                  'Only the StayLynk verification team accesses your documents during review.',
                  'You can request deletion of your verification data at any time via support.',
                ].map((point) => (
                  <div key={point} className="flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Submission */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
          <SectionCard title="Verification Status">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Review status</span>
                <StatusBadge status={trustedStatus} />
              </div>
              {!contactsVerified && (
                <Button loading={isPending} onClick={handleVerifyContacts}>
                  Verify organization contacts
                </Button>
              )}
              {isTrusted && (
                <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  <Award className="h-3.5 w-3.5" /> Trusted Landlord
                </div>
              )}
              {status?.submitted_at && (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="text-foreground">{status.submitted_at}</span>
                </div>
              )}
              {status?.reviewed_at && (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Reviewed</span>
                  <span className="text-foreground">{status.reviewed_at}</span>
                </div>
              )}
              {status?.rejection_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {status.rejection_reason}
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Submitted documents</p>
                <div className="flex flex-wrap gap-2">
                  {submittedTypes.length ? submittedTypes.map((type) => (
                    <div key={type} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs text-foreground">
                      <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" aria-hidden />
                      <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                    </div>
                  )) : (
                    <span className="text-xs text-muted-foreground">No documents submitted.</span>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Submit Document">
            <div className="space-y-4">
              <FormField label="Document Type" htmlFor="doc-type" required>
                <Select id="doc-type" value={documentType} onChange={(e) => setDocumentType(e.target.value)} options={DOCUMENT_TYPES} disabled={isTrusted} />
              </FormField>
              <FormField
                label="Document File"
                htmlFor="doc-file"
                hint={fileError ? undefined : 'JPG, PNG, or PDF — maximum 5 MB. Ensure text is legible.'}
                required
                error={fileError ?? undefined}
              >
                <Input
                  id="doc-file"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  disabled={isTrusted}
                  className={fileError ? 'border-red-400 focus:ring-red-500/20' : undefined}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null)
                    setFileError(null)
                  }}
                />
              </FormField>
              <Button disabled={!file || isTrusted} loading={isPending} onClick={handleSubmit}>
                <FileUp className="h-3.5 w-3.5" /> {trustedStatus === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                By submitting, you confirm this document is authentic. False submissions may result in account suspension.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  )
}
