// src/features/superadmin/pages/Permissions.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/api/client'
import { PageHeader, SectionCard } from '@/components/ui'
import { Button, ToastContainer } from '@/components/forms'
import { useToast } from '@/hooks'
import {
  Shield, LayoutDashboard, Users, Home, Globe2,
  Sparkles, Search, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react'

type FeatureFlag = {
  id: number
  key: string
  name: string
  description: string
  is_enabled: boolean
  maintenance_message: string | null
}

const FEATURE_ICONS: Record<string, React.ElementType> = {
  admin_panel:      LayoutDashboard,
  manager_panel:    Users,
  tenant_portal:    Home,
  public_listings:  Globe2,
  ai_assistant:     Sparkles,
  house_hunter:     Search,
}

const SECTION_LABELS: Record<string, string> = {
  admin_panel:      'Admin Panel',
  manager_panel:    'Manager Panel',
  tenant_portal:    'Tenant Portal',
  public_listings:  'Public Listings',
  ai_assistant:     'AI Assistant',
  house_hunter:     'House Hunter',
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        enabled ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function Permissions(): React.ReactElement {
  const qc = useQueryClient()
  const { toasts, success, error: toastError, dismiss } = useToast()
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editMsg, setEditMsg] = useState('')

  const { data: flags, isLoading } = useQuery({
    queryKey: ['sa-feature-flags'],
    queryFn: () => apiGet<FeatureFlag[]>('/superadmin/feature-flags').then(r => r.data ?? []),
  })

  const { mutate: updateFlag, isPending } = useMutation({
    mutationFn: ({ key, payload }: { key: string; payload: { is_enabled: boolean; maintenance_message?: string } }) =>
      apiPatch(`/superadmin/feature-flags/${key}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-feature-flags'] })
      success('Feature flag updated.')
      setEditKey(null)
    },
    onError: (err) => toastError(err, 'Failed to update flag'),
  })

  function handleToggle(flag: FeatureFlag) {
    updateFlag({
      key: flag.key,
      payload: {
        is_enabled: !flag.is_enabled,
        maintenance_message: flag.maintenance_message ?? undefined,
      },
    })
  }

  function openEdit(flag: FeatureFlag) {
    setEditKey(flag.key)
    setEditMsg(flag.maintenance_message ?? '')
  }

  function saveMessage(flag: FeatureFlag) {
    updateFlag({
      key: flag.key,
      payload: { is_enabled: flag.is_enabled, maintenance_message: editMsg },
    })
  }

  const list = flags as FeatureFlag[] | undefined

  return (
    <>
      <Helmet><title>Permissions & Feature Flags</title></Helmet>
      <div className="space-y-6">
        <PageHeader
          title="Permissions & Feature Flags"
          subtitle="Enable or disable route groups system-wide. Disabled services show a maintenance message to users."
          icon={Shield}
        />

        <SectionCard title="Route Group Controls">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading flags…</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {list?.map((flag) => {
                const Icon = FEATURE_ICONS[flag.key] ?? Shield
                const isEditing = editKey === flag.key
                return (
                  <div key={flag.key} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-4">
                      <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                        flag.is_enabled ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-semibold text-gray-900">
                            {SECTION_LABELS[flag.key] ?? flag.name}
                          </span>
                          {flag.is_enabled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              <XCircle className="h-3 w-3" /> Maintenance
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-gray-500">{flag.description}</p>
                        <p className="mt-0.5 font-mono text-xs text-gray-400">key: {flag.key}</p>

                        {!flag.is_enabled && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span>
                              {flag.maintenance_message || 'This service is currently under maintenance. Please try again later.'}
                            </span>
                          </div>
                        )}

                        {isEditing && (
                          <div className="mt-3 space-y-2">
                            <label className="text-xs font-medium text-gray-600">Maintenance message shown to users</label>
                            <textarea
                              rows={2}
                              value={editMsg}
                              onChange={e => setEditMsg(e.target.value)}
                              placeholder="This service is currently under maintenance. Please try again later."
                              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveMessage(flag)}
                                disabled={isPending}
                              >
                                Save Message
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditKey(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-shrink-0 flex-col items-end gap-2 pt-0.5">
                        <ToggleSwitch
                          enabled={flag.is_enabled}
                          onChange={() => handleToggle(flag)}
                        />
                        <button
                          type="button"
                          onClick={() => isEditing ? setEditKey(null) : openEdit(flag)}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          {isEditing ? 'Close' : 'Edit message'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="How it works">
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              <span>Disabling a route group makes all API calls within that group return a 503 maintenance response.</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              <span>Users are shown the maintenance message and can still access other parts of the system.</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              <span>Changes take effect within 2 minutes as the flag is cached server-side.</span>
            </li>
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <span>Super Admin routes are never affected — you will always retain full access.</span>
            </li>
          </ul>
        </SectionCard>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
