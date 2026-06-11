import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, RotateCcw, Clock, Loader2, X
} from 'lucide-react'
import {
  getDoctors, createDoctor, updateDoctor, deleteDoctor,
  getSpecialties,
  getTimeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot,
} from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import {
  PageHeader, PageLoader, Modal, ConfirmDialog, Empty,
  ActiveBadge, Field,
} from '../components/ui'
import type { Doctor, Specialty, TimeSlot } from '../types'

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

// ── Doctor Modal ──────────────────────────────────────────────────────────────
function DoctorModal({
  open, onClose, onSave, saving, initial, lang, specialties,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: DoctorForm) => void
  saving: boolean
  initial: DoctorForm | null
  lang: 'FR' | 'EN'
  specialties: Specialty[]
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

  const title = isEditing
    ? `${t(lang, 'edit')} ${initial?.name ?? ''}`
    : t(lang, 'doc_add')

  // Group specialties by slug → show "FR label / EN label" as option label
  const specMap = new Map<string, Specialty[]>()
  for (const s of specialties) {
    const arr = specMap.get(s.slug) ?? []
    arr.push(s)
    specMap.set(s.slug, arr)
  }
  // Sort by displayOrder of first in group
  const specGroups = Array.from(specMap.entries()).sort((a, b) => {
    const oa = specialties.find(s => s.id === a[1][0]?.id)?.displayOrder ?? 0
    const ob = specialties.find(s => s.id === b[1][0]?.id)?.displayOrder ?? 0
    return oa - ob
  })

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-5">
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

        <Field label={t(lang, 'doc_specialty')}>
          <select
            className="input h-10"
            value={form.specialtyId}
            onChange={e => set('specialtyId', e.target.value)}
            required
          >
            <option value="">—</option>
            {specGroups.map(([slug, specs]) => {
              const fr = specs.find(s => s.language === 'FR')
              const en = specs.find(s => s.language === 'EN')
              const label = fr
                ? en
                  ? `${fr.label} / ${en.label}`
                  : fr.label
                : en?.label ?? slug
              // Use the first active specialty's ID, or the first one
              const id = specs.find(s => s.isActive)?.id ?? specs[0]?.id
              if (!id) return null
              return (
                <option key={slug} value={id}>
                  {label}
                </option>
              )
            })}
          </select>
        </Field>

        <Field label={t(lang, 'doc_order')}>
          <input
            type="number"
            min={0}
            className="input h-10"
            value={form.displayOrder}
            onChange={e => set('displayOrder', parseInt(e.target.value) || 0)}
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {t(lang, 'cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !dirty || !form.name || !form.specialtyId}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : t(lang, 'save')}
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
            <input
              type="time"
              className="input h-10"
              value={form.startTime}
              onChange={e => set('startTime', e.target.value)}
              required
            />
          </Field>
          <Field label={t(lang, 'slot_end')}>
            <input
              type="time"
              className="input h-10"
              value={form.endTime}
              onChange={e => set('endTime', e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label={t(lang, 'slot_duration')}>
          <input
            type="number"
            min={5}
            step={5}
            className="input h-10"
            value={form.slotDurationMinutes}
            onChange={e => set('slotDurationMinutes', parseInt(e.target.value) || 30)}
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {t(lang, 'cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !dirty}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : t(lang, 'save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Doctor Card with inline slots ─────────────────────────────────────────────
function DoctorCard({
  doctor,
  specialtyLabel,
  lang,
  onEdit,
  onDelete,
  onReactivate,
}: {
  doctor: Doctor
  specialtyLabel: string
  lang: 'FR' | 'EN'
  onEdit: () => void
  onDelete: () => void
  onReactivate: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const days = t(lang, DAYS_KEY) as string[]

  const { data: slots, isLoading: slotsLoading } = useQuery<TimeSlot[]>({
    queryKey: ['timeslots', doctor.id],
    queryFn: () => getTimeSlots(doctor.id),
  })

  const deleteSlotMut = useMutation({
    mutationFn: (id: string) => deleteTimeSlot(doctor.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslots', doctor.id] })
      toast(t(lang, 'slot_deleted'), 'success')
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const [slotModalOpen, setSlotModalOpen] = useState(false)
  const [editSlot, setEditSlot] = useState<TimeSlot | null>(null)

  const createSlotMut = useMutation({
    mutationFn: (data: SlotForm) => createTimeSlot(doctor.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslots', doctor.id] })
      toast(t(lang, 'slot_created'), 'success')
      setSlotModalOpen(false)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const updateSlotMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TimeSlot> }) =>
      updateTimeSlot(doctor.id, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslots', doctor.id] })
      toast(t(lang, 'slot_updated'), 'success')
      setSlotModalOpen(false)
      setEditSlot(null)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const handleSlotSave = (form: SlotForm) => {
    if (editSlot) {
      updateSlotMut.mutate({ id: editSlot.id, data: form })
    } else {
      createSlotMut.mutate(form)
    }
  }

  const handleOpenSlotAdd = () => {
    setEditSlot(null)
    setSlotModalOpen(true)
  }

  const handleOpenSlotEdit = (slot: TimeSlot) => {
    setEditSlot(slot)
    setSlotModalOpen(true)
  }

  const slotSaving = createSlotMut.isPending || updateSlotMut.isPending

  return (
    <div className="card p-5 space-y-4">
      {/* Doctor header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-neutral-800 dark:text-neutral-200">
              {doctor.name}
            </h3>
            <ActiveBadge active={doctor.isActive} lang={lang} />
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{specialtyLabel}</span>
            <span>
              {t(lang, 'doc_order')}: <span className="tabular-nums">{doctor.displayOrder}</span>
            </span>
          </div>
          {doctor.bio && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{doctor.bio}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost h-8 w-8 p-0"
            onClick={onEdit}
            title={t(lang, 'edit')}
          >
            <Pencil size={14} />
          </button>
          {doctor.isActive ? (
            <button
              className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
              onClick={onDelete}
              title={t(lang, 'delete')}
            >
              <Trash2 size={14} />
            </button>
          ) : (
            <button
              className="btn-ghost h-8 w-8 p-0 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              onClick={onReactivate}
              title={t(lang, 'spec_reactivate')}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Time slots section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <Clock size={14} />
            {t(lang, 'doc_slots')}
          </div>
          {doctor.isActive && (
            <button className="btn-ghost h-7 px-2 text-xs" onClick={handleOpenSlotAdd}>
              <Plus size={12} />
              {t(lang, 'slot_add')}
            </button>
          )}
        </div>

        {slotsLoading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-neutral-400">
            <Loader2 size={12} className="animate-spin" />
            {t(lang, 'loading')}
          </div>
        ) : !slots || slots.length === 0 ? (
          <p className="text-xs text-neutral-400 dark:text-neutral-600 py-2">
            {t(lang, 'slot_noSlots')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {slots.filter(s => s.isActive).map(slot => (
              <div
                key={slot.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {days[slot.dayOfWeek]}
                  </span>
                  <div className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {slot.startTime} – {slot.endTime}
                    <span className="ml-2 text-neutral-400">
                      {slot.slotDurationMinutes}min
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    className="btn-ghost h-6 w-6 p-0"
                    onClick={() => handleOpenSlotEdit(slot)}
                    title={t(lang, 'edit')}
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    className="btn-ghost h-6 w-6 p-0 text-red-400 hover:text-red-600"
                    onClick={() => deleteSlotMut.mutate(slot.id)}
                    title={t(lang, 'delete')}
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slot modal */}
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
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null)

  const { data: doctors, isLoading, isError, refetch } = useQuery<Doctor[]>({
    queryKey: ['doctors'],
    queryFn: () => getDoctors(),
  })

  const { data: specialties } = useQuery<Specialty[]>({
    queryKey: ['specialties', 'all'],
    queryFn: () => getSpecialties(),
  })

  // Build specialty label lookup: specialtyId → "FR label / EN label"
  const specialtyLabelMap = new Map<string, string>()
  if (specialties) {
    // Group by slug first
    const slugMap = new Map<string, Specialty[]>()
    for (const s of specialties) {
      const arr = slugMap.get(s.slug) ?? []
      arr.push(s)
      slugMap.set(s.slug, arr)
    }
    // For each slug, build a display label
    for (const [, specs] of slugMap) {
      const fr = specs.find(s => s.language === 'FR')
      const en = specs.find(s => s.language === 'EN')
      const display = fr
        ? en
          ? `${fr.label} / ${en.label}`
          : fr.label
        : en?.label ?? specs[0]?.slug ?? '?'
      for (const spec of specs) {
        specialtyLabelMap.set(spec.id, display)
      }
    }
  }

  const createMut = useMutation({
    mutationFn: (data: DoctorForm) => createDoctor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast(t(lang, 'doc_created'), 'success')
      setModalOpen(false)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Doctor> }) =>
      updateDoctor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast(t(lang, 'doc_updated'), 'success')
      setModalOpen(false)
      setEditing(null)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDoctor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast(t(lang, 'doc_deleted'), 'success')
      setDeleteTarget(null)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const handleSave = (form: DoctorForm) => {
    if (editing) {
      updateMut.mutate({ id: editing.id, data: form })
    } else {
      createMut.mutate(form)
    }
  }

  const handleReactivate = (doctor: Doctor) => {
    updateMut.mutate({ id: doctor.id, data: { isActive: true } })
  }

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (doctor: Doctor) => {
    setEditing(doctor)
    setModalOpen(true)
  }

  const saving = createMut.isPending || updateMut.isPending

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
        title={t(lang, 'doc_title')}
        subtitle={t(lang, 'doc_subtitle')}
        action={
          <button className="btn-primary" onClick={openAdd}>
            <Plus size={16} />
            {t(lang, 'doc_add')}
          </button>
        }
      />

      {!doctors || doctors.length === 0 ? (
        <Empty message={t(lang, 'noData')} />
      ) : (
        <div className="flex flex-col gap-4">
          {[...doctors].sort((a, b) => a.displayOrder - b.displayOrder).map(doctor => (
            <DoctorCard
              key={doctor.id}
              doctor={doctor}
              specialtyLabel={specialtyLabelMap.get(doctor.specialtyId) ?? doctor.specialtyId}
              lang={lang}
              onEdit={() => openEdit(doctor)}
              onDelete={() => setDeleteTarget(doctor)}
              onReactivate={() => handleReactivate(doctor)}
            />
          ))}
        </div>
      )}

      {/* Doctor modal */}
      <DoctorModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSave={handleSave}
        saving={saving}
        initial={editing ? {
          name: editing.name,
          bio: editing.bio ?? '',
          specialtyId: editing.specialtyId,
          displayOrder: editing.displayOrder,
        } : null}
        lang={lang}
        specialties={specialties ?? []}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        lang={lang}
        loading={deleteMut.isPending}
      />
    </div>
  )
}