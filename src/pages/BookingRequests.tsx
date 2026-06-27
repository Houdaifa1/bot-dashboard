import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, Clock, RefreshCw, Loader2, Trash2,
  CheckCircle, XCircle, ChevronDown, ChevronUp, AlertCircle,
  MessageSquare, Eye,
} from 'lucide-react'
import {
  getBookingRequests,
  deleteBookingRequest,
  confirmBookingRequest,
  rejectBookingRequest,
} from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import { PageHeader, PageLoader, Empty, Modal } from '../components/ui'
import type { BookingRequest, BookingRequestStatus } from '../types'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BookingRequestStatus, { color: string; label: string }> = {
  PENDING:   { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',  label: 'Pending'   },
  CONFIRMED: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',  label: 'Confirmed' },
  REJECTED:  { color: 'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400',    label: 'Rejected'  },
}

// ── Default message templates ─────────────────────────────────────────────────

type MsgLang = 'EN' | 'FR' | 'AR'

function buildConfirmMessage(lang: MsgLang, name: string, date: string, time: string): string {
  const fmtDate = date
    ? new Date(date).toLocaleDateString(
        lang === 'FR' ? 'fr-MA' : lang === 'AR' ? 'ar-MA' : 'en-GB',
        { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      )
    : '[date]'
  const fmtTime = time || '[time]'
  const n = name || 'Patient'

  if (lang === 'FR') {
    return `Bonjour ${n},\n\nNous avons le plaisir de vous confirmer votre rendez-vous.\n\n📅 Date : ${fmtDate}\n🕐 Heure : ${fmtTime}\n\nMerci de vous présenter 10 minutes avant l'heure prévue. En cas d'empêchement, veuillez nous contacter dès que possible.\n\nÀ bientôt !`
  }
  if (lang === 'AR') {
    return `مرحباً ${n}،\n\nيسعدنا تأكيد موعدكم.\n\n📅 التاريخ: ${fmtDate}\n🕐 الوقت: ${fmtTime}\n\nنرجو منكم الحضور قبل 10 دقائق من الموعد المحدد. في حال وجود أي عائق، يرجى التواصل معنا في أقرب وقت.\n\nإلى اللقاء!`
  }
  return `Hello ${n},\n\nWe're pleased to confirm your appointment.\n\n📅 Date: ${fmtDate}\n🕐 Time: ${fmtTime}\n\nPlease arrive 10 minutes before your scheduled time. If you need to cancel, please contact us as soon as possible.\n\nSee you soon!`
}

function buildRejectMessage(lang: MsgLang, name: string): string {
  const n = name || 'Patient'
  if (lang === 'FR') {
    return `Bonjour ${n},\n\nNous avons bien reçu votre demande de rendez-vous. Malheureusement, nous ne sommes pas en mesure de la confirmer pour le moment.\n\nN'hésitez pas à nous recontacter pour trouver un créneau disponible.\n\nCordialement.`
  }
  if (lang === 'AR') {
    return `مرحباً ${n}،\n\nلقد تلقينا طلب حجز موعدكم. للأسف، لا يمكننا تأكيده في الوقت الحالي.\n\nلا تترددوا في التواصل معنا للعثور على موعد متاح.\n\nمع تحياتنا.`
  }
  return `Hello ${n},\n\nWe received your appointment request. Unfortunately, we're unable to confirm it at this time.\n\nPlease don't hesitate to reach out and we'll find a suitable slot for you.\n\nBest regards.`
}

// ── Message preview bubble ────────────────────────────────────────────────────

function WhatsAppPreview({ message }: { message: string }) {
  if (!message.trim()) return null
  return (
    <div className="bg-[#e5ddd5] dark:bg-neutral-900 rounded-xl p-3">
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-[#dcf8c6] dark:bg-[#005c4b] rounded-xl rounded-tr-sm px-3.5 py-2.5 shadow-sm">
          <p className="text-sm text-neutral-800 dark:text-neutral-100 whitespace-pre-wrap leading-relaxed">
            {message}
          </p>
          <div className="flex items-center justify-end gap-1 mt-1.5">
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <svg viewBox="0 0 16 11" className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 fill-current">
              <path d="M11.071.653a.5.5 0 0 0-.707 0L4.501 6.516l-2.47-2.47a.5.5 0 0 0-.707.707l2.824 2.823a.5.5 0 0 0 .707 0l6.216-6.216a.5.5 0 0 0 0-.707zM14.07.653a.5.5 0 0 0-.707 0L7.5 6.516l-.47-.47a.5.5 0 0 0-.707.707l.824.823a.5.5 0 0 0 .707 0l6.216-6.216a.5.5 0 0 0 0-.707z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Expandable reason cell ────────────────────────────────────────────────────

function ReasonCell({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 60
  if (!isLong) return <p className="text-sm text-neutral-700 dark:text-neutral-300">{text}</p>
  return (
    <div className="space-y-1">
      <p className={`text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
        {text}
      </p>
      <button
        onClick={() => setExpanded(v => !v)}
        className="inline-flex items-center gap-0.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
      >
        {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
      </button>
    </div>
  )
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  booking: BookingRequest
  onClose: () => void
  onConfirm: (data: { appointmentDate: string; appointmentTime: string; message?: string }) => void
  loading: boolean
}

function ConfirmModal({ booking, onClose, onConfirm, loading }: ConfirmModalProps) {
  const [date, setDate]         = useState('')
  const [time, setTime]         = useState('')
  const [lang, setLang]         = useState<MsgLang>('FR')
  const [mode, setMode]         = useState<'default' | 'custom'>('default')
  const [custom, setCustom]     = useState('')
  const [preview, setPreview]   = useState(false)
  const [errors, setErrors]     = useState<{ date?: string; time?: string }>({})

  const patientName = booking.campaignPatient?.patientName ?? ''
  const defaultMsg  = buildConfirmMessage(lang, patientName, date, time)
  const finalMsg    = mode === 'default' ? defaultMsg : custom

  // keep custom seeded when switching to custom for first time
  useEffect(() => {
    if (mode === 'custom' && !custom) setCustom(defaultMsg)
  }, [mode])

  const validate = () => {
    const e: typeof errors = {}
    if (!date) e.date = 'Select a date.'
    if (!time) e.time = 'Select a time.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onConfirm({ appointmentDate: date, appointmentTime: time, message: finalMsg })
  }

  return (
    <Modal open onClose={onClose} title="Confirm appointment" size="lg">
      <div className="space-y-5">

        {/* Patient card */}
        <div className="flex items-start gap-3 p-3.5 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-100 dark:border-green-900/40">
          <CheckCircle size={16} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-green-900 dark:text-green-200">{patientName || '—'}</p>
            <p className="text-xs text-green-700/60 dark:text-green-400/60 mt-0.5">{booking.campaignPatient?.phone}</p>
            {booking.preferredDoctor && (
              <p className="text-xs text-green-800 dark:text-green-300 mt-1">
                Preferred doctor: <span className="font-medium">{booking.preferredDoctor}</span>
              </p>
            )}
            {booking.preferredDateRange && (
              <p className="text-xs text-green-800 dark:text-green-300 mt-0.5">
                Preferred dates: <span className="font-medium">{booking.preferredDateRange}</span>
              </p>
            )}
          </div>
        </div>

        {/* Date & time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Appointment date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className={`input h-10 w-full ${errors.date ? 'border-red-400 dark:border-red-500' : ''}`}
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: undefined })) }}
            />
            {errors.date && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.date}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Appointment time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              className={`input h-10 w-full ${errors.time ? 'border-red-400 dark:border-red-500' : ''}`}
              value={time}
              onChange={e => { setTime(e.target.value); setErrors(p => ({ ...p, time: undefined })) }}
            />
            {errors.time && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.time}</p>}
          </div>
        </div>

        {/* Message section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-neutral-400" />
              <span className="text-xs font-medium text-neutral-500">WhatsApp message to patient</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Language selector */}
              <select
                className="input h-8 text-xs px-2 w-auto"
                value={lang}
                onChange={e => setLang(e.target.value as MsgLang)}
              >
                <option value="EN">🇬🇧 English</option>
                <option value="FR">🇫🇷 Français</option>
                <option value="AR">🇲🇦 العربية</option>
              </select>
              {/* Mode toggle */}
              <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden text-xs">
                <button
                  className={`px-3 h-8 font-medium transition-colors ${mode === 'default' ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900' : 'bg-white dark:bg-neutral-900 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                  onClick={() => setMode('default')}
                >
                  Default
                </button>
                <button
                  className={`px-3 h-8 font-medium transition-colors ${mode === 'custom' ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900' : 'bg-white dark:bg-neutral-900 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                  onClick={() => setMode('custom')}
                >
                  Custom
                </button>
              </div>
            </div>
          </div>

          {mode === 'default' ? (
            <div className="relative">
              <pre className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed font-sans border border-neutral-100 dark:border-neutral-800 max-h-36 overflow-y-auto">
                {defaultMsg}
              </pre>
              <span className="absolute top-2 right-2 text-[10px] text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5">
                auto-generated
              </span>
            </div>
          ) : (
            <textarea
              className="input w-full resize-none text-sm"
              rows={5}
              dir={lang === 'AR' ? 'rtl' : 'ltr'}
              placeholder="Write a custom message…"
              value={custom}
              onChange={e => setCustom(e.target.value)}
            />
          )}

          {/* Preview toggle */}
          <button
            onClick={() => setPreview(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            <Eye size={12} />
            {preview ? 'Hide preview' : 'Preview as WhatsApp'}
          </button>

          {preview && <WhatsAppPreview message={finalMsg} />}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <button className="btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn-primary inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 focus-visible:ring-green-500"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Confirm & send message
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Reject modal ──────────────────────────────────────────────────────────────

interface RejectModalProps {
  booking: BookingRequest
  onClose: () => void
  onReject: (data: { message?: string; language?: string; silent?: boolean }) => void
  loading: boolean
}

function RejectModal({ booking, onClose, onReject, loading }: RejectModalProps) {
  const [lang, setLang]       = useState<MsgLang>('FR')
  const [mode, setMode]       = useState<'default' | 'custom' | 'silent'>('default')
  const [custom, setCustom]   = useState('')
  const [preview, setPreview] = useState(false)

  const patientName = booking.campaignPatient?.patientName ?? ''
  const defaultMsg  = buildRejectMessage(lang, patientName)
  const finalMsg    = mode === 'default' ? defaultMsg : mode === 'custom' ? custom : ''

  useEffect(() => {
    if (mode === 'custom' && !custom) setCustom(defaultMsg)
  }, [mode])

  const handleSubmit = () => {
    onReject({
      message:  mode === 'silent' ? undefined : finalMsg,
      language: lang,
      silent:   mode === 'silent',
    })
  }

  return (
    <Modal open onClose={onClose} title="Reject booking request" size="lg">
      <div className="space-y-5">

        {/* Warning */}
        <div className="flex items-start gap-3 p-3.5 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/50">
          <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-800 dark:text-red-300">
              Rejecting request from <span className="font-medium">{patientName || 'this patient'}</span>.
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/60 mt-0.5">
              {mode === 'silent'
                ? 'The patient will NOT be notified.'
                : 'A WhatsApp message will be sent to the patient.'}
            </p>
          </div>
        </div>

        {/* Message section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-neutral-400" />
              <span className="text-xs font-medium text-neutral-500">Notification to patient</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Language selector — disabled when silent */}
              <select
                className="input h-8 text-xs px-2 w-auto disabled:opacity-40"
                value={lang}
                onChange={e => setLang(e.target.value as MsgLang)}
                disabled={mode === 'silent'}
              >
                <option value="EN">🇬🇧 English</option>
                <option value="FR">🇫🇷 Français</option>
                <option value="AR">🇲🇦 العربية</option>
              </select>
              {/* 3-way mode toggle */}
              <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden text-xs">
                {(['default', 'custom', 'silent'] as const).map(m => (
                  <button
                    key={m}
                    className={`px-3 h-8 font-medium capitalize transition-colors ${
                      mode === m
                        ? m === 'silent'
                          ? 'bg-neutral-500 text-white'
                          : 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                        : 'bg-white dark:bg-neutral-900 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                    onClick={() => setMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mode === 'default' && (
            <div className="relative">
              <pre className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed font-sans border border-neutral-100 dark:border-neutral-800 max-h-36 overflow-y-auto">
                {defaultMsg}
              </pre>
              <span className="absolute top-2 right-2 text-[10px] text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5">
                auto-generated
              </span>
            </div>
          )}

          {mode === 'custom' && (
            <textarea
              className="input w-full resize-none text-sm"
              rows={5}
              dir={lang === 'AR' ? 'rtl' : 'ltr'}
              placeholder="Write a custom rejection message…"
              value={custom}
              onChange={e => setCustom(e.target.value)}
            />
          )}

          {mode === 'silent' && (
            <div className="flex items-center gap-2.5 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
              <span className="text-lg">🔇</span>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No message will be sent. The request will be silently rejected.
              </p>
            </div>
          )}

          {mode !== 'silent' && (
            <button
              onClick={() => setPreview(v => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              <Eye size={12} />
              {preview ? 'Hide preview' : 'Preview as WhatsApp'}
            </button>
          )}

          {preview && mode !== 'silent' && <WhatsAppPreview message={finalMsg} />}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <button className="btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn-primary inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            {mode === 'silent' ? 'Reject silently' : 'Reject & send message'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Delete modal ──────────────────────────────────────────────────────────────

function DeleteModal({ booking, onClose, onConfirm, loading }: {
  booking: BookingRequest; onClose: () => void; onConfirm: () => void; loading: boolean
}) {
  return (
    <Modal open onClose={onClose} title="Delete booking request" size="md">
      <div className="space-y-5">
        <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/50">
          <p className="text-sm text-red-800 dark:text-red-300">
            This will permanently delete the booking request from{' '}
            <span className="font-medium">{booking.campaignPatient?.patientName ?? 'this patient'}</span>.
            {' '}This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <button className="btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn-primary inline-flex items-center gap-2 bg-red-600 hover:bg-red-700"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete request
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Row actions ───────────────────────────────────────────────────────────────

function RowActions({ booking, onConfirm, onReject, onDelete }: {
  booking: BookingRequest
  onConfirm: (b: BookingRequest) => void
  onReject:  (b: BookingRequest) => void
  onDelete:  (b: BookingRequest) => void
}) {
  const isPending = booking.status === 'PENDING'
  return (
    <div className="flex items-center justify-end gap-1.5">
      {isPending && (
        <>
          <button
            className="h-7 px-2.5 rounded-md text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 text-xs inline-flex items-center gap-1.5 transition-colors font-medium border border-green-200 dark:border-green-800"
            onClick={() => onConfirm(booking)}
          >
            <CheckCircle size={12} /> Confirm
          </button>
          <button
            className="h-7 px-2.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs inline-flex items-center gap-1.5 transition-colors font-medium border border-red-200 dark:border-red-800"
            onClick={() => onReject(booking)}
          >
            <XCircle size={12} /> Reject
          </button>
        </>
      )}
      <button
        className="h-7 w-7 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 inline-flex items-center justify-center transition-colors"
        onClick={() => onDelete(booking)}
        title="Delete"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BookingRequestsPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<BookingRequestStatus | 'ALL'>('ALL')
  const [confirmTarget, setConfirmTarget] = useState<BookingRequest | null>(null)
  const [rejectTarget,  setRejectTarget]  = useState<BookingRequest | null>(null)
  const [deleteTarget,  setDeleteTarget]  = useState<BookingRequest | null>(null)

  const { data: bookingRequests, isLoading, isError, refetch, isFetching } = useQuery<BookingRequest[]>({
    queryKey: ['booking-requests', statusFilter],
    queryFn: () => getBookingRequests(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['booking-requests'] })
  }, [queryClient])

  const confirmMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { appointmentDate: string; appointmentTime: string; message?: string } }) =>
      confirmBookingRequest(id, data),
    onSuccess: () => {
      invalidate()
      toast('Appointment confirmed — message sent to patient.', 'success')
      setConfirmTarget(null)
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Failed to confirm.', 'error'),
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { message?: string; language?: string; silent?: boolean } }) =>
      rejectBookingRequest(id, data),
    onSuccess: (_, vars) => {
      invalidate()
      toast(vars.data.silent ? 'Request rejected silently.' : 'Request rejected — patient notified.', 'success')
      setRejectTarget(null)
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Failed to reject.', 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBookingRequest(id),
    onSuccess: () => {
      invalidate()
      toast('Booking request deleted.', 'success')
      setDeleteTarget(null)
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Failed to delete.', 'error'),
  })

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(lang === 'FR' ? 'fr-MA' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString(lang === 'FR' ? 'fr-MA' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  if (isLoading) return <PageLoader />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-neutral-500">Failed to load booking requests.</p>
        <button className="btn-outline" onClick={() => refetch()}>Try again</button>
      </div>
    )
  }

  const items = bookingRequests ?? []

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t(lang, 'bookingRequests_title')}
        subtitle={t(lang, 'bookingRequests_subtitle')}
      />

      {/* Toolbar */}
      <div className="card p-4 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-neutral-500 whitespace-nowrap">Filter by status</label>
          <select
            className="input h-10 w-auto min-w-[150px]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as BookingRequestStatus | 'ALL')}
          >
            <option value="ALL">All requests</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <button className="btn-outline inline-flex items-center gap-2" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <Empty message={t(lang, 'bookingRequests_empty')} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                {['Patient', 'Reason', 'Doctor / Specialty', 'Preferred dates', 'Requested', 'Status', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3.5 font-medium text-neutral-400 text-xs uppercase tracking-wide ${i === 6 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/60">
              {items.map(booking => {
                const statusStyle = STATUS_CONFIG[booking.status]
                return (
                  <tr key={booking.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-neutral-800 dark:text-neutral-200 leading-tight">
                        {booking.campaignPatient?.patientName ?? '—'}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5 tabular-nums">{booking.campaignPatient?.phone}</p>
                    </td>
                    <td className="px-5 py-4 max-w-[240px] align-top">
                      {booking.reason
                        ? <ReasonCell text={booking.reason} />
                        : <span className="text-neutral-300 dark:text-neutral-600">—</span>
                      }
                    </td>
                    <td className="px-5 py-4 text-neutral-600 dark:text-neutral-400 align-top">
                      {booking.preferredDoctor || booking.preferredSpecialty || <span className="text-neutral-300 dark:text-neutral-600">—</span>}
                    </td>
                    <td className="px-5 py-4 text-neutral-600 dark:text-neutral-400 align-top whitespace-nowrap">
                      {booking.preferredDateRange || <span className="text-neutral-300 dark:text-neutral-600">—</span>}
                    </td>
                    <td className="px-5 py-4 text-neutral-500 tabular-nums align-top whitespace-nowrap">
                      {formatDateTime(booking.createdAt)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.color}`}>
                        {statusStyle.label}
                      </span>
                      {booking.status === 'CONFIRMED' && booking.appointment && (
                        <div className="mt-2 space-y-0.5">
                          <div className="flex items-center gap-1 text-xs text-neutral-500">
                            <Calendar size={11} />{formatDate(booking.appointment.appointmentDate)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-neutral-500">
                            <Clock size={11} />{booking.appointment.appointmentTime}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <RowActions
                        booking={booking}
                        onConfirm={setConfirmTarget}
                        onReject={setRejectTarget}
                        onDelete={setDeleteTarget}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmTarget && (
        <ConfirmModal
          booking={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirm={data => confirmMut.mutate({ id: confirmTarget.id, data })}
          loading={confirmMut.isPending}
        />
      )}

      {rejectTarget && (
        <RejectModal
          booking={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={data => rejectMut.mutate({ id: rejectTarget.id, data })}
          loading={rejectMut.isPending}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          booking={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          loading={deleteMut.isPending}
        />
      )}
    </div>
  )
}