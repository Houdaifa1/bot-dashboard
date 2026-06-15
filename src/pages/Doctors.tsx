import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Clock, Loader2, X, AlertCircle,
  Phone, Calendar, User, MessageSquare, Send, CheckCircle, ToggleLeft,
  ToggleRight, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  getDoctors, createDoctor, updateDoctor, activateDoctor,
  deactivateDoctor, confirmDeactivateDoctor,
  deleteDoctor, confirmDeleteDoctor,
  getSpecialties,
  getTimeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot,
} from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import {
  PageHeader, PageLoader, Modal, Empty,
  ActiveBadge, Field,
} from '../components/ui'
import type { Doctor, Specialty, TimeSlot, AppointmentStatus } from '../types'

interface DoctorForm {
  name: string
  bio: string
  specialtyId: string
  displayOrder: number
}
const emptyForm = (): DoctorForm => ({
  name: '',
  bio: '',
  specialtyId: '',
  displayOrder: 0,
})

const DAYS_KEY = 'days'
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

interface SlotForm {
  dayOfWeek: number
  startTime: string
  endTime: string
  slotDurationMinutes: number
}
const emptySlot = (): SlotForm => ({
  dayOfWeek: 0,
  startTime: '09:00',
  endTime: '17:00',
  slotDurationMinutes: 30,
})

interface FutureAppointment {
  id: string
  patientName: string
  patientPhone: string
  appointmentDate: string
  appointmentTime: string
  status: AppointmentStatus
}
interface ActionCheckResult {
  requiresConfirmation?: boolean
  action?: 'deactivate' | 'delete'
  doctorId: string
  doctorName: string
  futureAppointments?: FutureAppointment[]
  futureAppointmentsCount?: number
  deactivated?: boolean
  deleted?: boolean
  hadFutureAppointments?: boolean
}

const getDefaultMessage = (lang: 'FR' | 'EN', doctorName: string) =>
  lang === 'FR'
    ? `Cher patient, votre rendez-vous chez ${doctorName} a été annulé. Veuillez nous contacter pour reprogrammer. Merci de votre compréhension.`
    : `Dear patient, your appointment with ${doctorName} has been cancelled. Please contact us to reschedule. Thank you for your understanding.`

// ── Doctor Modal (create / edit / reactivate) ─────────────────────────────────
function DoctorModal({
  open, onClose, onSave, saving, initial, lang, specialties, reactivateMode,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: DoctorForm) => void
  saving: boolean
  initial: DoctorForm | null
  lang: 'FR' | 'EN'
  specialties: Specialty[]
  reactivateMode?: boolean
}) {
  const [form, setForm] = useState<DoctorForm>(emptyForm())
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (open) { setForm(initial ?? emptyForm()); setDirty(false) }
  }, [open, initial])

  const isEditing = !!initial
  const set = (field: keyof DoctorForm, value: any) => {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
  }

  const activeSpecs = [...(specialties ?? [])]
    .filter(s => s.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)

  const title = reactivateMode
    ? (lang === 'FR' ? `Réactiver — ${initial?.name ?? ''}` : `Reactivate — ${initial?.name ?? ''}`)
    : isEditing
      ? `${t(lang, 'edit')} ${initial?.name ?? ''}`
      : t(lang, 'doc_add')

  const currentSpecIsInactive = reactivateMode && initial?.specialtyId
    ? !specialties.find(s => s.id === initial.specialtyId)?.isActive
    : false

  const canSave = dirty && !!form.name && !!form.specialtyId
  const mustPickSpecialty = reactivateMode && currentSpecIsInactive

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-5">
        {mustPickSpecialty && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>
              {lang === 'FR'
                ? 'La spécialité actuelle est inactive. Sélectionnez une spécialité active pour réactiver ce médecin.'
                : 'The current specialty is inactive. Select an active specialty to reactivate this doctor.'}
            </span>
          </div>
        )}
        {reactivateMode ? (
          <div className="px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-600 dark:text-neutral-300">
            <span className="font-medium">{form.name}</span>
            {form.bio && <p className="text-xs text-neutral-400 mt-0.5">{form.bio}</p>}
          </div>
        ) : (
          <>
            <Field label={t(lang, 'doc_name')}>
              <input className="input h-10" value={form.name}
                onChange={e => set('name', e.target.value)} required />
            </Field>
            <Field label={t(lang, 'doc_bio')}>
              <textarea className="input min-h-[70px] resize-y" value={form.bio}
                onChange={e => set('bio', e.target.value)} />
            </Field>
          </>
        )}
        <Field
          label={t(lang, 'doc_specialty')}
          hint={mustPickSpecialty ? (lang === 'FR' ? 'Requis pour réactiver' : 'Required to reactivate') : undefined}
        >
          <select
            className={`input h-10 ${mustPickSpecialty && !form.specialtyId ? 'border-amber-400' : ''}`}
            value={form.specialtyId}
            onChange={e => set('specialtyId', e.target.value)}
            required
          >
            <option value="">—</option>
            {activeSpecs.map(spec => {
              const labels = (spec.labels ?? {}) as Record<string, string>
              const label = [labels['FR'], labels['EN']].filter(Boolean).join(' / ') || spec.slug
              return <option key={spec.id} value={spec.id}>{label}</option>
            })}
          </select>
        </Field>
        {!reactivateMode && (
          <Field label={t(lang, 'doc_order')}>
            <input type="number" min={0} className="input h-10" value={form.displayOrder}
              onChange={e => set('displayOrder', parseInt(e.target.value) || 0)} />
          </Field>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {t(lang, 'cancel')}
          </button>
          <button
            type="submit"
            className={reactivateMode ? 'btn-primary bg-green-600 hover:bg-green-700' : 'btn-primary'}
            disabled={saving || !canSave}
          >
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : reactivateMode
                ? (lang === 'FR' ? 'Réactiver' : 'Reactivate')
                : t(lang, 'save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Time Slot Modal ───────────────────────────────────────────────────────────
function SlotModal({ open, onClose, onSave, saving, initial, lang }: {
  open: boolean; onClose: () => void; onSave: (data: SlotForm) => void
  saving: boolean; initial: SlotForm | null; lang: 'FR' | 'EN'
}) {
  const [form, setForm] = useState<SlotForm>(emptySlot())
  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (open) { setForm(initial ?? emptySlot()); setDirty(false) } }, [open, initial])
  const set = (field: keyof SlotForm, value: any) => { setForm(f => ({ ...f, [field]: value })); setDirty(true) }
  return (
    <Modal open={open} onClose={onClose} title={t(lang, 'slot_add')} size="sm">
      <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-5">
        <Field label={t(lang, 'slot_day')}>
          <select className="input h-10" value={form.dayOfWeek}
            onChange={e => set('dayOfWeek', parseInt(e.target.value))}>
            {WEEKDAYS.map(d => <option key={d} value={d}>{(t(lang, DAYS_KEY) as string[])[d]}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t(lang, 'slot_start')}>
            <input type="time" className="input h-10" value={form.startTime}
              onChange={e => set('startTime', e.target.value)} required />
          </Field>
          <Field label={t(lang, 'slot_end')}>
            <input type="time" className="input h-10" value={form.endTime}
              onChange={e => set('endTime', e.target.value)} required />
          </Field>
        </div>
        <Field label={t(lang, 'slot_duration')}>
          <div className="flex items-center gap-3">
            <input type="number" min={5} step={5} className="input h-10 w-28" value={form.slotDurationMinutes}
              onChange={e => set('slotDurationMinutes', parseInt(e.target.value) || 30)} />
            <span className="text-xs text-neutral-400">{lang === 'FR' ? 'minutes par créneau' : 'minutes per slot'}</span>
          </div>
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>{t(lang, 'cancel')}</button>
          <button type="submit" className="btn-primary" disabled={saving || !dirty}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : t(lang, 'save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Action Confirmation Modal ─────────────────────────────────────────────────
function ConfirmActionModal({
  open, onClose, doctor, checkResult, lang, action, onConfirm, confirming,
}: {
  open: boolean
  onClose: () => void
  doctor: Doctor | null
  checkResult: ActionCheckResult | null
  lang: 'FR' | 'EN'
  action: 'deactivate' | 'delete'
  onConfirm: (notify: boolean, customMessage?: string) => void
  confirming?: boolean
}) {
  const [notify, setNotify] = useState(true)
  const [customMessage, setCustomMessage] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => {
    if (open) { setNotify(true); setCustomMessage(''); setShowCustom(false) }
  }, [open])

  if (!open || !doctor || !checkResult) return null

  const isDelete = action === 'delete'
  const hasFuture = checkResult.requiresConfirmation && (checkResult.futureAppointments?.length ?? 0) > 0
  const appointments = checkResult.futureAppointments ?? []
  const defaultMsg = getDefaultMessage(lang, doctor.name)

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(lang === 'FR' ? 'fr-FR' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-neutral-200 dark:border-neutral-800">

        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            isDelete ? 'bg-red-50 dark:bg-red-950/40' : 'bg-amber-50 dark:bg-amber-950/40'
          }`}>
            {isDelete
              ? <Trash2 size={20} className="text-red-600 dark:text-red-400" />
              : <ToggleLeft size={20} className="text-amber-600 dark:text-amber-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
              {hasFuture
                ? (t(lang, isDelete ? 'doc_delete_has_future' : 'doc_deactivate_has_future') as string).replace('%s', String(appointments.length))
                : (t(lang, isDelete ? 'doc_delete_no_appointments' : 'doc_deactivate_no_appointments') as string).replace('%s', doctor.name)}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {hasFuture
                ? (lang === 'FR'
                  ? `Rendez-vous à venir avec ${doctor.name}`
                  : `Upcoming appointments with ${doctor.name}`)
                : t(lang, isDelete ? 'doc_delete_no_appointments_desc' : 'doc_deactivate_no_appointments_desc')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex-1 space-y-5">

          {/* Future appointments list */}
          {hasFuture && appointments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1.5">
                <Calendar size={12} />
                {t(lang, 'doc_future_appointments')}
                <span className="ml-auto font-normal text-neutral-400">{appointments.length}</span>
              </p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                        <User size={12} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate leading-tight">{apt.patientName}</p>
                        <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                          <Phone size={9} />{apt.patientPhone}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">{formatDate(apt.appointmentDate)}</p>
                      <p className="text-xs text-neutral-400 tabular-nums">{apt.appointmentTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No future appointments notice */}
          {!hasFuture && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle size={13} className="shrink-0 mt-0.5" />
              <span>
                {isDelete
                  ? (lang === 'FR'
                    ? 'Aucun rendez-vous futur. Le médecin sera supprimé et les rendez-vous passés resteront dans les archives.'
                    : 'No upcoming appointments. The doctor will be deleted and past appointments will remain in records.')
                  : (lang === 'FR'
                    ? 'Aucun rendez-vous futur. Le médecin sera désactivé et pourra être réactivé ultérieurement.'
                    : 'No upcoming appointments. The doctor will be deactivated and can be reactivated later.')}
              </span>
            </div>
          )}

          {/* Notification toggle — only shown when there are future appointments */}
          {hasFuture && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700">
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notify}
                    onChange={e => setNotify(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-neutral-300 dark:bg-neutral-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 leading-tight">
                    {t(lang, isDelete ? 'doc_delete_notify_patients' : 'doc_deactivate_notify_patients')}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {lang === 'FR'
                      ? `${appointments.length} message(s) WhatsApp seront envoyés`
                      : `${appointments.length} WhatsApp message(s) will be sent`}
                  </p>
                </div>
              </div>

              {/* Default message preview */}
              {notify && (
                <div className="px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                    {lang === 'FR' ? 'Message par défaut :' : 'Default message:'}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">{defaultMsg}</p>
                </div>
              )}

              {/* Custom message */}
              {notify && (
                <>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                    onClick={() => setShowCustom(!showCustom)}
                  >
                    <MessageSquare size={11} />
                    {showCustom
                      ? (lang === 'FR' ? 'Utiliser le message par défaut' : 'Use default message')
                      : t(lang, 'doc_delete_custom_message')}
                    {showCustom ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                  {showCustom && (
                    <textarea
                      className="input min-h-[90px] resize-y text-xs leading-relaxed"
                      placeholder={t(lang, 'doc_delete_custom_message_placeholder') as string}
                      value={customMessage}
                      onChange={e => setCustomMessage(e.target.value)}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2.5">
          <button className="btn-outline" onClick={onClose} disabled={confirming}>
            {t(lang, 'cancel')}
          </button>

          {hasFuture ? (
            <>
              {/* Without notification */}
              <button
                className="btn-ghost text-neutral-600 dark:text-neutral-400"
                onClick={() => onConfirm(false)}
                disabled={confirming}
              >
                {confirming
                  ? <Loader2 size={14} className="animate-spin" />
                  : t(lang, isDelete ? 'doc_delete_just_delete' : 'doc_deactivate_just')}
              </button>

              {/* With notification — only shown when notify is checked */}
              {notify && (
                <button
                  className={`btn-primary flex items-center gap-1.5 ${isDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                  onClick={() => onConfirm(true, showCustom && customMessage ? customMessage : undefined)}
                  disabled={confirming}
                >
                  {confirming
                    ? <Loader2 size={14} className="animate-spin" />
                    : <><Send size={13} />{t(lang, isDelete ? 'doc_delete_send_delete' : 'doc_deactivate_send')}</>}
                </button>
              )}
            </>
          ) : (
            <button
              className={`flex items-center gap-1.5 ${isDelete
                ? 'btn-danger'
                : 'btn-ghost text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'}`}
              onClick={() => onConfirm(false)}
              disabled={confirming}
            >
              {confirming
                ? <Loader2 size={14} className="animate-spin" />
                : isDelete
                  ? <><Trash2 size={14} />{t(lang, 'delete')}</>
                  : <><ToggleLeft size={14} />{t(lang, 'doc_deactivate')}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Slot grid inside the card ─────────────────────────────────────────────────
function SlotGrid({ doctorId, lang }: { doctorId: string; lang: 'FR' | 'EN' }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const days = t(lang, DAYS_KEY) as string[]
  const [slotModalOpen, setSlotModalOpen] = useState(false)
  const [editSlot, setEditSlot] = useState<TimeSlot | null>(null)

  const { data: slots, isLoading } = useQuery<TimeSlot[]>({
    queryKey: ['timeslots', doctorId],
    queryFn: () => getTimeSlots(doctorId),
  })

  const deleteSlotMut = useMutation({
    mutationFn: (id: string) => deleteTimeSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslots', doctorId] })
      toast(t(lang, 'slot_deleted'), 'success')
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  const createSlotMut = useMutation({
    mutationFn: (data: SlotForm) => createTimeSlot(doctorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslots', doctorId] })
      toast(t(lang, 'slot_created'), 'success')
      setSlotModalOpen(false)
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  const updateSlotMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TimeSlot> }) => updateTimeSlot(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslots', doctorId] })
      toast(t(lang, 'slot_updated'), 'success')
      setSlotModalOpen(false)
      setEditSlot(null)
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  const handleSlotSave = (form: SlotForm) => {
    if (editSlot) updateSlotMut.mutate({ id: editSlot.id, data: form })
    else createSlotMut.mutate(form)
  }

  const slotSaving = createSlotMut.isPending || updateSlotMut.isPending
  const activeSlots = slots?.filter(s => s.isActive) ?? []

  // Group slots by day for a cleaner display
  const byDay = WEEKDAYS.reduce<Record<number, typeof activeSlots>>((acc, d) => {
    acc[d] = activeSlots.filter(s => s.dayOfWeek === d)
    return acc
  }, {})
  const daysWithSlots = WEEKDAYS.filter(d => byDay[d].length > 0)

  return (
    <>
      <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <Clock size={13} />
            {t(lang, 'doc_slots')}
            {activeSlots.length > 0 && (
              <span className="text-neutral-400 dark:text-neutral-600 font-normal">({activeSlots.length})</span>
            )}
          </div>
          <button
            className="btn-ghost h-7 px-2.5 text-xs gap-1"
            onClick={() => { setEditSlot(null); setSlotModalOpen(true) }}
          >
            <Plus size={11} />
            {t(lang, 'slot_add')}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-neutral-400">
            <Loader2 size={11} className="animate-spin" />
            {t(lang, 'loading')}
          </div>
        ) : activeSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-700">
            <Clock size={18} className="text-neutral-300 dark:text-neutral-600" />
            <p className="text-xs text-neutral-400 dark:text-neutral-600">{t(lang, 'slot_noSlots')}</p>
            <button
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => { setEditSlot(null); setSlotModalOpen(true) }}
            >
              {lang === 'FR' ? '+ Ajouter un créneau' : '+ Add a slot'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {daysWithSlots.map(day => (
              <div key={day} className="flex items-start gap-3">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-12 pt-2 shrink-0">
                  {days[day].slice(0, 3)}
                </span>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {byDay[day].map(slot => (
                    <div
                      key={slot.id}
                      className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-700/60 text-xs hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
                    >
                      <span className="tabular-nums text-neutral-700 dark:text-neutral-300">
                        {slot.startTime}–{slot.endTime}
                      </span>
                      <span className="text-neutral-400 dark:text-neutral-500">
                        {slot.slotDurationMinutes}m
                      </span>
                      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-0.5 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                          onClick={() => { setEditSlot(slot); setSlotModalOpen(true) }}
                          title={t(lang, 'edit') as string}
                        >
                          <Pencil size={9} />
                        </button>
                        <button
                          className="p-0.5 rounded text-neutral-400 hover:text-red-500 dark:hover:text-red-400"
                          onClick={() => deleteSlotMut.mutate(slot.id)}
                          title={t(lang, 'delete') as string}
                        >
                          <X size={9} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SlotModal
        open={slotModalOpen}
        onClose={() => { setSlotModalOpen(false); setEditSlot(null) }}
        onSave={handleSlotSave}
        saving={slotSaving}
        initial={editSlot
          ? { dayOfWeek: editSlot.dayOfWeek, startTime: editSlot.startTime, endTime: editSlot.endTime, slotDurationMinutes: editSlot.slotDurationMinutes }
          : null}
        lang={lang}
      />
    </>
  )
}

// ── Doctor Card ───────────────────────────────────────────────────────────────
function DoctorCard({
  doctor, specialtyLabel, specialtyIsActive, lang,
  onEdit, onActivate, onDeactivate, onDelete, activating,
}: {
  doctor: Doctor
  specialtyLabel: string
  specialtyIsActive: boolean
  lang: 'FR' | 'EN'
  onEdit: () => void
  onActivate: () => void
  onDeactivate: () => void
  onDelete: () => void
  activating?: boolean
}) {
  return (
    <div className={`card p-5 transition-opacity ${!doctor.isActive ? 'opacity-70' : ''}`}>
      {/* Card header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 leading-tight">{doctor.name}</h3>
            <ActiveBadge active={doctor.isActive} lang={lang} />
          </div>

          <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
            <span className={!specialtyIsActive ? 'text-amber-500 dark:text-amber-400 flex items-center gap-1' : ''}>
              {!specialtyIsActive && <AlertCircle size={10} />}
              {specialtyLabel}
              {!specialtyIsActive && (
                <span className="ml-1 opacity-75">
                  ({lang === 'FR' ? 'spécialité inactive' : 'specialty inactive'})
                </span>
              )}
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">·</span>
            <span>
              {lang === 'FR' ? 'Ordre' : 'Order'}&nbsp;
              <span className="tabular-nums font-medium text-neutral-600 dark:text-neutral-400">{doctor.displayOrder}</span>
            </span>
          </div>

          {doctor.bio && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 leading-relaxed mt-1 line-clamp-2">
              {doctor.bio}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Edit — always available */}
          <button
            className="btn-ghost h-8 w-8 p-0 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            onClick={onEdit}
            title={t(lang, 'edit') as string}
          >
            <Pencil size={14} />
          </button>

          {doctor.isActive ? (
            <>
              {/* Deactivate toggle */}
              <button
                className="btn-ghost h-8 w-8 p-0 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                onClick={onDeactivate}
                title={lang === 'FR' ? 'Désactiver' : 'Deactivate'}
              >
                <ToggleRight size={16} />
              </button>
              {/* Hard delete */}
              <button
                className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                onClick={onDelete}
                title={lang === 'FR' ? 'Supprimer définitivement' : 'Delete permanently'}
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : (
            <>
              {/* Activate toggle */}
              <button
                className="btn-ghost h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-40"
                onClick={onActivate}
                disabled={activating || !specialtyIsActive}
                title={
                  !specialtyIsActive
                    ? (lang === 'FR' ? 'Spécialité inactive — modifier d\'abord' : 'Specialty inactive — edit first')
                    : (lang === 'FR' ? 'Activer' : 'Activate')
                }
              >
                {activating ? <Loader2 size={14} className="animate-spin" /> : <ToggleLeft size={16} />}
              </button>
              {/* Hard delete for inactive too */}
              <button
                className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                onClick={onDelete}
                title={lang === 'FR' ? 'Supprimer définitivement' : 'Delete permanently'}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inactive specialty warning (when doctor is also inactive) */}
      {!doctor.isActive && !specialtyIsActive && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
          <AlertCircle size={11} className="shrink-0" />
          <span>
            {lang === 'FR'
              ? 'Spécialité inactive. Modifier le médecin pour lui assigner une spécialité active avant de réactiver.'
              : 'Specialty inactive. Edit the doctor to assign an active specialty before activating.'}
          </span>
        </div>
      )}

      {/* Slots — only for active doctors */}
      {doctor.isActive && <SlotGrid doctorId={doctor.id} lang={lang} />}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function DoctorsPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Doctor | null>(null)
  const [reactivating, setReactivating] = useState<Doctor | null>(null)

  // Deactivate state
  const [deactivateTarget, setDeactivateTarget] = useState<Doctor | null>(null)
  const [deactivateCheck, setDeactivateCheck] = useState<ActionCheckResult | null>(null)
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null)
  const [deleteCheck, setDeleteCheck] = useState<ActionCheckResult | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  // Track which doctor is being activated for the button spinner
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const { data: doctors, isLoading, isError, refetch } = useQuery<Doctor[]>({
    queryKey: ['doctors'],
    queryFn: () => getDoctors(),
  })

  const { data: specialties } = useQuery<Specialty[]>({
    queryKey: ['specialties', 'all'],
    queryFn: () => getSpecialties(),
  })

  const specialtyMap = new Map<string, Specialty>()
  if (specialties) { for (const s of specialties) specialtyMap.set(s.id, s) }

  const getSpecialtyLabel = (id: string) => {
    const s = specialtyMap.get(id)
    if (!s) return id
    const labels = (s.labels ?? {}) as Record<string, string>
    return [labels['FR'], labels['EN']].filter(Boolean).join(' / ') || s.slug
  }

  // ── Create / Update mutations ─────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: DoctorForm) => createDoctor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast(t(lang, 'doc_created'), 'success')
      setModalOpen(false)
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Doctor> }) => updateDoctor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast(t(lang, 'doc_updated'), 'success')
      setModalOpen(false)
      setEditing(null)
      setReactivating(null)
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  // ── Activate mutation ─────────────────────────────────────────────────────
  const activateMut = useMutation({
    mutationFn: (id: string) => activateDoctor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast(lang === 'FR' ? 'Médecin activé.' : 'Doctor activated.', 'success')
      setActivatingId(null)
    },
    onError: (err: any) => {
      setActivatingId(null)
      toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error')
    },
  })

  // ── Deactivate mutations ─────────────────────────────────────────────────
  const deactivateCheckMut = useMutation({
    mutationFn: (id: string) => deactivateDoctor(id),
    onSuccess: (data: ActionCheckResult) => {
      if (data.deactivated) {
        queryClient.invalidateQueries({ queryKey: ['doctors'] })
        toast(t(lang, 'doc_deactivated_immediately'), 'success')
      } else {
        setDeactivateCheck(data)
        setDeactivateModalOpen(true)
      }
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  const confirmDeactivateMut = useMutation({
    mutationFn: ({ id, notify, customMessage }: { id: string; notify: boolean; customMessage?: string }) =>
      confirmDeactivateDoctor(id, { notify, customMessage }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      setDeactivateModalOpen(false)
      setDeactivateTarget(null)
      setDeactivateCheck(null)
      if (data.notified && data.notifiedCount > 0) {
        toast((t(lang, 'doc_deactivated_with_notify') as string).replace('%s', String(data.notifiedCount)), 'success')
      } else {
        toast(t(lang, 'doc_deactivated_without_notify'), 'success')
      }
      if (data.notificationErrors?.length > 0) {
        toast((t(lang, 'doc_notification_errors') as string).replace('%s', data.notificationErrors.join(', ')), 'error')
      }
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  // ── Delete mutations ─────────────────────────────────────────────────────
  const deleteCheckMut = useMutation({
    mutationFn: (id: string) => deleteDoctor(id),
    onSuccess: (data: ActionCheckResult) => {
      if (data.deleted) {
        queryClient.invalidateQueries({ queryKey: ['doctors'] })
        queryClient.invalidateQueries({ queryKey: ['specialties'] })
        toast(t(lang, 'doc_deleted_immediately'), 'success')
      } else {
        setDeleteCheck(data)
        setDeleteModalOpen(true)
      }
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  const confirmDeleteMut = useMutation({
    mutationFn: ({ id, notify, customMessage }: { id: string; notify: boolean; customMessage?: string }) =>
      confirmDeleteDoctor(id, { notify, customMessage }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      queryClient.invalidateQueries({ queryKey: ['specialties'] })
      setDeleteModalOpen(false)
      setDeleteTarget(null)
      setDeleteCheck(null)
      if (data.notified && data.notifiedCount > 0) {
        toast((t(lang, 'doc_deleted_with_notify') as string).replace('%s', String(data.notifiedCount)), 'success')
      } else {
        toast(t(lang, 'doc_deleted_without_notify'), 'success')
      }
      if (data.notificationErrors?.length > 0) {
        toast((t(lang, 'doc_notification_errors') as string).replace('%s', data.notificationErrors.join(', ')), 'error')
      }
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  const handleSave = (form: DoctorForm) => {
    if (reactivating) {
      updateMut.mutate({ id: reactivating.id, data: { specialtyId: form.specialtyId, isActive: true } })
    } else if (editing) {
      updateMut.mutate({ id: editing.id, data: form })
    } else {
      createMut.mutate(form)
    }
  }

  const openAdd = () => { setEditing(null); setReactivating(null); setModalOpen(true) }
  const openEdit = (doctor: Doctor) => {
    if (doctor.isActive) { setEditing(doctor); setReactivating(null) }
    else { setReactivating(doctor); setEditing(null) }
    setModalOpen(true)
  }

  const handleActivate = (doctor: Doctor) => {
    const spec = specialtyMap.get(doctor.specialtyId)
    if (!spec?.isActive) {
      // Specialty is inactive — open the reactivate modal to pick a new one
      openEdit(doctor)
      return
    }
    setActivatingId(doctor.id)
    activateMut.mutate(doctor.id)
  }

  const saving = createMut.isPending || updateMut.isPending

  if (isLoading) return <PageLoader />
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-neutral-500">{t(lang, 'errorLoading')}</p>
        <button className="btn-outline" onClick={() => refetch()}>{t(lang, 'tryAgain')}</button>
      </div>
    )
  }

  const sorted = [...(doctors ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
  const active = sorted.filter(d => d.isActive)
  const inactive = sorted.filter(d => !d.isActive)

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t(lang, 'doc_title')}
        subtitle={t(lang, 'doc_subtitle')}
        action={
          <button className="btn-primary" onClick={openAdd}>
            <Plus size={16} />
            {t(lang, 'doc_add')}
          </button>
        }
      />

      {sorted.length === 0 ? (
        <Empty message={t(lang, 'noData')} />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Active doctors */}
          {active.map(doctor => (
            <DoctorCard
              key={doctor.id}
              doctor={doctor}
              specialtyLabel={getSpecialtyLabel(doctor.specialtyId)}
              specialtyIsActive={specialtyMap.get(doctor.specialtyId)?.isActive ?? true}
              lang={lang}
              onEdit={() => openEdit(doctor)}
              onActivate={() => handleActivate(doctor)}
              onDeactivate={() => { setDeactivateTarget(doctor); deactivateCheckMut.mutate(doctor.id) }}
              onDelete={() => { setDeleteTarget(doctor); deleteCheckMut.mutate(doctor.id) }}
              activating={activatingId === doctor.id}
            />
          ))}

          {/* Inactive section divider */}
          {inactive.length > 0 && (
            <>
              <div className="flex items-center gap-3 mt-1">
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
                <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                  {lang === 'FR'
                    ? `${inactive.length} médecin${inactive.length > 1 ? 's' : ''} inactif${inactive.length > 1 ? 's' : ''}`
                    : `${inactive.length} inactive doctor${inactive.length > 1 ? 's' : ''}`}
                </span>
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
              </div>
              {inactive.map(doctor => (
                <DoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  specialtyLabel={getSpecialtyLabel(doctor.specialtyId)}
                  specialtyIsActive={specialtyMap.get(doctor.specialtyId)?.isActive ?? true}
                  lang={lang}
                  onEdit={() => openEdit(doctor)}
                  onActivate={() => handleActivate(doctor)}
                  onDeactivate={() => { setDeactivateTarget(doctor); deactivateCheckMut.mutate(doctor.id) }}
                  onDelete={() => { setDeleteTarget(doctor); deleteCheckMut.mutate(doctor.id) }}
                  activating={activatingId === doctor.id}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Add / Edit / Reactivate modal */}
      <DoctorModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); setReactivating(null) }}
        onSave={handleSave}
        saving={saving}
        reactivateMode={!!reactivating}
        initial={
          reactivating
            ? { name: reactivating.name, bio: reactivating.bio ?? '', specialtyId: reactivating.specialtyId, displayOrder: reactivating.displayOrder }
            : editing
              ? { name: editing.name, bio: editing.bio ?? '', specialtyId: editing.specialtyId, displayOrder: editing.displayOrder }
              : null
        }
        lang={lang}
        specialties={specialties ?? []}
      />

      {/* Deactivate Modal */}
      <ConfirmActionModal
        open={deactivateModalOpen}
        action="deactivate"
        onClose={() => { setDeactivateModalOpen(false); setDeactivateTarget(null); setDeactivateCheck(null) }}
        doctor={deactivateTarget}
        checkResult={deactivateCheck}
        lang={lang}
        confirming={confirmDeactivateMut.isPending}
        onConfirm={(notify, msg) =>
          deactivateTarget && confirmDeactivateMut.mutate({ id: deactivateTarget.id, notify, customMessage: msg })}
      />

      {/* Delete Modal */}
      <ConfirmActionModal
        open={deleteModalOpen}
        action="delete"
        onClose={() => { setDeleteModalOpen(false); setDeleteTarget(null); setDeleteCheck(null) }}
        doctor={deleteTarget}
        checkResult={deleteCheck}
        lang={lang}
        confirming={confirmDeleteMut.isPending}
        onConfirm={(notify, msg) =>
          deleteTarget && confirmDeleteMut.mutate({ id: deleteTarget.id, notify, customMessage: msg })}
      />
    </div>
  )
}