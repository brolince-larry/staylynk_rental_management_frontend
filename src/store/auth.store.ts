import { create } from 'zustand'
import { normalizeAuthUser } from '@/auth/routeAccess'
import type { AuthUser } from '@/types'

type CurrentProperty = NonNullable<AuthUser['current_property']>

interface AuthState {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  isInitialising: boolean
  setAuth: (token: string, user: AuthUser) => void
  setUser: (user: AuthUser) => void
  setCurrentProperty: (property: CurrentProperty | null) => void
  clearAuth: () => void
  setInitialising: (isInitialising: boolean) => void
  getDashboard: () => string
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isInitialising: true,
  setAuth: (token, user) =>
    set({
      token,
      user: normalizeAuthUser(user),
      isAuthenticated: true,
      isInitialising: false,
    }),
  setUser: (user) => set({ user: normalizeAuthUser(user) }),
  setCurrentProperty: (property) =>
    set((state) => ({
      user: state.user ? { ...state.user, current_property: property } : state.user,
    })),
  clearAuth: () =>
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isInitialising: false,
    }),
  setInitialising: (isInitialising) => set({ isInitialising }),
  getDashboard: (): string => {
    const user = get().user
    return user?.dashboard ?? '/login'
  },
}))
