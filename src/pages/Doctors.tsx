import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, RotateCcw, Clock, Loader2, X, AlertCircle,
  Phone, Calendar, User, MessageSquare, Send, CheckCircle,
} from 'lucide-react'
import {
  getDoctors, createDoctor, updateDoctor, deleteDoctor, confirmDeleteDoctor,
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

interface DeleteCheckResult {
  requiresConfirmation?: boolean
  doctorId: string
  doctorName: string
  futureAppointments?: FutureAppointment[]
  futureAppointmentsCount?: number
  deleted?: boolean
  hadFutureAppointments?: boolean
}

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
    if (open) {
      setForm(initial ?? emptyForm())
      setDirty(false)
    }
  }, [open, initial])

  const isEditing = !!initial
  const set = (field: keyof DoctorForm, value: any) => {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
  }

  // Only active specialties available for assignment
  const activeSpecs = [...(specialties ?? [])]
    .filter(s => s.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)

  const title = reactivateMode
    ? (lang === 'FR' ? `Réactiver — ${initial?.name ?? ''}` : `Reactivate — ${initial?.name ?? ''}`)
    : isEditing
      ? `${t(lang, 'edit')} ${initial?.name ?? ''}`
      : t(lang, 'doc_add')

  // For reactivate: specialty may be inactive — user must pick a new active one
  const currentSpecIsInactive = reactivateMode && initial?.specialtyId
    ? !specialties.find(s => s.id === initial.specialtyId)?.isActive
    : false

  const canSave = dirty && !!form.name && !!form.specialtyId
  // In reactivate mode, force picking a specialty if current one is inactive
  const mustPickSpecialty = reactivateMode && currentSpecIsInactive

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-5">

        {/* Warning banner in reactivate mode when specialty is inactive */}
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

        {/* In reactivate mode, name/bio are read-only — user is just fixing specialty */}
        {reactivateMode ? (
          <div className="px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-600 dark:text-neutral-300">
            <span className="font-medium">{form.name}</span>
            {form.bio && <p className="text-xs text-neutral-400 mt-0.5">{form.bio}</p>}
          </div>
        ) : (
          <>
            <Field label={t(lang, 'doc_name')}>
              <input
                className="input h-10"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
              />
            </Field>
            <Field label={t(lang, 'doc_bio')}>
              <textarea
                className="input min-h-[70px] resize-y"
                value={form.bio}
                onChange={e => set('bio', e.target.value)}
              />
            </Field>
          </>
        )}

        <Field
          label={t(lang, 'doc_specialty')}
          hint={mustPickSpecialty
            ? (lang === 'FR' ? 'Requis pour réactiver' : 'Required to reactivate')
            : undefined}
        >
          <select
            className={`input h-10 ${mustPickSpecialty && !form.specialtyId ? 'border-amber-400 dark:border-amber-600' : ''}`}
            value={form.specialtyId}
            onChange={e => set('specialtyId', e.target.value)}
            required
          >
            <option value="">—</option>
            {activeSpecs.map(spec => {
              const labels = (spec.labels ?? {}) as Record<string, string>
              const fr = labels['FR'] ?? ''
              const en = labels['EN'] ?? ''
              const label = fr && en ? `${fr} / ${en}` : fr || en || spec.slug
              return (
                <option key={spec.id} value={spec.id}>{label}</option>
              )
            })}
          </select>
        </Field>

        {!reactivateMode && (
          <Field label={t(lang, 'doc_order')}>
            <input
              type="number"
              min={0}
              className="input h-10"
              value={form.displayOrder}
              onChange={e => set('displayOrder', parseInt(e.target.value) || 0)}
            />
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
function SlotModal({
  open, onClose, onSave, saving, initial, lang,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: SlotForm) => void
  saving: boolean
  initial: SlotForm | null
  lang: 'FR' | 'EN'
}) {
  const [form, setForm] = useState<SlotForm>(emptySlot())
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial ?? emptySlot())
      setDirty(false)
    }
  }, [open, initial])

  const set = (field: keyof SlotForm, value: any) => {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
  }

  return (
    <Modal open={open} onClose={onClose} title={t(lang, 'slot_add')} size="sm">
      <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-5">
        <Field label={t(lang, 'slot_day')}>
          <select
            className="input h-10"
            value={form.dayOfWeek}
            onChange={e => set('dayOfWeek', parseInt(e.target.value))}
          >
            {WEEKDAYS.map(d => (
              <option key={d} value={d}>
                {(t(lang, DAYS_KEY) as string[])[d]}
              </option>
            ))}
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
          <input type="number" min={5} step={5} className="input h-10"
            value={form.slotDurationMinutes}
            onChange={e => set('slotDurationMinutes', parseInt(e.target.value) || 30)} />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {t(lang, 'cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !dirty}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : t(lang, 'save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Smart Delete Modal ─────────────────────────────────────────────────────────
function DeleteDoctorModal({
  open, onClose, doctor, deleteCheck, lang,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  doctor: Doctor | null
  deleteCheck: DeleteCheckResult | null
  lang: 'FR' | 'EN'
  onDelete: (notify: boolean, customMessage?: string) => void
}) {
  const [notify, setNotify] = useState(true)
  const [customMessage, setCustomMessage] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => {
    if (open) {
      setNotify(true)
      setCustomMessage('')
      setShowCustom(false)
    }
  }, [open])

  if (!open || !doctor || !deleteCheck) return null

  const hasFuture = deleteCheck.requiresConfirmation && (deleteCheck.futureAppointments?.length ?? 0) > 0
  const appointments = deleteCheck.futureAppointments ?? []

  const formatDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString(lang === 'FR' ? 'fr-FR' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-neutral-200 dark:border-neutral-800">
        
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            hasFuture
              ? 'bg-red-50 dark:bg-red-950/40'
              : 'bg-amber-50 dark:bg-amber-950/40'
          }`}>
            <Trash2 size={22} className={
              hasFuture
                ? 'text-red-600 dark:text-red-400'
                : 'text-amber-600 dark:text-amber-400'
            } />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
              {hasFuture
                ? (t(lang, 'doc_delete_has_future') as string).replace('%s', String(appointments.length))
                : (t(lang, 'doc_delete_no_appointments') as string).replace('%s', doctor.name)}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {hasFuture
                ? (lang === 'FR' ? 'Ces patients ont des rendez-vous à venir avec ce médecin.' : 'These patients have upcoming appointments with this doctor.')
                : t(lang, 'doc_delete_no_appointments_desc')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 flex-1">
          {/* Future appointments list */}
          {hasFuture && appointments.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
                <Calendar size={14} />
                {t(lang, 'doc_future_appointments')}
                <span className="text-xs text-neutral-400 font-normal">({appointments.length})</span>
              </h3>

              <div className="space-y-2">
                {appointments.map((apt) => (
                  <div key={apt.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                        <User size={14} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                          {apt.patientName}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone size={10} />
                            {apt.patientPhone}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">
                        {formatDate(apt.appointmentDate)}
                      </p>
                      <p className="text-xs text-neutral-400 tabular-nums">{apt.appointmentTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notification options */}
          {hasFuture && (
            <div className="mb-5 space-y-4">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notify}
                    onChange={e => setNotify(e.target.checked)}
                  />
                  <div className="w-10 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <div>
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t(lang, 'doc_delete_notify_patients')}
                  </span>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {lang === 'FR'
                      ? 'Un message WhatsApp sera envoyé à chaque patient'
                      : 'A WhatsApp message will be sent to each patient'}
                  </p>
                </div>
              </div>

              {/* Custom message toggle */}
              {notify && (
                <>
                  <button
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    onClick={() => setShowCustom(!showCustom)}
                  >
                    <MessageSquare size={12} />
                    {showCustom
                      ? (lang === 'FR' ? 'Masquer le message personnalisé' : 'Hide custom message')
                      : t(lang, 'doc_delete_custom_message')}
                  </button>

                  {showCustom && (
                    <textarea
                      className="input min-h-[100px] resize-y text-sm"
                      placeholder={t(lang, 'doc_delete_custom_message_placeholder') as string}
                      value={customMessage}
                      onChange={e => setCustomMessage(e.target.value)}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Summary for immediate delete */}
          {!hasFuture && (
            <div className="mb-5 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
              <CheckCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                {lang === 'FR'
                  ? 'Aucun rendez-vous futur. Le médecin sera supprimé et les rendez-vous passés resteront dans les archives.'
                  : 'No upcoming appointments. The doctor will be deleted and past appointments will remain in records.'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-3">
          <button className="btn-outline" onClick={onClose}>
            {t(lang, 'cancel')}
          </button>
          {hasFuture ? (
            <>
              <button
                className="btn-ghost text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => onDelete(false)}
              >
                {t(lang, 'doc_delete_just_delete')}
              </button>
              <button
                className="btn-primary bg-red-600 hover:bg-red-700"
                disabled={!notify}
                onClick={() => onDelete(true, showCustom ? customMessage : undefined)}
              >
                <Send size={14} />
                {t(lang, 'doc_delete_send_delete')}
              </button>
            </>
          ) : (
            <button
              className="btn-danger"
              onClick={() => onDelete(false)}
            >
              <Trash2 size={14} />
              {t(lang, 'delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Doctor Card ───────────────────────────────────────────────────────────────
function DoctorCard({
  doctor, specialtyLabel, specialtyIsActive, lang,
  onEdit, onDelete,
}: {
  doctor: Doctor
  specialtyLabel: string
  specialtyIsActive: boolean
  lang: 'FR' | 'EN'
  onEdit: () => void
  onDelete: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const days = t(lang, DAYS_KEY) as string[]

  const { data: slots, isLoading: slotsLoading } = useQuery<TimeSlot[]>({
    queryKey: ['timeslots', doctor.id],
    queryFn: () => getTimeSlots(doctor.id),
  })

  const [slotModalOpen, setSlotModalOpen] = useState(false)
  const [editSlot, setEditSlot] = useState<TimeSlot | null>(null)

  const deleteSlotMut = useMutation({
    mutationFn: (id: string) => deleteTimeSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslots', doctor.id] })
      toast(t(lang, 'slot_deleted'), 'success')
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  const createSlotMut = useMutation({
    mutationFn: (data: SlotForm) => createTimeSlot(doctor.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslots', doctor.id] })
      toast(t(lang, 'slot_created'), 'success')
      setSlotModalOpen(false)
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  const updateSlotMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TimeSlot> }) => updateTimeSlot(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslots', doctor.id] })
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

  return (
    <div className={`card p-5 space-y-4 ${!doctor.isActive ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-neutral-800 dark:text-neutral-200">{doctor.name}</h3>
            <ActiveBadge active={doctor.isActive} lang={lang} />
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
            <span className={!specialtyIsActive ? 'text-amber-500 dark:text-amber-400' : ''}>
              {specialtyLabel}
              {!specialtyIsActive && (
                <span className="ml-1">
                  ({lang === 'FR' ? 'spécialité inactive' : 'specialty inactive'})
                </span>
              )}
            </span>
            <span>{t(lang, 'doc_order')}: <span className="tabular-nums">{doctor.displayOrder}</span></span>
          </div>
          {doctor.bio && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{doctor.bio}</p>
          )}
          {/* Warning when doctor is inactive and their specialty is also inactive */}
          {!doctor.isActive && !specialtyIsActive && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle size={11} />
              <span>
                {lang === 'FR'
                  ? 'Spécialité inactive — assignez-en une autre pour réactiver'
                  : 'Specialty inactive — assign another to reactivate'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button className="btn-ghost h-8 w-8 p-0" onClick={onEdit} title={t(lang, 'edit')}>
            <Pencil size={14} />
          </button>
          {doctor.isActive ? (
            <button
              className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
              onClick={onDelete}
              title={lang === 'FR' ? 'Supprimer' : 'Delete'}
            >
              <Trash2 size={14} />
            </button>
          ) : (
            <button
              className="btn-ghost h-8 w-8 p-0 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              onClick={onEdit}
              title={lang === 'FR' ? 'Réactiver' : 'Reactivate'}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Slots — only show for active doctors */}
      {doctor.isActive && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <Clock size={14} />
              {t(lang, 'doc_slots')}
            </div>
            <button className="btn-ghost h-7 px-2 text-xs" onClick={() => { setEditSlot(null); setSlotModalOpen(true) }}>
              <Plus size={12} />
              {t(lang, 'slot_add')}
            </button>
          </div>

          {slotsLoading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-neutral-400">
              <Loader2 size={12} className="animate-spin" />{t(lang, 'loading')}
            </div>
          ) : !slots || slots.length === 0 ? (
            <p className="text-xs text-neutral-400 dark:text-neutral-600 py-2">{t(lang, 'slot_noSlots')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {slots.filter(s => s.isActive).map(slot => (
                <div key={slot.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">{days[slot.dayOfWeek]}</span>
                    <div className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                      {slot.startTime} – {slot.endTime}
                      <span className="ml-2 text-neutral-400">{slot.slotDurationMinutes}min</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button className="btn-ghost h-6 w-6 p-0"
                      onClick={() => { setEditSlot(slot); setSlotModalOpen(true) }}
                      title={t(lang, 'edit')}>
                      <Pencil size={10} />
                    </button>
                    <button className="btn-ghost h-6 w-6 p-0 text-red-400 hover:text-red-600"
                      onClick={() => deleteSlotMut.mutate(slot.id)}
                      title={t(lang, 'delete')}>
                      <X size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SlotModal
        open={slotModalOpen}
        onClose={() => { setSlotModalOpen(false); setEditSlot(null) }}
        onSave={handleSlotSave}
        saving={slotSaving}
        initial={editSlot ? {
          dayOfWeek: editSlot.dayOfWeek,
          startTime: editSlot.startTime,
          endTime: editSlot.endTime,
          slotDurationMinutes: editSlot.slotDurationMinutes,
        } : null}
        lang={lang}
      />
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
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null)
  const [deleteCheckResult, setDeleteCheckResult] = useState<DeleteCheckResult | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  // Fetch ALL doctors (active + inactive)
  const { data: doctors, isLoading, isError, refetch } = useQuery<Doctor[]>({
    queryKey: ['doctors'],
    queryFn: () => getDoctors(),
  })

  const { data: specialties } = useQuery<Specialty[]>({
    queryKey: ['specialties', 'all'],
    queryFn: () => getSpecialties(),
  })

  // Lookup maps
  const specialtyMap = new Map<string, Specialty>()
  if (specialties) {
    for (const s of specialties) specialtyMap.set(s.id, s)
  }

  const getSpecialtyLabel = (id: string) => {
    const s = specialtyMap.get(id)
    if (!s) return id
    const labels = (s.labels ?? {}) as Record<string, string>
    const fr = labels['FR'] ?? ''
    const en = labels['EN'] ?? ''
    return fr && en ? `${fr} / ${en}` : fr || en || s.slug
  }

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

  // Step 1: Check if doctor can be deleted
  const deleteCheckMut = useMutation({
    mutationFn: (id: string) => deleteDoctor(id),
    onSuccess: (data: DeleteCheckResult) => {
      if (data.deleted) {
        // No future appointments → deleted immediately
        queryClient.invalidateQueries({ queryKey: ['doctors'] })
        queryClient.invalidateQueries({ queryKey: ['specialties'] })
        toast(t(lang, 'doc_deleted_immediately'), 'success')
        setDeleteTarget(null)
      } else {
        // Has future appointments → show delete modal
        setDeleteCheckResult(data)
        setDeleteModalOpen(true)
      }
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  // Step 2: Confirm deletion with or without notification
  const confirmDeleteMut = useMutation({
    mutationFn: ({ id, notify, customMessage }: { id: string; notify: boolean; customMessage?: string }) =>
      confirmDeleteDoctor(id, { notify, customMessage }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      queryClient.invalidateQueries({ queryKey: ['specialties'] })
      setDeleteModalOpen(false)
      setDeleteTarget(null)
      setDeleteCheckResult(null)

      if (data.notified && data.notifiedCount > 0) {
        toast((t(lang, 'doc_deleted_with_notify') as string).replace('%s', String(data.notifiedCount)), 'success')
      } else {
        toast(t(lang, 'doc_deleted_without_notify'), 'success')
      }

      // Show error notifications if any
      if (data.notificationErrors?.length > 0) {
        const names = data.notificationErrors.join(', ')
        toast((t(lang, 'doc_notification_errors') as string).replace('%s', names), 'error')
      }
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  const handleSave = (form: DoctorForm) => {
    if (reactivating) {
      updateMut.mutate({
        id: reactivating.id,
        data: {
          specialtyId: form.specialtyId,
          isActive: true,
        },
      })
    } else if (editing) {
      updateMut.mutate({ id: editing.id, data: form })
    } else {
      createMut.mutate(form)
    }
  }

  const handleDeleteClick = (doctor: Doctor) => {
    setDeleteTarget(doctor)
    deleteCheckMut.mutate(doctor.id)
  }

  const handleConfirmDelete = (notify: boolean, customMessage?: string) => {
    if (!deleteTarget) return
    confirmDeleteMut.mutate({ id: deleteTarget.id, notify, customMessage })
  }

  const openAdd = () => { setEditing(null); setReactivating(null); setModalOpen(true) }
  const openEdit = (doctor: Doctor) => {
    if (doctor.isActive) { setEditing(doctor); setReactivating(null) }
    else { setReactivating(doctor); setEditing(null) }
    setModalOpen(true)
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
  const activeCount = sorted.filter(d => d.isActive).length
  const inactiveCount = sorted.filter(d => !d.isActive).length

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
        <div className="flex flex-col gap-4">
          {/* Active doctors */}
          {activeCount > 0 && sorted.filter(d => d.isActive).map(doctor => (
            <DoctorCard
              key={doctor.id}
              doctor={doctor}
              specialtyLabel={getSpecialtyLabel(doctor.specialtyId)}
              specialtyIsActive={specialtyMap.get(doctor.specialtyId)?.isActive ?? true}
              lang={lang}
              onEdit={() => openEdit(doctor)}
              onDelete={() => handleDeleteClick(doctor)}
            />
          ))}

          {/* Inactive doctors section */}
          {inactiveCount > 0 && (
            <>
              <div className="flex items-center gap-3 mt-2">
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
                <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                  {lang === 'FR' ? `${inactiveCount} médecin(s) inactif(s)` : `${inactiveCount} inactive doctor(s)`}
                </span>
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
              </div>
              {sorted.filter(d => !d.isActive).map(doctor => (
                <DoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  specialtyLabel={getSpecialtyLabel(doctor.specialtyId)}
                  specialtyIsActive={specialtyMap.get(doctor.specialtyId)?.isActive ?? true}
                  lang={lang}
                  onEdit={() => openEdit(doctor)}
                  onDelete={() => handleDeleteClick(doctor)}
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
          reactivating ? {
            name: reactivating.name,
            bio: reactivating.bio ?? '',
            specialtyId: reactivating.specialtyId,
            displayOrder: reactivating.displayOrder,
          } : editing ? {
            name: editing.name,
            bio: editing.bio ?? '',
            specialtyId: editing.specialtyId,
            displayOrder: editing.displayOrder,
          } : null
        }
        lang={lang}
        specialties={specialties ?? []}
      />

      {/* Smart Delete Modal */}
      <DeleteDoctorModal
        open={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteTarget(null); setDeleteCheckResult(null) }}
        doctor={deleteTarget}
        deleteCheck={deleteCheckResult}
        lang={lang}
        onDelete={handleConfirmDelete}
      />
    </div>
  )
}