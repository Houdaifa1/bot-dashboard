import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X, Loader2, Inbox, AlertTriangle } from 'lucide-react'
import type { AppointmentStatus } from '../../types'
import type { Lang, TKey } from '../../i18n'
import { t } from '../../i18n'

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${widths[size]} bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-neutral-200 dark:border-neutral-800`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="font-semibold text-neutral-800 dark:text-neutral-100 text-base">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-6 flex-1">{children}</div>
      </div>
    </div>
  )
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, lang, loading }: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  lang: Lang
  loading?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-800 dark:text-neutral-100 mb-1">{t(lang, 'confirmDeleteTitle')}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t(lang, 'confirmDeleteBody')}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-outline" onClick={onClose} disabled={loading}>
            {t(lang, 'cancel')}
          </button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : t(lang, 'delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-blue-600 dark:text-blue-400" />
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={28} />
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function Empty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-neutral-400 dark:text-neutral-600">
      <Inbox size={36} className="mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
const statusStyles: Record<AppointmentStatus, string> = {
  PENDING:   'badge-warning',
  CONFIRMED: 'badge-primary',
  CANCELLED: 'badge-danger',
  COMPLETED: 'badge-success',
  NO_SHOW:   'badge-neutral',
}

export function StatusBadge({ status, lang }: { status: AppointmentStatus; lang: Lang }) {
  const key = `status_${status}` as TKey
  return <span className={statusStyles[status]}>{t(lang, key)}</span>
}

// ── Active Badge ──────────────────────────────────────────────────────────────
export function ActiveBadge({ active, lang }: { active: boolean; lang: Lang }) {
  return active
    ? <span className="badge-success">{t(lang, 'active')}</span>
    : <span className="badge-neutral">{t(lang, 'inactive')}</span>
}

// ── Form Field ────────────────────────────────────────────────────────────────
export function Field({ label, error, hint, children }: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="label">{label}</label>
      {children}
      {hint && !error && <span className="text-xs text-neutral-400 dark:text-neutral-500">{hint}</span>}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  )
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100 leading-none">{value}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">{label}</p>
      </div>
    </div>
  )
}