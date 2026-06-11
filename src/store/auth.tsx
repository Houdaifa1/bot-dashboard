import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { AdminUser } from '../types'

export type Lang = 'FR' | 'EN'
export type Theme = 'light' | 'dark'

interface AuthStore {
    token: string | null
    admin: AdminUser | null
    lang: Lang
    theme: Theme
    setAuth: (token: string, admin: AdminUser) => void
    clearAuth: () => void
    setLang: (lang: Lang) => void
    setTheme: (theme: Theme) => void
}

const AuthContext = createContext<AuthStore | null>(null)
const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark')
}
export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
    const [admin, setAdmin] = useState<AdminUser | null>(() => {
        const s = localStorage.getItem('admin')
        return s ? JSON.parse(s) : null
    })
    const [lang, setLangState] = useState<Lang>(
        () => (localStorage.getItem('lang') as Lang) || 'FR'
    )
    const [theme, setThemeState] = useState<Theme>(
        () => (localStorage.getItem('theme') as Theme) || 'light'
    )

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [theme])

    const setAuth = (t: string, a: AdminUser) => {
        localStorage.setItem('token', t)
        localStorage.setItem('admin', JSON.stringify(a))
        setToken(t)
        setAdmin(a)
    }

    const clearAuth = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('admin')
        setToken(null)
        setAdmin(null)
    }

    const setLang = (l: Lang) => {
        localStorage.setItem('lang', l)
        setLangState(l)
    }

    const setTheme = (t: Theme) => {
        localStorage.setItem('theme', t)
        setThemeState(t)
    }

    return (
        <AuthContext.Provider value={{ token, admin, lang, theme, setAuth, clearAuth, setLang, setTheme }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth outside AuthProvider')
    return ctx
}