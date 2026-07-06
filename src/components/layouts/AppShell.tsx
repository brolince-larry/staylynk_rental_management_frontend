// src/components/layouts/AppShell.tsx
import React, { useMemo, type ReactNode } from 'react'
import { AIReminderToast } from '@/components/ai/AIReminderToast'
import { NavLink, useLocation } from 'react-router-dom'
import {
  type LucideIcon,
  ChevronLeft,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Menu,
  Search,
  Sparkles,
} from 'lucide-react'
import { NotificationPanel } from './NotificationPanel'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/providers/AuthProvider'
import { SmartImage } from '@/components/media'
import type { Role } from '@/types'
import appLogo from '@/assets/logo.svg'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string | number
  section?: string
}

interface AppShellProps {
  children: ReactNode
  navItems: NavItem[]
  role: Role
  logoLabel: string
  logoSub: string
  topbarSlot?: ReactNode
}

const ROLE_GRADIENT: Record<Role, string> = {
  superadmin: 'from-violet-700 to-indigo-600',
  admin:      'from-violet-600 to-fuchsia-600',
  manager:    'from-indigo-600 to-violet-600',
  tenant:     'from-emerald-500 to-teal-500',
}

const SIDEBAR_WIDTH   = 'w-[16.5rem]'
const SIDEBAR_MARGIN  = 'lg:ml-[16.5rem]'
const IS_DARK_SIDEBAR = (role: Role) => role === 'superadmin'

export function AppShell({
  children,
  navItems,
  role,
  logoLabel,
  logoSub,
  topbarSlot,
}: AppShellProps): React.ReactElement {
  const {
    sidebarOpen,
    sidebarCollapsed,
    setSidebarOpen,
    toggleSidebarCollapsed,
    theme,
    setTheme,
  } = useUIStore()

  const user   = useAuthStore((s) => s.user)
  const logout = useLogout()
  const location = useLocation()

  const darkSidebar = IS_DARK_SIDEBAR(role)

  // ── User display ──────────────────────────────────────────────────
  const userName = typeof user?.name === 'string' && user.name.trim().length > 0
    ? user.name.trim()
    : 'User'
  const userInitial = userName.charAt(0).toUpperCase()

  const userRecord  = user as (Record<string, unknown> & { media?: unknown }) | null
  const userMedia   = (userRecord?.avatar_image ?? userRecord?.media) as Record<string, unknown> | undefined
  const userAvatar  = userRecord?.avatar_url as string | undefined
  const orgRecord   = user?.org as (Record<string, unknown> & { media?: unknown }) | null | undefined
  const orgLogo     = (orgRecord?.logo_image ?? orgRecord?.media) as Record<string, unknown> | undefined
  const orgLogoUrl  = orgRecord?.logo_url as string | undefined

  const avatarNode = userMedia || userAvatar ? (
    <SmartImage
      src={userMedia ?? userAvatar}
      fallback={userAvatar}
      alt={`${userName} profile photo`}
      usage="card"
      aspectRatio="1 / 1"
      sizes="28px"
      wrapperClassName="h-full w-full rounded-full"
      className="rounded-full object-cover"
    />
  ) : (
    <span className="text-[0.7rem] font-semibold text-primary">{userInitial}</span>
  )

  // ── Grouped nav sections ──────────────────────────────────────────
  const sections = useMemo(
    () => navItems.reduce<Record<string, NavItem[]>>((acc, item) => {
      const key = item.section ?? '__default'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {}),
    [navItems],
  )

  // ── Sidebar style tokens (dark vs light) ──────────────────────────
  const sidebar = {
    surface:   darkSidebar
      ? 'bg-[hsl(222,47%,5%)] border-white/[0.07] text-slate-100'
      : 'bg-card border-border text-foreground',
    divider:   darkSidebar ? 'border-white/[0.07]' : 'border-border',
    sectionLabelColor: darkSidebar ? 'text-white/25' : 'text-muted-foreground/40',
    sectionLineColor:  darkSidebar ? 'bg-white/[0.06]' : 'bg-border',
    navActive: darkSidebar
      ? 'bg-white/[0.09] text-white font-medium'
      : 'bg-primary/[0.08] text-primary font-semibold',
    navInactive: darkSidebar
      ? 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    footerMuted: darkSidebar
      ? 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    userCard: darkSidebar
      ? 'bg-white/[0.05] border-white/[0.07]'
      : 'bg-muted/60 border-border',
    userText:  darkSidebar ? 'text-white'       : 'text-foreground',
    userMuted: darkSidebar ? 'text-slate-400'   : 'text-muted-foreground',
  }


  return (
    <>
    <div className="app-gradient-soft flex h-screen min-h-screen w-full overflow-hidden font-sans">
      {/* ── Mobile overlay ──────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r transition-all duration-300 ease-out',
          sidebar.surface,
          sidebarCollapsed ? 'w-16' : SIDEBAR_WIDTH,
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className={[
          'flex h-[3.75rem] shrink-0 items-center gap-3 border-b px-4',
          sidebar.divider,
          sidebarCollapsed ? 'justify-center' : '',
        ].join(' ')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            {orgLogo || orgLogoUrl ? (
              <SmartImage
                src={orgLogo ?? orgLogoUrl}
                fallback={orgLogoUrl}
                alt={`${logoLabel} logo`}
                usage="card"
                aspectRatio="1 / 1"
                sizes="30px"
                wrapperClassName="h-8 w-8 rounded-lg"
                className="rounded-lg object-cover"
              />
            ) : (
              <img src={appLogo} alt="StayLynk" className="h-8 w-8 object-contain" />
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className={['truncate text-[0.95rem] font-bold leading-tight', sidebar.userText].join(' ')}>
                {logoLabel}
              </p>
              <p className={['truncate text-[0.68rem]', sidebar.userMuted].join(' ')}>
                {logoSub}
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto px-2.5 py-3"
          aria-label="Sidebar navigation"
        >
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              {/* Section divider label */}
              {section !== '__default' && !sidebarCollapsed && (
                <div className="flex items-center gap-2 px-1 pb-1 pt-4 first:pt-1">
                  <div className={['h-px flex-1', sidebar.sectionLineColor].join(' ')} />
                  <span className={[
                    'shrink-0 text-[0.6rem] font-bold uppercase tracking-widest',
                    sidebar.sectionLabelColor,
                  ].join(' ')}>
                    {section}
                  </span>
                </div>
              )}

              <div className="space-y-0.5">
                {items.map((item, idx) => {
                  const Icon = item.icon
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== `/${role}/dashboard` &&
                      item.href !== `/${role}/system` &&
                      location.pathname.startsWith(item.href))

                  return (
                    <NavLink
                      key={`${section}-${item.href}-${idx}`}
                      to={item.href}
                      title={sidebarCollapsed ? item.label : undefined}
                      onClick={() => setSidebarOpen(false)}
                      className={[
                        'flex min-h-[2.25rem] items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.88rem] transition-colors duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive ? sidebar.navActive : sidebar.navInactive,
                        sidebarCollapsed ? 'justify-center' : '',
                      ].join(' ')}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-[1.0625rem] w-[1.0625rem] shrink-0" aria-hidden />
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge !== undefined && (
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[0.68rem] font-semibold text-primary">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={['shrink-0 space-y-1 border-t p-2.5', sidebar.divider].join(' ')}>
          {/* User card */}
          {!sidebarCollapsed && user && (
            <div className={[
              'mb-2 flex items-center gap-2.5 rounded-lg border px-3 py-2.5',
              sidebar.userCard,
            ].join(' ')}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                {avatarNode}
              </div>
              <div className="min-w-0 flex-1">
                <p className={['truncate text-[0.8rem] font-semibold leading-tight', sidebar.userText].join(' ')}>
                  {userName}
                </p>
                <p className={['truncate text-[0.68rem] capitalize', sidebar.userMuted].join(' ')}>
                  {user.role}
                </p>
              </div>
            </div>
          )}

          {/* Collapse toggle (desktop only) */}
          <button
            onClick={toggleSidebarCollapsed}
            className={[
              'hidden w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.82rem] transition-colors duration-150 lg:flex',
              sidebar.footerMuted,
              sidebarCollapsed ? 'justify-center' : '',
            ].join(' ')}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              className={['h-4 w-4 shrink-0 transition-transform', sidebarCollapsed ? 'rotate-180' : ''].join(' ')}
            />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>

          {/* Sign out */}
          <button
            onClick={() => void logout()}
            className={[
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.82rem] transition-colors duration-150',
              darkSidebar
                ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-300'
                : 'text-muted-foreground hover:bg-destructive/8 hover:text-destructive',
              sidebarCollapsed ? 'justify-center' : '',
            ].join(' ')}
            title="Sign out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className={[
        'flex min-w-0 flex-1 flex-col transition-all duration-300',
        sidebarCollapsed ? 'lg:ml-16' : SIDEBAR_MARGIN,
      ].join(' ')}>

        {/* Topbar */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur-sm sm:gap-3 sm:px-5">
          {/* Mobile menu */}
          <button
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search — hidden on small screens, grows but caps on large */}
          <div className="hidden min-w-0 flex-1 md:block md:max-w-[220px] lg:max-w-sm xl:max-w-md">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search…"
                className="h-9 w-full rounded-lg border border-border bg-muted/50 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary/30 focus:bg-card focus:ring-2 focus:ring-primary/10 xl:pr-10"
              />
              <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-0.5 text-[0.63rem] font-medium text-muted-foreground xl:flex">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Right controls — shrink-0 keeps them from wrapping */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            {/* Slot (PropertySwitcher + KnowledgeWidget etc.) */}
            {topbarSlot && (
              <div className="flex shrink-0 items-center gap-1 border-r border-border pr-1 sm:pr-2 mr-0.5">
                {topbarSlot}
              </div>
            )}

            {/* AI Assistant shortcut */}
            <NavLink
              to={`/${role}/ai`}
              aria-label="AI Assistant"
              className={({ isActive }) =>
                `relative rounded-lg p-2 transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <Sparkles className="h-4 w-4" />
            </NavLink>

            {/* Notifications */}
            <NotificationPanel role={role} />

            {/* Theme toggle — hidden on xs */}
            <button
              onClick={() =>
                setTheme(
                  theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light',
                )
              }
              className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="h-4 w-4" />
              ) : theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </button>

            {/* User avatar + name */}
            {user && (
              <div className="ml-0.5 flex items-center gap-2 border-l border-border pl-2 sm:gap-2.5 sm:pl-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-border">
                  {avatarNode}
                </div>
                <div className="hidden lg:block">
                  <p className="text-[0.8rem] font-semibold text-foreground leading-tight">
                    {userName}
                  </p>
                  <p className="text-[0.68rem] text-muted-foreground capitalize">
                    {user.role}
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main
          key={`${location.pathname}${location.search}`}
          className={[
            'animate-page-slide-in flex-1 scroll-smooth',
            location.pathname.endsWith('/ai')
              ? 'overflow-hidden'
              : 'overflow-y-auto pb-24 lg:pb-6',
          ].join(' ')}
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>

      </div>

    </div>

    <AIReminderToast />
    </>
  )
}
