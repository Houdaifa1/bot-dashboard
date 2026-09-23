import { createContext, useContext } from 'react'
import type { AdminUser } from '../types'

export type Lang = 'FR' | 'EN'
export type Theme = 'light' | 'dark'

export interface AuthStore {
  token: string | null
  admin: AdminUser | null
  lang: Lang
  theme: Theme
  setAuth: (token: string, admin: AdminUser) => void
  clearAuth: () => void
  setLang: (lang: Lang) => void
  setTheme: (theme: Theme) => void
}

export const AuthContext = createContext<AuthStore | null>(null)

export function useAuth(): AuthStore {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth outside AuthProvider')
  return context
}
