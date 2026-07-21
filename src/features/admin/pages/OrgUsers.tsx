import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus, Building2, Shield, User, Wrench } from 'lucide-react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/api/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QK } from '@/constants/queryKeys'
import { useAuthStore } from '@/store/auth.store'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select, Modal, Button, FormField, Input, ToastContainer } from '@/components/forms'
import { MediaUploadField, SmartImage } from '@/components/media'
import { entityIdFromResponse, mediaService } from '@/services/media'
import { PageHeader, StatusBadge } from '@/components/ui'
import { formatRelative } from '@/utils/format'
import { propertiesApi } from '@/api/properties'
import type { ApiError } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type StaffRole = 'manager' | 'caretaker' | 'worker'

type OrgUser = Record<string, unknown>

function formatSalary(v: unknown): string {
  const n = Number(v)
  return !v || isNaN(n) ? '—' : `KES ${n.toLocaleString()}/mo`
}

const PERMISSION_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'rooms.create',           label: 'Create rooms' },
  { key: 'rooms.update',           label: 'Update rooms' },
  { key: 'rooms.delete',           label: 'Delete rooms' },
  { key: 'rooms.beds',             label: 'Manage beds' },
  { key: 'rooms.status',           label: 'Change room status' },
  { key: 'rooms.invites',          label: 'Generate room invites' },
  { key: 'listings.manage',        label: 'Manage listings' },
  { key: 'listings.publish',       label: 'Publish / unpublish listing' },
  { key: 'property_videos.manage', label: 'Manage photos & videos' },
  { key: 'leases.record_payment',  label: 'Record tenant last payment' },
]

const WORKER_JOB_TITLES = [
  'Caretaker',
  'Security Guard',
  'Cleaner / Env. Cleaner',
  'Maintenance Technician',
  'Groundskeeper',
  'Receptionist',
  'Plumber',
  'Electrician',
  'Other',
]

type PermFlags = Record<string, boolean>
type PropertyPermMap = Record<string, PermFlags>

interface OrgProperty { id: string; name: string }

// ── Hooks ────────────────────────────────────────────────────────────────────

function useOrgUsers(params?: Record<string, unknown>) {
  const orgId = useAuthStore(s => s.user?.org?.id?.toString() ?? 'unknown')
  return useQuery({
    queryKey: QK.orgUsers(orgId, params),
    queryFn: () => apiGet<Record<string, unknown>>('/admin/org-users', params).then(r => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

function useAllOrgProperties() {
  const orgId = useAuthStore(s => s.user?.org?.id?.toString() ?? 'unknown')
  return useQuery({
    queryKey: ['admin', 'properties', 'options', orgId],
    queryFn: () => propertiesApi.options().then(r => {
      const d = r.data as OrgProperty[] | { data: OrgProperty[] }
      return Array.isArray(d) ? d : (d as { data: OrgProperty[] }).data ?? []
    }),
    staleTime: Infinity,
  })
}

function useCreateOrgUser() {
  const qc    = useQueryClient()
  const orgId = useAuthStore(s => s.user?.org?.id?.toString() ?? 'unknown')
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost<Record<string, unknown>>('/admin/org-users', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'org-users', orgId] }),
  })
}

function useUpdateOrgUser() {
  const qc    = useQueryClient()
  const orgId = useAuthStore(s => s.user?.org?.id?.toString() ?? 'unknown')
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiPatch<Record<string, unknown>>(`/admin/org-users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'org-users', orgId] }),
  })
}

function useDeleteOrgUser() {
  const qc    = useQueryClient()
  const orgId = useAuthStore(s => s.user?.org?.id?.toString() ?? 'unknown')
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/admin/org-users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'org-users', orgId] }),
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// New property assignments default to fully permitted — the admin's job is
// to uncheck what this manager should NOT be allowed to do, not to opt in to
// every capability one at a time.
function defaultPerms(): PermFlags {
  return PERMISSION_OPTIONS.reduce((a, p) => { a[p.key] = true; return a }, {} as PermFlags)
}

function normalisePerms(raw: unknown): PermFlags {
  const base = defaultPerms()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const r = raw as Record<string, unknown>
  PERMISSION_OPTIONS.forEach(p => {
    if (r[p.key] !== undefined) base[p.key] = Boolean(r[p.key])
  })
  return base
}

function extractUserPermMap(user: OrgUser): PropertyPermMap {
  const properties = (user.properties as Array<Record<string, unknown>>) ?? []
  return properties.reduce<PropertyPermMap>((acc, p) => {
    acc[String(p.id)] = normalisePerms(p.permissions)
    return acc
  }, {})
}

function buildSyncPayload(selectedIds: string[], perms: PropertyPermMap) {
  return {
    property_ids: selectedIds,
    property_permissions: selectedIds.reduce<Record<string, PermFlags>>((a, id) => {
      a[String(id)] = normalisePerms(perms[String(id)])
      return a
    }, {}),
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PropertyAssignmentEditor({
  allProperties,
  selectedIds,
  onToggle,
  permMap,
  onPermChange,
  showPerms = true,
}: {
  allProperties: OrgProperty[]
  selectedIds: string[]
  onToggle: (id: string) => void
  permMap: PropertyPermMap
  onPermChange: (id: string, key: string, val: boolean) => void
  showPerms?: boolean
}) {
  if (allProperties.length === 0) {
    return (
      <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
        No properties found. Create a property first.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {allProperties.map(property => {
        const pid    = String(property.id)
        const checked = selectedIds.includes(pid)
        const flags  = permMap[pid] ?? defaultPerms()

        return (
          <div key={pid} className={`rounded-lg border transition-colors ${checked ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'}`}>
            <label className="flex cursor-pointer items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(pid)}
                className="h-4 w-4 rounded border-border text-primary"
              />
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{property.name}</span>
            </label>

            {showPerms && checked && (
              <div className="border-t border-border/60 px-3 pb-3 pt-2">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Permissions</p>
                <div className="grid grid-cols-1 gap-1 xs:grid-cols-2 sm:grid-cols-3">
                  {PERMISSION_OPTIONS.map(perm => (
                    <label key={perm.key} className="flex items-center gap-1.5 rounded-md bg-background px-2 py-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(flags[perm.key])}
                        onChange={e => onPermChange(pid, perm.key, e.target.checked)}
                        className="h-3 w-3 rounded border-border text-primary"
                      />
                      <span className="text-muted-foreground">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  manager:   'text-blue-700 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40',
  caretaker: 'text-violet-700 bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/40',
  worker:    'text-amber-700 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40',
}

function RoleIcon({ role }: { role: string }) {
  if (role === 'manager') return <Shield className="h-3 w-3" />
  if (role === 'worker')  return <Wrench className="h-3 w-3" />
  return <User className="h-3 w-3" />
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgUsers(): React.ReactElement {
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [propFilter, setPropFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser,   setEditUser]   = useState<OrgUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrgUser | null>(null)

  // Photo upload
  const [profilePhotoFiles, setProfilePhotoFiles] = useState<File[]>([])
  const [mediaProgress, setMediaProgress] = useState<number | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)

  // ── Create form state ────────────────────────────────────────────────────
  const [cName,     setCName]     = useState('')
  const [cEmail,    setCEmail]    = useState('')
  const [cPhone,    setCPhone]    = useState('')
  const [cPassword, setCPassword] = useState('')
  const [cRole,     setCRole]     = useState<StaffRole>('manager')
  const [cJobTitle, setCJobTitle] = useState('')
  const [cSalary,   setCSalary]   = useState('')
  const [cSelIds,   setCSelIds]   = useState<string[]>([])
  const [cPermMap,  setCPermMap]  = useState<PropertyPermMap>({})

  // ── Edit form state ──────────────────────────────────────────────────────
  const [eName,    setEName]    = useState('')
  const [ePhone,   setEPhone]   = useState('')
  const [eRole,    setERole]    = useState<StaffRole>('manager')
  const [eJobTitle,setEJobTitle]= useState('')
  const [eSalary,  setESalary]  = useState('')
  const [eStatus,  setEStatus]  = useState('active')
  const [eSelIds,  setESelIds]  = useState<string[]>([])
  const [ePermMap, setEPermMap] = useState<PropertyPermMap>({})

  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()
  const currentUser = useAuthStore(s => s.user)
  const isManager = currentUser?.role === 'manager'

  const { data: usersData, isLoading, isError } = useOrgUsers({
    search:      debouncedSearch || undefined,
    role:        roleFilter || undefined,
    property_id: propFilter || undefined,
    page, per_page: perPage,
  })

  const { data: allProperties = [] } = useAllOrgProperties()

  const { mutate: createUser, isPending: creating } = useCreateOrgUser()
  const { mutate: updateUser, isPending: updating } = useUpdateOrgUser()
  const { mutate: deleteUser, isPending: deleting } = useDeleteOrgUser()

// Pre-fill edit form
  useEffect(() => {
    if (!editUser) return
    setEName(String(editUser.name ?? ''))
    setEPhone(String(editUser.phone ?? ''))
    setEJobTitle(String(editUser.job_title ?? ''))
    setESalary(editUser.monthly_salary != null ? String(editUser.monthly_salary) : '')
    setERole((editUser.role as StaffRole) ?? 'manager')
    setEStatus(String(editUser.status ?? 'active'))
    const props = (editUser.properties as Array<Record<string, unknown>>) ?? []
    setESelIds(props.map(p => String(p.id)))
    setEPermMap(extractUserPermMap(editUser))
  }, [editUser])

  const resetCreate = () => {
    setCName(''); setCEmail(''); setCPhone(''); setCPassword('')
    setCRole('manager'); setCJobTitle(''); setCSalary(''); setCSelIds([]); setCPermMap({})
    setProfilePhotoFiles([]); setMediaProgress(null)
  }

  const toggleCreateProp = (id: string) => {
    setCSelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setCPermMap(prev => prev[String(id)] ? prev : { ...prev, [String(id)]: defaultPerms() })
  }

  const toggleEditProp = (id: string) => {
    setESelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setEPermMap(prev => prev[String(id)] ? prev : { ...prev, [String(id)]: defaultPerms() })
  }

  const handleCreate = () => {
    if (!cName.trim() || !cEmail.trim() || !cPassword.trim()) {
      toastError('Name, email and password are required.', 'Validation error')
      return
    }
    if ((cRole === 'worker' || cRole === 'caretaker') && cSelIds.length === 0) {
      toastError('Assign at least one property for this staff member.', 'Validation error')
      return
    }

    const payload: Record<string, unknown> = {
      name:           cName.trim(),
      email:          cEmail.trim(),
      phone:          cPhone.trim() || undefined,
      job_title:      cJobTitle.trim() || undefined,
      monthly_salary: cSalary.trim() ? Number(cSalary) : undefined,
      password:       cPassword,
      role:           cRole,
      ...(cSelIds.length > 0 ? buildSyncPayload(cSelIds, cPermMap) : {}),
    }

    createUser(payload, {
      onSuccess: (response) => {
        const userId = entityIdFromResponse(response.data)
        void (async () => {
          try {
            setUploadingMedia(true)
            if (userId && profilePhotoFiles.length > 0) {
              await mediaService.uploadFilesForEntity({
                files: profilePhotoFiles,
                media_type: 'profile_photo',
                entity_type: 'profile',
                entity_id: userId,
                is_public: false,
                cover_index: 0,
                alt_text: `${cName} profile photo`,
              }, ({ progress }) => setMediaProgress(progress))
            }
            success('Staff member created successfully.')
            setCreateOpen(false)
            resetCreate()
          } catch {
            toastError('Staff created, but profile photo upload failed.')
          } finally {
            setUploadingMedia(false); setMediaProgress(null)
          }
        })()
      },
      onError: (err) => toastError(err, 'Failed to create staff member'),
    })
  }

  const handleUpdate = () => {
    if (!editUser) return
    if ((eRole === 'worker' || eRole === 'caretaker') && eSelIds.length === 0) {
      toastError('Assign at least one property.', 'Validation error')
      return
    }

    const payload: Record<string, unknown> = {
      name:           eName.trim(),
      phone:          ePhone.trim() || undefined,
      job_title:      eJobTitle.trim() || undefined,
      monthly_salary: eSalary.trim() ? Number(eSalary) : undefined,
      role:           eRole,
      status:         eStatus,
      ...buildSyncPayload(eSelIds, ePermMap),
    }

    updateUser({ id: editUser.id as number, data: payload }, {
      onSuccess: () => { success('Staff member updated.'); setEditUser(null) },
      onError: (err) => toastError(err, 'Failed to update'),
    })
  }

  const list = usersData as Record<string, unknown> | undefined
  const rows = (list?.data as OrgUser[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<OrgUser>[] = [
    {
      key: 'name', header: 'Staff Member',
      accessor: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {row.avatar_url ? (
              <SmartImage
                src={row.avatar_url as string}
                alt={String(row.name ?? 'User')}
                usage="card"
                aspectRatio="1 / 1"
                sizes="32px"
                wrapperClassName="h-8 w-8 rounded-full"
                className="rounded-full object-cover"
              />
            ) : (
              String(row.name ?? '?')[0].toUpperCase()
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">{row.name as string}</p>
            <p className="text-xs text-muted-foreground">{row.email as string}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role', header: 'Role',
      accessor: (row) => {
        const r = row.role as string
        const jt = row.job_title as string | undefined
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize w-fit ${ROLE_BADGE[r] ?? 'bg-muted text-foreground border-border'}`}>
              <RoleIcon role={r} />
              {r}
            </span>
            {jt && <span className="text-[10px] text-muted-foreground pl-1">{jt}</span>}
          </div>
        )
      },
    },
    {
      key: 'properties', header: 'Assigned Properties',
      accessor: (row) => {
        const role = row.role as string
        const properties = (row.properties as Array<Record<string, unknown>>) ?? []
        if (role === 'manager' && !properties.length) {
          return <span className="text-xs text-muted-foreground italic">All properties</span>
        }
        if (!properties.length) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {properties.map(p => (
              <span key={String(p.id)} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                <Building2 className="h-2.5 w-2.5" />
                {String(p.name ?? '')}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'phone', header: 'Phone',
      accessor: (row) => {
        const phone = row.phone as string | undefined
        const role  = row.role as string
        return (
          <div>
            <span className="text-xs text-muted-foreground">{phone || '—'}</span>
            {role === 'manager' && phone && (
              <p className="text-[10px] text-emerald-500 font-medium">WhatsApp</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'monthly_salary', header: 'Monthly Salary',
      accessor: (row) => (
        <span className="text-xs font-semibold text-foreground">{formatSalary(row.monthly_salary)}</span>
      ),
    },
    { key: 'status', header: 'Status', accessor: (row) => <StatusBadge status={row.status as string} /> },
    {
      key: 'last_login_at', header: 'Last Login',
      accessor: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.last_login_at ? formatRelative(row.last_login_at as string) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions', header: '', width: 'w-32',
      accessor: (row) => (
        <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setEditUser(row)}
            className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      ),
    },
  ]

  const propFilterOptions = [
    { value: '', label: 'All properties' },
    ...allProperties.map(p => ({ value: String(p.id), label: p.name })),
  ]

  const roleLabel = (r: StaffRole) => {
    if (r === 'manager')   return 'Manager'
    if (r === 'caretaker') return 'Caretaker'
    return 'Worker'
  }

  return (
    <>
      <Helmet><title>Staff Management — RockyRent</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="p-6">
        <PageHeader
          title="Staff Management"
          subtitle="Manage managers, caretakers, and workers across your properties. Manager phone numbers are used as WhatsApp contacts for public listings."
          actions={
            !isManager ? (
              <Button onClick={() => { resetCreate(); setCreateOpen(true) }}>
                <Plus className="h-3.5 w-3.5" /> Add Staff
              </Button>
            ) : undefined
          }
        />

        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, or job title…" className="w-64" />
          <Select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
            placeholder="All roles"
            className="w-36 text-xs"
            options={[
              { value: '',          label: 'All roles'   },
              { value: 'manager',   label: 'Manager'     },
              { value: 'caretaker', label: 'Caretaker'   },
              { value: 'worker',    label: 'Worker'      },
            ]}
          />
          <Select
            value={propFilter}
            onChange={e => { setPropFilter(e.target.value); setPage(1) }}
            placeholder="All properties"
            className="w-44 text-xs"
            options={propFilterOptions}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={isLoading}
          error={isError ? 'Failed to load staff.' : null}
          emptyTitle="No staff members found"
          emptyDescription={allProperties.length === 0
            ? 'Create a property first, then add staff.'
            : 'Add your first staff member using the button above.'}
          pagination={meta}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          caption="Staff members"
        />
      </div>

      {/* ── Create Staff Modal ── */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); resetCreate() }}
        title="Add Staff Member"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreate() }}>Cancel</Button>
            <Button loading={creating || uploadingMedia} onClick={handleCreate}>
              Add {roleLabel(cRole)}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Full Name" htmlFor="c-name" required>
            <Input id="c-name" placeholder="Jane Doe" value={cName} onChange={e => setCName(e.target.value)} />
          </FormField>
          <FormField label="Email" htmlFor="c-email" required>
            <Input id="c-email" type="email" placeholder="jane@hostel.com" value={cEmail} onChange={e => setCEmail(e.target.value)} />
          </FormField>
          <FormField label="Phone" htmlFor="c-phone" hint={cRole === 'manager' ? 'Used as WhatsApp contact on public listings' : undefined}>
            <Input id="c-phone" placeholder="+254700000000" value={cPhone} onChange={e => setCPhone(e.target.value)} />
          </FormField>
          <FormField label="Role" htmlFor="c-role" required>
            <Select
              id="c-role"
              value={cRole}
              onChange={e => { setCRole(e.target.value as StaffRole); setCJobTitle('') }}
              options={[
                { value: 'manager',   label: 'Manager — oversees property' },
                { value: 'caretaker', label: 'Caretaker — daily operations' },
                { value: 'worker',    label: 'Worker — specific task/role' },
              ]}
            />
          </FormField>

          {/* Job title — shown for non-managers */}
          {(cRole === 'worker' || cRole === 'caretaker') && (
            <FormField label="Job Title" htmlFor="c-jobtitle" hint="e.g. Security Guard, Cleaner">
              <Select
                id="c-jobtitle"
                value={cJobTitle}
                onChange={e => setCJobTitle(e.target.value)}
                options={[
                  { value: '', label: 'Select or type below…' },
                  ...WORKER_JOB_TITLES.map(t => ({ value: t, label: t })),
                ]}
              />
            </FormField>
          )}

          <FormField label="Monthly Salary (KES)" htmlFor="c-salary" hint="Optional — included in monthly expense reports">
            <Input
              id="c-salary"
              type="number"
              min="0"
              placeholder="e.g. 25000"
              value={cSalary}
              onChange={e => setCSalary(e.target.value)}
            />
          </FormField>

          <FormField label="Password" htmlFor="c-pass" required className="col-span-2">
            <Input
              id="c-pass"
              type="password"
              placeholder="Min 8 characters, mixed case & numbers"
              value={cPassword}
              onChange={e => setCPassword(e.target.value)}
            />
          </FormField>

          <div className="col-span-2">
            <FormField
              label={cRole === 'manager' ? 'Property Access (optional)' : 'Assign to Property'}
              hint={cRole === 'manager'
                ? 'Managers have org-wide access. Optionally restrict to specific properties.'
                : 'Select the property this staff member is assigned to.'}
              required={cRole !== 'manager'}
            >
              <PropertyAssignmentEditor
                allProperties={allProperties}
                selectedIds={cSelIds}
                onToggle={toggleCreateProp}
                permMap={cPermMap}
                onPermChange={(id, key, val) =>
                  setCPermMap(prev => ({
                    ...prev,
                    [String(id)]: { ...(prev[String(id)] ?? defaultPerms()), [key]: val },
                  }))
                }
                showPerms={cRole === 'manager'}
              />
            </FormField>
          </div>

          <div className="col-span-2">
            <MediaUploadField
              label="Profile Photo (optional)"
              mediaType="profile_photo"
              files={profilePhotoFiles}
              onChange={setProfilePhotoFiles}
              hint="PNG, JPG, or WebP up to 2MB."
              progress={uploadingMedia ? mediaProgress : null}
            />
          </div>
        </div>
      </Modal>

      {/* ── Edit Staff Modal ── */}
      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title={`Edit — ${String(editUser?.name ?? '')}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button loading={updating} onClick={handleUpdate}>Save Changes</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Full Name" htmlFor="e-name" required>
            <Input id="e-name" value={eName} onChange={e => setEName(e.target.value)} />
          </FormField>
          <FormField label="Phone" htmlFor="e-phone" hint={eRole === 'manager' ? 'Used as WhatsApp contact on public listings' : undefined}>
            <Input id="e-phone" value={ePhone} onChange={e => setEPhone(e.target.value)} />
          </FormField>
          <FormField label="Role" htmlFor="e-role">
            <Select
              id="e-role"
              value={eRole}
              onChange={e => { setERole(e.target.value as StaffRole); setEJobTitle('') }}
              options={[
                { value: 'manager',   label: 'Manager' },
                { value: 'caretaker', label: 'Caretaker' },
                { value: 'worker',    label: 'Worker' },
              ]}
            />
          </FormField>
          <FormField label="Status" htmlFor="e-status">
            <Select
              id="e-status"
              value={eStatus}
              onChange={e => setEStatus(e.target.value)}
              options={[
                { value: 'active',    label: 'Active' },
                { value: 'inactive',  label: 'Inactive' },
                { value: 'suspended', label: 'Suspended' },
              ]}
            />
          </FormField>

          {/* Job title — shown for non-managers */}
          {(eRole === 'worker' || eRole === 'caretaker') && (
            <FormField label="Job Title" htmlFor="e-jobtitle">
              <Select
                id="e-jobtitle"
                value={eJobTitle}
                onChange={e => setEJobTitle(e.target.value)}
                options={[
                  { value: '', label: 'Select job title…' },
                  ...WORKER_JOB_TITLES.map(t => ({ value: t, label: t })),
                ]}
              />
            </FormField>
          )}

          <FormField label="Monthly Salary (KES)" htmlFor="e-salary" hint="Used in monthly expense reports">
            <Input
              id="e-salary"
              type="number"
              min="0"
              placeholder="e.g. 25000"
              value={eSalary}
              onChange={e => setESalary(e.target.value)}
            />
          </FormField>

          <div className="col-span-2">
            <FormField
              label={eRole === 'manager' ? 'Property Access (optional)' : 'Assigned Property'}
              hint={eRole === 'manager' ? 'Managers have org-wide access.' : 'Assign to a property.'}
              required={eRole !== 'manager'}
            >
              <PropertyAssignmentEditor
                allProperties={allProperties}
                selectedIds={eSelIds}
                onToggle={toggleEditProp}
                permMap={ePermMap}
                onPermChange={(id, key, val) =>
                  setEPermMap(prev => ({
                    ...prev,
                    [String(id)]: { ...(prev[String(id)] ?? defaultPerms()), [key]: val },
                  }))
                }
                showPerms={eRole === 'manager'}
              />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirm ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete staff member?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              loading={deleting}
              className="bg-red-500 hover:bg-red-600"
              onClick={() =>
                deleteTarget &&
                deleteUser(deleteTarget.id as number, {
                  onSuccess: () => { success('Staff member deleted.'); setDeleteTarget(null) },
                  onError: (err) => toastError(err, 'Failed to delete'),
                })
              }
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{String(deleteTarget?.name ?? '')}</strong> will be permanently removed and will lose access immediately. This cannot be undone.
        </p>
      </Modal>
    </>
  )
}
