import React, { useMemo, useState } from 'react'
import { Building2, Loader2, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { propertiesApi } from '@/api/properties'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/auth.store'
import { useQuery } from '@tanstack/react-query'

type PropertyRow = Record<string, unknown>

export function PropertySwitcher({ role = 'admin' }: { role?: 'admin' | 'manager' }): React.ReactElement {
  const user              = useAuthStore((s) => s.user)
  const token             = useAuthStore((s) => s.token)
  const setAuth           = useAuthStore((s) => s.setAuth)
  const setUser           = useAuthStore((s) => s.setUser)
  const setCurrentProperty = useAuthStore((s) => s.setCurrentProperty)
  const qc       = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [switching, setSwitching] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: [role, 'properties', 'options'],
    queryFn: () => (
      role === 'manager'
        ? propertiesApi.managerOptions()
        : propertiesApi.options()
    ).then((r) => r.data),
    staleTime: Infinity,
  })

  const properties = useMemo(() => optionRows(data), [data])
  const currentId  = user?.current_property?.id ? String(user.current_property.id) : ''

  const selectedName = useMemo(() => {
    const found = properties.find((p) => String(p.id) === currentId)
    return String(found?.name ?? user?.current_property?.name ?? '')
  }, [currentId, properties, user?.current_property?.name])

  const addProperty = () => navigate(`/${role}/properties?create=1`)

  const switchProperty = async (propertyId: string) => {
    const id = Number(propertyId)
    if (!Number.isFinite(id) || id <= 0 || propertyId === currentId) return
    setSwitching(true)
    try {
      const found = properties.find((p) => Number(p.id) === id)
      const uuid  = String(found?.uuid ?? '')
      if (!uuid) return

      await (role === 'manager'
        ? propertiesApi.managerSetCurrent(uuid)
        : propertiesApi.setCurrent(uuid))

      if (found) {
        setCurrentProperty({
          id,
          uuid,
          name: String(found.name ?? ''),
          slug: String(found.slug ?? ''),
        })
      }

      const me = await authApi.me()
      if (me.data) {
        if (token) setAuth(token, me.data)
        else setUser(me.data)
      }

      // Invalidate everything — the current property context changes all queries
      await qc.invalidateQueries()

      if (
        location.pathname === `/${role}` ||
        location.pathname === `/${role}/dashboard`
      ) {
        navigate(`/${role}/dashboard`, { replace: true })
      }
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-[hsl(var(--input-surface))] px-2 py-2 text-xs shadow-sm transition-colors hover:bg-muted sm:px-3 md:min-w-[13rem]">
      <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="hidden shrink-0 text-muted-foreground sm:inline">Property:</span>
      {isLoading ? (
        <span className="text-xs text-muted-foreground">…</span>
      ) : properties.length > 1 ? (
        <select
          value={currentId}
          onChange={(e) => void switchProperty(e.target.value)}
          disabled={switching}
          title={selectedName ? `Property: ${selectedName}` : 'Select property'}
          className="max-w-[7rem] min-w-0 cursor-pointer bg-transparent text-xs font-semibold text-foreground outline-none disabled:opacity-60 sm:max-w-none sm:flex-1"
        >
          <option value="" className="bg-[hsl(var(--input-surface))] text-foreground">
            Select property
          </option>
          {properties.map((p) => (
            <option
              key={String(p.id)}
              value={String(p.id)}
              className="bg-[hsl(var(--input-surface))] text-foreground"
            >
              {String(p.name ?? 'Unnamed property')}
            </option>
          ))}
        </select>
      ) : (
        <span className="max-w-[7rem] truncate font-semibold text-foreground sm:max-w-none sm:flex-1">
          {selectedName || 'No property'}
        </span>
      )}
      {switching && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
      {role === 'admin' && !switching && (
        <button
          type="button"
          onClick={addProperty}
          title="Add new property"
          className="ml-0.5 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function optionRows(value: unknown): PropertyRow[] {
  if (Array.isArray(value)) return value as PropertyRow[]
  const data = (value as { data?: unknown } | undefined)?.data
  return Array.isArray(data) ? (data as PropertyRow[]) : []
}
