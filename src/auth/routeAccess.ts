import type { AuthUser, Role } from '@/types'

const ROLE_ALIASES: Record<string, Role> = {
  superadmin: 'superadmin',
  super_admin: 'superadmin',
  'super-admin': 'superadmin',
  admin: 'admin',
  manager: 'manager',
  tenant: 'tenant',
}

const DASHBOARD_BY_ROLE: Record<Role, string> = {
  superadmin: '/superadmin/dashboard',
  admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  tenant: '/tenant/dashboard',
}

const FRONTEND_PREFIXES = ['/superadmin', '/admin', '/manager', '/tenant']

export function normalizeRole(role: string): Role {
  return ROLE_ALIASES[role.toLowerCase()] ?? 'tenant'
}

export function dashboardForRole(role: Role): string {
  return DASHBOARD_BY_ROLE[role]
}

export function normalizeDashboardPath(user: Pick<AuthUser, 'role'> & { dashboard?: string | null }): string {
  const role = normalizeRole(user.role)
  const fallback = dashboardForRole(role)
  const rawDashboard = user.dashboard?.trim()

  if (!rawDashboard) return fallback

  let path = rawDashboard

  try {
    path = new URL(rawDashboard, window.location.origin).pathname
  } catch {
    path = rawDashboard
  }

  path = path
    .replace(/^\/api\/v\d+/i, '')
    .replace(/^\/app/i, '')

  if (!path.startsWith('/')) path = `/${path}`
  if (path === '/dashboard' || path === `/${role}`) return fallback
  if (FRONTEND_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return path

  return fallback
}

export function normalizeAuthUser(user: AuthUser): AuthUser {
  const role = normalizeRole(user.role)

  return {
    ...user,
    role,
    dashboard: normalizeDashboardPath({ ...user, role }),
  }
}

export function canAccessRole(userRole: Role, requiredRole: Role): boolean {
  if (userRole === requiredRole) return true
  return requiredRole === 'manager' && userRole === 'admin'
}
