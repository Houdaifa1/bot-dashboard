import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Clock, RefreshCw, Loader2, Trash2 } from 'lucide-react'
import { getBookingRequests, deleteBookingRequest } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t, type Lang } from '../i18n'
import { PageHeader, PageLoader, Empty, Modal } from '../components/ui'
import type { BookingRequest, BookingRequestStatus } from '../types'

const STATUS_CONFIG: Record<BookingRequestStatus, { color: string }> = {
  PENDING:   { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  CONFIRMED: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  REJECTED:  { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function ReasonTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const cellRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (cellRef.current) {
        const rect = cellRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        setFlipUp(spaceBelow < 250)
      }
      setShow(true)
    }, 600)
  }

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current)
    setShow(false)
  }

  return (
    <div ref={cellRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate max-w-[220px] cursor-default">
        {text}
      </p>
      {show && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
          <div
            className={`absolute z-50 left-0 w-80 bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-4 pointer-events-auto animate-in fade-in duration-200 ${
              flipUp
                ? 'bottom-full mb-2 slide-in-from-bottom-1'
                : 'top-full mt-2 slide-in-from-top-1'
            }`}
          >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-neutral-100 dark:border-neutral-700">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                Reason
              </span>
            </div>
            <p className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">
              {text}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function DeleteModal({ booking, lang, onClose, onConfirm, deleting }: {
  booking: BookingRequest
  lang: Lang
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
}) {
  return (
    <Modal open={!!booking} onClose={onClose} title={t(lang, 'bookingRequests_deleteTitle')} size="md">
      <div className="space-y-5">
        <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/50">
          <p className="text-sm text-red-800 dark:text-red-300">
            {t(lang, 'bookingRequests_deleteBody')?.replace('{name}', booking.campaignPatient?.patientName ?? '')}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <button className="btn-outline" onClick={onClose} disabled={deleting}>{t(lang, 'cancel')}</button>
          <button className="btn-primary inline-flex items-center gap-2 bg-red-600 hover:bg-red-700" onClick={onConfirm} disabled={deleting}>
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {t(lang, 'bookingRequests_delete')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function BookingRequestsPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<BookingRequestStatus | 'ALL'>('ALL')
  const [deleteTarget, setDeleteTarget] = useState<BookingRequest | null>(null)

  const { data: bookingRequests, isLoading, isError, refetch } = useQuery<BookingRequest[]>({
    queryKey: ['booking-requests', statusFilter],
    queryFn: () => getBookingRequests(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBookingRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] })
      toast(t(lang, 'bookingRequests_deleted'), 'success')
      setDeleteTarget(null)
    },
    onError: (err: any) => {
      toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error')
    },
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(lang === 'FR' ? 'fr-MA' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString(lang === 'FR' ? 'fr-MA' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  if (isLoading) return <PageLoader />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-neutral-500">{t(lang, 'errorLoading')}</p>
        <button className="btn-outline" onClick={() => refetch()}>{t(lang, 'tryAgain')}</button>
      </div>
    )
  }

  const items = bookingRequests ?? []

  return (
    <div className="max-w-6xl">
      <PageHeader title={t(lang, 'bookingRequests_title')} subtitle={t(lang, 'bookingRequests_subtitle')} />

      <div className="card p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-neutral-500">{t(lang, 'bookingRequests_filterStatus')}</label>
          <select className="input h-10 w-auto min-w-[150px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value as BookingRequestStatus | 'ALL')}>
            <option value="ALL">{t(lang, 'bookingRequests_all')}</option>
            <option value="PENDING">{t(lang, 'bookingRequests_status_pending')}</option>
            <option value="CONFIRMED">{t(lang, 'bookingRequests_status_confirmed')}</option>
            <option value="REJECTED">{t(lang, 'bookingRequests_status_rejected')}</option>
          </select>
        </div>
        <button className="btn-outline" onClick={() => refetch()}>
          <RefreshCw size={16} /> {lang === 'FR' ? 'Actualiser' : 'Refresh'}
        </button>
      </div>

      {items.length === 0 ? (
        <Empty message={t(lang, 'bookingRequests_empty')} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400">{t(lang, 'bookingRequests_patient')}</th>
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400">{t(lang, 'bookingRequests_reason')}</th>
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400">{t(lang, 'bookingRequests_preferredDoctor')}</th>
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400">{t(lang, 'bookingRequests_preferredDate')}</th>
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400">{t(lang, 'bookingRequests_requestedAt')}</th>
                <th className="text-left px-5 py-3.5 font-medium text-neutral-400">{t(lang, 'bookingRequests_status')}</th>
                <th className="text-right px-5 py-3.5 font-medium text-neutral-400">{t(lang, 'bookingRequests_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(booking => {
                const statusStyle = STATUS_CONFIG[booking.status]
                return (
                  <tr key={booking.id} className="table-row">
                    <td className="px-5 py-4">
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">{booking.campaignPatient?.patientName ?? '—'}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{booking.campaignPatient?.phone}</p>
                    </td>
                    <td className="px-5 py-4 max-w-[250px]">
                      {booking.reason ? (
                        <ReasonTooltip text={booking.reason} />
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{booking.preferredDoctor || booking.preferredSpecialty || '—'}</td>
                    <td className="px-5 py-4 text-neutral-600">{booking.preferredDateRange || '—'}</td>
                    <td className="px-5 py-4 text-neutral-600 tabular-nums">{formatDateTime(booking.createdAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.color}`}>{t(lang, `bookingRequests_status_${booking.status.toLowerCase()}` as any)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {booking.status === 'CONFIRMED' && booking.appointment && (
                        <div className="text-xs text-neutral-500 mb-1">
                          <div className="flex items-center gap-1 justify-end"><Calendar size={12} />{formatDate(booking.appointment.appointmentDate)}</div>
                          <div className="flex items-center gap-1 justify-end mt-0.5"><Clock size={12} />{booking.appointment.appointmentTime}</div>
                        </div>
                      )}
                      <button className="h-7 px-2 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 text-xs inline-flex items-center gap-1 transition-colors disabled:opacity-50" onClick={() => setDeleteTarget(booking)} disabled={deleteMut.isPending}>
                        <Trash2 size={12} /> {t(lang, 'bookingRequests_delete')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <DeleteModal
          booking={deleteTarget}
          lang={lang}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          deleting={deleteMut.isPending}
        />
      )}
    </div>
  )
}