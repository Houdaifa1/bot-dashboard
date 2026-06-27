import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, Clock, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getBookingRequests } from '../api'
import { useAuth } from '../store/auth'
import { t } from '../i18n'
import { PageLoader } from '../components/ui'
import type { BookingRequest } from '../types'

interface StatCardProps {
  label: string
  value: number
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

  const { data: bookingRequests, isLoading, isError, refetch } = useQuery<BookingRequest[]>({
    queryKey: ['booking-requests', 'ALL'],
    queryFn: () => getBookingRequests({}),
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

  const requests = bookingRequests ?? []

  const pendingCount = requests.filter(r => r.status === 'PENDING').length
  const confirmedCount = requests.filter(r => r.status === 'CONFIRMED').length
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length

  const recent = requests.slice(0, 5)

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
          label={lang === 'FR' ? 'Total demandes' : 'Total Requests'}
          value={requests.length}
          icon={CalendarCheck}
          accentClass="border-l-blue-500"
        />
        <StatCard
          label={t(lang, 'bookingRequests_status_pending')}
          value={pendingCount}
          icon={Clock}
          accentClass="border-l-amber-500"
        />
        <StatCard
          label={t(lang, 'bookingRequests_status_confirmed')}
          value={confirmedCount}
          icon={CalendarCheck}
          accentClass="border-l-emerald-500"
        />
        <StatCard
          label={t(lang, 'bookingRequests_status_rejected')}
          value={rejectedCount}
          icon={Clock}
          accentClass="border-l-red-500"
        />
      </div>

      {/* Recent booking requests */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{t(lang, 'bookingRequests_title')}</h2>
          <Link
            to="/booking-requests"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
          >
            {lang === 'FR' ? 'Voir tout' : 'View all'}
            <ArrowRight size={12} />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
            <CalendarCheck size={32} className="mb-3 opacity-20" />
            <p className="text-sm">{t(lang, 'bookingRequests_empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-400">{t(lang, 'bookingRequests_patient')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-400">{t(lang, 'bookingRequests_phone')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-400">{t(lang, 'bookingRequests_preferredDate')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-400">{t(lang, 'bookingRequests_requestedAt')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-400">{t(lang, 'bookingRequests_status')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((booking) => (
                  <tr key={booking.id} className="border-b border-neutral-50 dark:border-neutral-800 last:border-0 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-neutral-800 dark:text-neutral-200">{booking.campaignPatient?.patientName ?? '—'}</td>
                    <td className="px-6 py-3.5 text-neutral-500 dark:text-neutral-400 tabular-nums">{booking.campaignPatient?.phone ?? '—'}</td>
                    <td className="px-6 py-3.5 text-neutral-500 dark:text-neutral-400 tabular-nums">{booking.preferredDateRange || '—'}</td>
                    <td className="px-6 py-3.5 text-neutral-500 dark:text-neutral-400 tabular-nums">
                      {new Date(booking.createdAt).toLocaleDateString(
                        lang === 'FR' ? 'fr-MA' : 'en-GB',
                        { day: '2-digit', month: 'short', year: 'numeric' }
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        booking.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {t(lang, `bookingRequests_status_${booking.status.toLowerCase()}` as any)}
                      </span>
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
