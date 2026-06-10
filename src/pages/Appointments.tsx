import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { getAppointments, updateAppointmentStatus, getDoctors } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t, type TKey } from '../i18n'
import { PageHeader, PageLoader, Empty, StatusBadge } from '../components/ui'
import type { Appointment, AppointmentStatus, Doctor } from '../types'

const STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']

function AppointmentsPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterDoctorId, setFilterDoctorId] = useState<string>('')
  const [filterDate, setFilterDate] = useState<string>('')
  const [changingStatus, setChangingStatus] = useState<{ id: string; status: AppointmentStatus } | null>(null)

  const { data: appointments, isLoading, isError, refetch } = useQuery<(Appointment & { doctor?: Doctor; specialty?: { label: string } })[]>({
    queryKey: ['appointments', filterStatus, filterDoctorId, filterDate],
    queryFn: () => getAppointments({
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(filterDoctorId ? { doctorId: filterDoctorId } : {}),
      ...(filterDate ? { date: filterDate } : {}),
    }),
  })

  const { data: doctors } = useQuery<Doctor[]>({
    queryKey: ['doctors'],
    queryFn: () => getDoctors(),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      updateAppointmentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast(t(lang, 'appt_updated'), 'success')
      setChangingStatus(null)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const handleStatusChange = (id: string, status: AppointmentStatus) => {
    setChangingStatus({ id, status })
    statusMut.mutate({ id, status })
  }

  const handleExportCSV = () => {
    if (!appointments || appointments.length === 0) return

    const headers = [
      t(lang, 'appt_patient'),
      t(lang, 'appt_phone'),
      t(lang, 'appt_doctor'),
      t(lang, 'appt_date'),
      t(lang, 'appt_time'),
      t(lang, 'appt_status'),
    ]

    const rows = appointments.map(a => [
      a.patientName,
      a.patientPhone,
      a.doctor?.name ?? a.doctorId,
      new Date(a.appointmentDate).toLocaleDateString(
        lang === 'FR' ? 'fr-MA' : 'en-GB',
        { day: '2-digit', month: 'short', year: 'numeric' }
      ),
      a.appointmentTime,
      t(lang, `status_${a.status}` as TKey),
    ])

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t(lang, 'appt_title')}
        subtitle={t(lang, 'appt_subtitle')}
        action={
          appointments && appointments.length > 0 ? (
            <button className="btn-outline" onClick={handleExportCSV}>
              <Download size={16} />
              {t(lang, 'appt_export')}
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t(lang, 'appt_filter_status')}
          </label>
          <select
            className="input h-9 w-auto min-w-[130px] text-xs"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">{t(lang, 'all')}</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>{t(lang, `status_${s}` as TKey)}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t(lang, 'appt_filter_doctor')}
          </label>
          <select
            className="input h-9 w-auto min-w-[150px] text-xs"
            value={filterDoctorId}
            onChange={e => setFilterDoctorId(e.target.value)}
          >
            <option value="">{t(lang, 'all')}</option>
            {doctors?.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t(lang, 'appt_date')}
          </label>
          <input
            type="date"
            className="input h-9 w-auto text-xs"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          />
        </div>

        {(filterStatus || filterDoctorId || filterDate) && (
          <button
            className="btn-ghost h-8 px-2 text-xs"
            onClick={() => { setFilterStatus(''); setFilterDoctorId(''); setFilterDate('') }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Table */}
      {!appointments || appointments.length === 0 ? (
        <Empty message={t(lang, 'noData')} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400 dark:text-neutral-500">{t(lang, 'appt_patient')}</th>
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400 dark:text-neutral-500">{t(lang, 'appt_phone')}</th>
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400 dark:text-neutral-500">{t(lang, 'appt_doctor')}</th>
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400 dark:text-neutral-500">{t(lang, 'appt_date')}</th>
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400 dark:text-neutral-500">{t(lang, 'appt_time')}</th>
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400 dark:text-neutral-500">{t(lang, 'appt_status')}</th>
                <th className="text-right px-5 py-3.5 font-medium text-neutral-400 dark:text-neutral-500">{t(lang, 'actions')}</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id} className="table-row">
                  <td className="px-5 py-4 font-medium text-neutral-800 dark:text-neutral-200">
                    {a.patientName}
                  </td>
                  <td className="px-5 py-4 tabular-nums text-neutral-500 dark:text-neutral-400">
                    {a.patientPhone}
                  </td>
                  <td className="px-5 py-4 text-neutral-600 dark:text-neutral-400">
                    {a.doctor?.name ?? a.doctorId}
                  </td>
                  <td className="px-5 py-4 tabular-nums text-neutral-600 dark:text-neutral-400">
                    {new Date(a.appointmentDate).toLocaleDateString(
                      lang === 'FR' ? 'fr-MA' : 'en-GB',
                      { day: '2-digit', month: 'short', year: 'numeric' }
                    )}
                  </td>
                  <td className="px-5 py-4 tabular-nums text-neutral-600 dark:text-neutral-400">
                    {a.appointmentTime}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={a.status} lang={lang} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <select
                      className="input h-8 w-auto text-xs min-w-[110px]"
                      value=""
                      onChange={e => {
                        const val = e.target.value as AppointmentStatus
                        if (val && val !== a.status) handleStatusChange(a.id, val)
                        e.target.value = ''
                      }}
                      disabled={changingStatus?.id === a.id}
                    >
                      <option value="">{t(lang, 'appt_change_status')}</option>
                      {STATUSES.filter(s => s !== a.status).map(s => (
                        <option key={s} value={s}>
                          {changingStatus?.id === a.id && changingStatus.status === s
                            ? <Loader2 size={12} className="animate-spin inline" />
                            : t(lang, `status_${s}` as TKey)
                          }
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export { AppointmentsPage }