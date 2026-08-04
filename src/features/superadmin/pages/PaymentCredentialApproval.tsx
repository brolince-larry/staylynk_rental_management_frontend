import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, ShieldAlert, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/forms'
import { paymentCredentialsApi } from '@/api/paymentCredentials'
import { isApiError } from '@/utils/errors'

export default function PaymentCredentialApprovalPage(): React.ReactElement {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const [approved, setApproved] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['payment-credential-approval', token],
    queryFn: () => paymentCredentialsApi.getApproval(token as string).then((r) => r.data),
    enabled: !!token,
    retry: false,
  })

  const approveMutation = useMutation({
    mutationFn: () => paymentCredentialsApi.approveCredential(token as string),
    onSuccess: () => {
      setApproved(true)
      queryClient.invalidateQueries({ queryKey: ['payment-credentials'] })
    },
  })

  const errorMessage = isApiError(error) ? error.message : 'This approval request could not be loaded.'
  const approveErrorMessage = isApiError(approveMutation.error)
    ? approveMutation.error.message
    : 'Approval failed. Please try again.'

  return (
    <>
      <Helmet><title>Approve Payment Credential | StayLynk</title></Helmet>
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center p-6">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Loading approval request…</p>
          </div>
        ) : isError || !data ? (
          <div className="w-full rounded-xl border border-border bg-card p-6 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-red-500" />
            <h1 className="mt-3 text-lg font-semibold text-foreground">Unable to load request</h1>
            <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
            <Link to="/superadmin/payment-credentials" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to Payment Credentials
            </Link>
          </div>
        ) : approved || approveMutation.isSuccess ? (
          <div className="w-full rounded-xl border border-border bg-card p-6 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500" />
            <h1 className="mt-3 text-lg font-semibold text-foreground">Credential approved</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The payment credential has been {data.action === 'create' ? 'created' : 'updated'} and is now active.
            </p>
            <Link to="/superadmin/payment-credentials" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to Payment Credentials
            </Link>
          </div>
        ) : (
          <div className="w-full rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
              <span className="text-sm font-semibold">Approval required</span>
            </div>
            <h1 className="mt-2 text-lg font-semibold text-foreground">
              {data.action === 'create' ? 'New payment credential' : 'Payment credential update'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review the details below carefully before approving. This action takes effect immediately.
            </p>

            <dl className="mt-4 space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="font-medium text-foreground">{data.provider ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Display name</dt>
                <dd className="font-medium text-foreground">{data.display_name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Environment</dt>
                <dd className="font-medium text-foreground">{data.environment ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Requested by</dt>
                <dd className="font-medium text-foreground">{data.requested_by ?? '—'}</dd>
              </div>
            </dl>

            {approveMutation.isError && (
              <p className="mt-3 text-sm text-red-500">{approveErrorMessage}</p>
            )}

            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="mt-5 w-full"
            >
              {approveMutation.isPending ? 'Approving…' : 'Approve credential'}
            </Button>

            <Link to="/superadmin/payment-credentials" className="mt-3 block text-center text-sm text-muted-foreground hover:underline">
              Cancel
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
