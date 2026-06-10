import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, CalendarClock, Clock, Stethoscope, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getStats } from '../api'
import { useAuth } from '../store/auth'
import { t } from '../i18n'
import { StatusBadge, PageLoader } from '../components/ui'
import type { Stats } from '../types'

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ElementType
  accentClass: string
}

function StatCard({ label, value, icon: Icon, accentClass }: StatCardProps) {
  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-5 flex items-center gap-4 border-l-4 ${accentClass}`}>
      <Icon size={18} className="text-neutral-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 leading-none">{value}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 truncate">{label}</p>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { lang, admin } = useAuth()

  const { data, isLoading, isError, refetch } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: getStats,
  })

  if (isLoading) return <PageLoader />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-neutral-500">{t(lang, 'errorLoading')}</p>
        <button className="btn-outline" onClick={() => refetch()}>
          {t(lang, 'tryAgain')}
        </button>
      </div>
    )
  }

  const stats = data!
  const recent = stats.recentAppointments ?? []

  return (
    <div className="max-w-5xl">

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-neutral-400 uppercase tracking-widest mb-1">
          {lang === 'FR' ? 'Tableau de bord' : 'Dashboard'}
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
          {admin?.email?.split('@')[0] ?? 'Admin'}
        </h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-8">
        <StatCard
          label={t(lang, 'dash_total')}
          value={stats.totalAppointments}
          icon={CalendarCheck}
          accentClass="border-l-blue-500"
        />
        <StatCard
          label={t(lang, 'dash_today')}
          value={stats.todayAppointments}
          icon={CalendarClock}
          accentClass="border-l-emerald-500"
        />
        <StatCard
          label={t(lang, 'dash_pending')}
          value={stats.pendingAppointments}
          icon={Clock}
          accentClass="border-l-amber-500"
        />
        <StatCard
          label={t(lang, 'dash_doctors')}
          value={stats.activeDoctors}
          icon={Stethoscope}
          accentClass="border-l-violet-500"
        />
      </div>

      {/* Recent appointments */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{t(lang, 'dash_recent')}</h2>
          <Link
            to="/appointments"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
          >
            {lang === 'FR' ? 'Voir tout' : 'View all'}
            <ArrowRight size={12} />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
            <CalendarCheck size={32} className="mb-3 opacity-20" />
            <p className="text-sm">{t(lang, 'dash_noRecent')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-400">{t(lang, 'appt_patient')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-400">{t(lang, 'appt_phone')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-400">{t(lang, 'appt_date')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-400">{t(lang, 'appt_time')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-400">{t(lang, 'appt_status')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((appt) => (
                  <tr key={appt.id} className="border-b border-neutral-50 dark:border-neutral-800 last:border-0 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-neutral-800 dark:text-neutral-200">{appt.patientName}</td>
                    <td className="px-6 py-3.5 text-neutral-500 dark:text-neutral-400 tabular-nums">{appt.patientPhone}</td>
                    <td className="px-6 py-3.5 text-neutral-500 dark:text-neutral-400 tabular-nums">
                      {new Date(appt.appointmentDate).toLocaleDateString(
                        lang === 'FR' ? 'fr-MA' : 'en-GB',
                        { day: '2-digit', month: 'short', year: 'numeric' }
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-neutral-500 dark:text-neutral-400 tabular-nums">{appt.appointmentTime}</td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={appt.status} lang={lang} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}