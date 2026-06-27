import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Clock, UserRound, Phone, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { getBookingRequests, confirmBookingRequest, rejectBookingRequest } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t, type Lang } from '../i18n'
import { PageHeader, PageLoader, Empty, Modal, Field } from '../components/ui'
import type { BookingRequest, BookingRequestStatus } from '../types'

const STATUS_CONFIG: Record<BookingRequestStatus, { label: string; color: string }> = {
  PENDING:   { label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  REJECTED:  { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function ConfirmModal({ booking, lang, onClose, onConfirm, saving }: {
  booking: BookingRequest
  lang: Lang
  onClose: () => void
  onConfirm: (date: string, time: string, message: string) => void
  saving: boolean
}) {
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const patientName = booking.campaignPatient?.patientName ?? ''

  const defaultMsg = lang === 'FR'
    ? t(lang, 'bookingRequests_defaultConfirmMessage_FR')
    : t(lang, 'bookingRequests_defaultConfirmMessage_EN')

  const [customMessage, setCustomMessage] = useState(
    defaultMsg.replace('{patient}', patientName).replace('{date}', '').replace('{time}', '')
  )

  const handleSubmit = () => {
    if (appointmentDate && appointmentTime) {
      const msg = customMessage.trim()
        .replace('{patient}', patientName)
        .replace('{date}', appointmentDate)
        .replace('{time}', appointmentTime)
      onConfirm(appointmentDate, appointmentTime, msg)
    }
  }

  return (
    <Modal open={!!booking} onClose={onClose} title={t(lang, 'bookingRequests_confirmTitle')} size="lg">
      <div className="space-y-5">
        {/* Patient info */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 mb-1">
            <UserRound size={16} className="text-blue-500" />
            <p className="font-medium text-neutral-800 dark:text-neutral-200">{patientName}</p>
          </div>
          <p className="text-sm text-neutral-500 flex items-center gap-1.5 mt-1">
            <Phone size={12} /> {booking.campaignPatient?.phone}
          </p>
          {booking.reason && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2.5 bg-white dark:bg-neutral-800 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{lang === 'FR' ? 'Motif' : 'Reason'}:</span>
              <br />{booking.reason}
            </p>
          )}
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t(lang, 'bookingRequests_confirmDate')}>
            <input type="date" className="input h-10" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
          </Field>
          <Field label={t(lang, 'bookingRequests_confirmTime')}>
            <input type="time" className="input h-10" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} required step="900" />
          </Field>
        </div>

        {/* Message */}
        <div>
          <Field label={t(lang, 'bookingRequests_confirmMessage')}>
            <textarea className="input w-full min-h-[90px] resize-y" value={customMessage} onChange={e => setCustomMessage(e.target.value)} rows={3} />
          </Field>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{t(lang, 'bookingRequests_confirmMessageHint')}</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <button className="btn-outline" onClick={onClose} disabled={saving}>{t(lang, 'cancel')}</button>
          <button className="btn-primary inline-flex items-center gap-2" onClick={handleSubmit} disabled={saving || !appointmentDate || !appointmentTime}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {t(lang, 'bookingRequests_confirmSend')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function RejectModal({ booking, lang, onClose, onRejectNotify, onRejectSilent, saving }: {
  booking: BookingRequest
  lang: Lang
  onClose: () => void
  onRejectNotify: (message: string, language: string) => void
  onRejectSilent: () => void
  saving: boolean
}) {
  const [mode, setMode] = useState<'notify' | 'silent'>('notify')
  const patientName = booking.campaignPatient?.patientName ?? ''
  const defaultMsgFr = t(lang, 'bookingRequests_defaultRejectMessage_FR').replace('{patient}', patientName)
  const defaultMsgEn = t(lang, 'bookingRequests_defaultRejectMessage_EN').replace('{patient}', patientName)
  const [rejectLang, setRejectLang] = useState<'FR' | 'EN'>(lang)
  const [rejectMessage, setRejectMessage] = useState(rejectLang === 'FR' ? defaultMsgFr : defaultMsgEn)

  const handleLangChange = (newLang: 'FR' | 'EN') => {
    setRejectLang(newLang)
    setRejectMessage(newLang === 'FR' ? defaultMsgFr : defaultMsgEn)
  }

  return (
    <Modal open={!!booking} onClose={onClose} title={t(lang, 'bookingRequests_rejectModalTitle')} size="md">
      <div className="space-y-5">
        {/* Patient info */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <UserRound size={16} className="text-red-500" />
            <p className="font-medium text-neutral-800 dark:text-neutral-200">{patientName}</p>
          </div>
          <p className="text-sm text-neutral-500 flex items-center gap-1.5 mt-1 ml-6">
            <Phone size={12} /> {booking.campaignPatient?.phone}
          </p>
        </div>

        {/* Mode selection */}
        <div className="flex gap-3">
          <button
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border ${
              mode === 'notify'
                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
            onClick={() => setMode('notify')}
          >
            {t(lang, 'bookingRequests_rejectNotify')}
          </button>
          <button
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border ${
              mode === 'silent'
                ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
            onClick={() => setMode('silent')}
          >
            {t(lang, 'bookingRequests_rejectSilent')}
          </button>
        </div>

        {/* Notify mode */}
        {mode === 'notify' && (
          <>
            <div className="flex gap-2">
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  rejectLang === 'FR'
                    ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
                onClick={() => handleLangChange('FR')}
              >
                {t(lang, 'bookingRequests_rejectLangFr')}
              </button>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  rejectLang === 'EN'
                    ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
                onClick={() => handleLangChange('EN')}
              >
                {t(lang, 'bookingRequests_rejectLangEn')}
              </button>
            </div>
            <Field label={t(lang, 'bookingRequests_rejectMessageLabel')}>
              <textarea className="input w-full min-h-[100px] resize-y" value={rejectMessage} onChange={e => setRejectMessage(e.target.value)} rows={3} />
            </Field>
          </>
        )}

        {/* Silent mode */}
        {mode === 'silent' && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {lang === 'FR'
                ? 'La demande sera rejetée sans notification au patient.'
                : 'The request will be rejected without notifying the patient.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <button className="btn-outline" onClick={onClose} disabled={saving}>{t(lang, 'cancel')}</button>
          {mode === 'notify' ? (
            <button className="btn-primary inline-flex items-center gap-2 bg-red-600 hover:bg-red-700" onClick={() => onRejectNotify(rejectMessage, rejectLang)} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              {t(lang, 'bookingRequests_rejectSend')}
            </button>
          ) : (
            <button className="btn-ghost text-red-600 hover:bg-red-50 inline-flex items-center gap-2" onClick={onRejectSilent} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              {t(lang, 'bookingRequests_rejectJust')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ReasonCell({ reason }: { reason: string | null | undefined }) {
  if (!reason) return <span className="text-neutral-400">—</span>
  return (
    <div className="max-w-[300px]">
      <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">{reason}</p>
    </div>
  )
}

export function BookingRequestsPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<BookingRequestStatus | 'ALL'>('ALL')
  const [confirmTarget, setConfirmTarget] = useState<BookingRequest | null>(null)
  const [rejectTarget, setRejectTarget] = useState<BookingRequest | null>(null)

  const { data: bookingRequests, isLoading, isError, refetch } = useQuery<BookingRequest[]>({
    queryKey: ['booking-requests', statusFilter],
    queryFn: () => getBookingRequests(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
  })

  const confirmMut = useMutation({
    mutationFn: ({ id, appointmentDate, appointmentTime, message }: { id: string; appointmentDate: string; appointmentTime: string; message: string }) => {
      const payload: Record<string, string> = { appointmentDate, appointmentTime }
      if (message?.trim()) payload.message = message.trim()
      return confirmBookingRequest(id, payload as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] })
      toast(t(lang, 'bookingRequests_confirmedWithMessage'), 'success')
      setConfirmTarget(null)
    },
    onError: (err: any) => {
      toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error')
    },
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, message, language, silent }: { id: string; message?: string; language?: string; silent?: boolean }) =>
      rejectBookingRequest(id, { message, language, silent }),
    onSuccess: (_data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] })
      toast(variables.silent ? t(lang, 'bookingRequests_rejectedSilently') : t(lang, 'bookingRequests_rejectedWithMessage'), 'success')
      setRejectTarget(null)
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

      {/* Filter bar */}
      <div className="card p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-neutral-500">{t(lang, 'bookingRequests_filterStatus')}</label>
          <select className="input h-10 w-auto min-w-[150px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value as BookingRequestStatus | 'ALL')}>
            <option value="ALL">{t(lang, 'bookingRequests_all')}</option>
            <option value="PENDING">{t(lang, 'bookingRequests_pending')}</option>
            <option value="CONFIRMED">{t(lang, 'bookingRequests_confirmed')}</option>
            <option value="REJECTED">{t(lang, 'bookingRequests_rejected')}</option>
          </select>
        </div>
        <button className="btn-outline" onClick={() => refetch()}>
          <RefreshCw size={16} /> {lang === 'FR' ? 'Actualiser' : 'Refresh'}
        </button>
      </div>

      {/* Table */}
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
                      <ReasonCell reason={booking.reason} />
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{booking.preferredDoctor || booking.preferredSpecialty || '—'}</td>
                    <td className="px-5 py-4 text-neutral-600">{booking.preferredDateRange || '—'}</td>
                    <td className="px-5 py-4 text-neutral-600 tabular-nums">{formatDateTime(booking.createdAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.color}`}>{t(lang, `bookingRequests_${booking.status.toLowerCase()}` as any)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {booking.status === 'PENDING' && (
                        <div className="flex items-center justify-end gap-2">
                          <button className="btn-primary h-8 text-xs inline-flex items-center gap-1.5" onClick={() => setConfirmTarget(booking)}>
                            <CheckCircle2 size={12} /> {t(lang, 'bookingRequests_confirm')}
                          </button>
                          <button className="btn-ghost h-8 text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1.5" onClick={() => setRejectTarget(booking)} disabled={rejectMut.isPending}>
                            <XCircle size={12} /> {t(lang, 'bookingRequests_reject')}
                          </button>
                        </div>
                      )}
                      {booking.status === 'CONFIRMED' && booking.appointment && (
                        <div className="text-xs text-neutral-500">
                          <div className="flex items-center gap-1 justify-end"><Calendar size={12} />{formatDate(booking.appointment.appointmentDate)}</div>
                          <div className="flex items-center gap-1 justify-end mt-0.5"><Clock size={12} />{booking.appointment.appointmentTime}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm modal */}
      {confirmTarget && (
        <ConfirmModal
          booking={confirmTarget}
          lang={lang}
          onClose={() => setConfirmTarget(null)}
          onConfirm={(date, time, message) => confirmMut.mutate({ id: confirmTarget.id, appointmentDate: date, appointmentTime: time, message })}
          saving={confirmMut.isPending}
        />
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          booking={rejectTarget}
          lang={lang}
          onClose={() => setRejectTarget(null)}
          onRejectNotify={(message, language) => rejectMut.mutate({ id: rejectTarget.id, message, language, silent: false })}
          onRejectSilent={() => rejectMut.mutate({ id: rejectTarget.id, silent: true })}
          saving={rejectMut.isPending}
        />
      )}
    </div>
  )
}