import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { t } from '../../i18n'
import {
  LayoutDashboard, Building2, MessageSquare, Stethoscope,
  UserRound, HelpCircle, CalendarCheck, PhoneForwarded,
  Megaphone, AlertTriangle, LogOut, Globe, Menu, X, Sun, Moon
} from 'lucide-react'
import { useState } from 'react'

export function Shell({ children }: { children: React.ReactNode }) {
  const { admin, clearAuth, lang, setLang, theme, setTheme } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const navItems = [
    { to: '/',             icon: LayoutDashboard, label: t(lang, 'nav_dashboard') },
    { to: '/clinic',       icon: Building2,       label: t(lang, 'nav_clinic') },
    { to: '/bot-messages', icon: MessageSquare,   label: t(lang, 'nav_botMessages') },
    { to: '/specialties',  icon: Stethoscope,     label: t(lang, 'nav_specialties') },
    { to: '/doctors',      icon: UserRound,       label: t(lang, 'nav_doctors') },
    { to: '/faqs',         icon: HelpCircle,      label: t(lang, 'nav_faqs') },
    { to: '/appointments', icon: CalendarCheck,   label: t(lang, 'nav_appointments') },
    { to: '/handoff',      icon: PhoneForwarded,  label: t(lang, 'nav_handoff') },
    { to: '/campaigns',    icon: Megaphone,       label: t(lang, 'nav_campaigns') },
    { to: '/complaints',   icon: AlertTriangle,   label: t(lang, 'nav_complaints') },
  ]

  const sidebar = (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <MessageSquare size={15} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-neutral-800 dark:text-neutral-100 truncate">Healthcare Bot</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">{admin?.email}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
              ${isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-100'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-neutral-100 dark:border-neutral-800 space-y-0.5">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-100 w-full transition-all duration-150"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          {theme === 'dark'
            ? (lang === 'FR' ? 'Mode clair' : 'Light mode')
            : (lang === 'FR' ? 'Mode sombre' : 'Dark mode')
          }
        </button>
        <button
          onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-100 w-full transition-all duration-150"
        >
          <Globe size={17} />
          {lang === 'FR' ? 'Switch to English' : 'Passer en français'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 w-full transition-all duration-150"
        >
          <LogOut size={17} />
          {t(lang, 'nav_logout')}
        </button>
      </div>

    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-col bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 shrink-0">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-60 bg-white dark:bg-neutral-900 shadow-2xl z-50">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="btn-ghost p-2 rounded-lg"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-semibold text-sm text-neutral-800 dark:text-neutral-100">Healthcare Bot</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>

      </div>
    </div>
  )
}