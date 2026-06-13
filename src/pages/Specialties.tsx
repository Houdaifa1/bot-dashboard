import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, RotateCcw, Loader2, ToggleLeft } from 'lucide-react'
import { getSpecialties, createSpecialty, updateSpecialty, deleteSpecialty, hardDeleteSpecialty } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import { PageHeader, PageLoader, Modal, ConfirmDialog, Empty, Field } from '../components/ui'
import type { Specialty } from '../types'

interface SpecialtyGroup {
  slug: string
  displayOrder: number
  fr: Specialty | null
  en: Specialty | null
}

function groupBySlug(specialties: Specialty[]): SpecialtyGroup[] {
  const map = new Map<string, SpecialtyGroup>()
  for (const spec of specialties) {
    const existing = map.get(spec.slug)
    if (existing) {
      existing.displayOrder = spec.displayOrder
      if (spec.language === 'FR') existing.fr = spec
      else if (spec.language === 'EN') existing.en = spec
    } else {
      map.set(spec.slug, {
        slug: spec.slug,
        displayOrder: spec.displayOrder,
        fr: spec.language === 'FR' ? spec : null,
        en: spec.language === 'EN' ? spec : null,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.displayOrder - b.displayOrder)
}

interface GroupForm {
  frLabel: string
  enLabel: string
  slug: string
  displayOrder: number
}

const emptyForm = (): GroupForm => ({
  frLabel: '',
  enLabel: '',
  slug: '',
  displayOrder: 0,
})

function SpecialtyModal({
  open,
  onClose,
  onSave,
  saving,
  initial,
  lang,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: GroupForm) => void
  saving: boolean
  initial: GroupForm | null
  lang: 'FR' | 'EN'
}) {
  const [form, setForm] = useState<GroupForm>(emptyForm())
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial ?? emptyForm())
      setDirty(false)
    }
  }, [open, initial])

  const set = (field: keyof GroupForm, value: any) => {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
  }

  const isEditing = !!initial

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? `${t(lang, 'edit')} ${initial?.slug ?? ''}` : t(lang, 'spec_add')}
      size="md"
    >
      <form
        onSubmit={e => { e.preventDefault(); onSave(form) }}
        className="space-y-5"
      >
        {/* FR */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={`${t(lang, 'msg_fr')} — ${t(lang, 'spec_label')}`}>
            <input
              className="input h-10"
              value={form.frLabel}
              onChange={e => set('frLabel', e.target.value)}
              required
            />
          </Field>
          <Field label={`${t(lang, 'msg_en')} — ${t(lang, 'spec_label')}`}>
            <input
              className="input h-10"
              value={form.enLabel}
              onChange={e => set('enLabel', e.target.value)}
              required
            />
          </Field>
        </div>

        <Field
          label={t(lang, 'spec_slug')}
          hint={t(lang, 'spec_slug_hint')}
        >
          <input
            className="input h-10 font-mono text-xs"
            value={form.slug}
            onChange={e => set('slug', e.target.value)}
            required
          />
        </Field>

        <Field label={t(lang, 'spec_order')}>
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
            disabled={saving || !dirty || !form.frLabel || !form.enLabel || !form.slug}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : t(lang, 'save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function SpecialtiesPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SpecialtyGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; fr: Specialty | null; en: Specialty | null } | null>(null)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<{ slug: string; fr: Specialty | null; en: Specialty | null } | null>(null)

  const { data: specialties, isLoading, isError, refetch } = useQuery<Specialty[]>({
    queryKey: ['specialties', 'all'],
    queryFn: () => getSpecialties(),
  })

  const createMut = useMutation({
    mutationFn: (data: GroupForm) =>
      Promise.all([
        createSpecialty({ label: data.frLabel, slug: data.slug, language: 'FR', displayOrder: data.displayOrder }),
        createSpecialty({ label: data.enLabel, slug: data.slug, language: 'EN', displayOrder: data.displayOrder }),
      ]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] })
      toast(t(lang, 'spec_created'), 'success')
      setModalOpen(false)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const updateMut = useMutation({
    mutationFn: (payload: { id: string; data: Partial<Specialty> }[]) =>
      Promise.all(payload.map(p => updateSpecialty(p.id, p.data))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] })
      toast(t(lang, 'spec_updated'), 'success')
      setModalOpen(false)
      setEditing(null)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map(id => deleteSpecialty(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] })
      toast(t(lang, 'spec_deleted'), 'success')
      setDeleteTarget(null)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const hardDeleteMut = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map(id => hardDeleteSpecialty(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] })
      toast(t(lang, 'spec_deleted'), 'success')
      setHardDeleteTarget(null)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const handleSave = (form: GroupForm) => {
    if (editing) {
      const updates: { id: string; data: Partial<Specialty> }[] = []
      const creates: Promise<any>[] = []
      if (editing.fr) {
        updates.push({
          id: editing.fr.id,
          data: { label: form.frLabel, slug: form.slug, displayOrder: form.displayOrder },
        })
      } else {
        creates.push(
          createSpecialty({ label: form.frLabel, slug: form.slug, language: 'FR', displayOrder: form.displayOrder })
        )
      }
      if (editing.en) {
        updates.push({
          id: editing.en.id,
          data: { label: form.enLabel, slug: form.slug, displayOrder: form.displayOrder },
        })
      } else {
        creates.push(
          createSpecialty({ label: form.enLabel, slug: form.slug, language: 'EN', displayOrder: form.displayOrder })
        )
      }
      if (updates.length > 0 && creates.length > 0) {
        // Both updates and creates needed
        Promise.all(creates).then(() => {
          updateMut.mutate(updates)
        })
      } else if (updates.length > 0) {
        updateMut.mutate(updates)
      } else {
        // Only creates
        Promise.all(creates).then(() => {
          queryClient.invalidateQueries({ queryKey: ['specialties'] })
          toast(t(lang, 'spec_updated'), 'success')
          setModalOpen(false)
          setEditing(null)
        })
      }
    } else {
      createMut.mutate(form)
    }
  }

  const handleReactivate = (group: SpecialtyGroup) => {
    const updates: { id: string; data: Partial<Specialty> }[] = []
    if (group.fr && !group.fr.isActive) updates.push({ id: group.fr.id, data: { isActive: true } })
    if (group.en && !group.en.isActive) updates.push({ id: group.en.id, data: { isActive: true } })
    if (updates.length > 0) {
      updateMut.mutate(updates)
    }
  }

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (group: SpecialtyGroup) => {
    setEditing(group)
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

  const groups = groupBySlug(specialties ?? [])

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t(lang, 'spec_title')}
        subtitle={t(lang, 'spec_subtitle')}
        action={
          <button className="btn-primary" onClick={openAdd}>
            <Plus size={16} />
            {t(lang, 'spec_add')}
          </button>
        }
      />

      {groups.length === 0 ? (
        <Empty message={t(lang, 'noData')} />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(group => {
            const isActive = group.fr?.isActive !== false && group.en?.isActive !== false
            const bothExist = group.fr && group.en

            return (
              <div key={group.slug} className="card p-5 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs font-mono font-medium text-neutral-600 dark:text-neutral-400">
                      {group.slug}
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      {t(lang, 'spec_order')}: <span className="tabular-nums">{group.displayOrder}</span>
                    </span>
                    {isActive
                      ? <span className="badge-success">{t(lang, 'active')}</span>
                      : <span className="badge-neutral">{t(lang, 'inactive')}</span>
                    }
                    {!bothExist && (
                      <span className="badge-warning text-[10px]">
                        {t(lang, 'spec_missing_en')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="btn-ghost h-8 w-8 p-0"
                      onClick={() => openEdit(group)}
                      title={t(lang, 'edit')}
                    >
                      <Pencil size={14} />
                    </button>
                    {isActive ? (
                      <>
                        <button
                          className="btn-ghost h-8 w-8 p-0 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                          onClick={() => setDeleteTarget({ slug: group.slug, fr: group.fr, en: group.en })}
                          title={lang === 'FR' ? 'Désactiver' : 'Deactivate'}
                        >
                          <ToggleLeft size={14} />
                        </button>
                        <button
                          className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                          onClick={() => setHardDeleteTarget({ slug: group.slug, fr: group.fr, en: group.en })}
                          title={lang === 'FR' ? 'Supprimer définitivement' : 'Delete permanently'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-ghost h-8 w-8 p-0 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                        onClick={() => handleReactivate(group)}
                        title={t(lang, 'spec_reactivate')}
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* FR / EN side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                      {t(lang, 'msg_fr')}
                    </span>
                    <p className={`text-sm font-medium ${group.fr ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-300 dark:text-neutral-600 italic'}`}>
                      {group.fr?.label ?? t(lang, 'toTranslate')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                      {t(lang, 'msg_en')}
                    </span>
                    <p className={`text-sm font-medium ${group.en ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-300 dark:text-neutral-600 italic'}`}>
                      {group.en?.label ?? t(lang, 'toTranslateEn')}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      <SpecialtyModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSave={handleSave}
        saving={saving}
        initial={editing ? {
          frLabel: editing.fr?.label ?? '',
          enLabel: editing.en?.label ?? '',
          slug: editing.slug,
          displayOrder: editing.displayOrder,
        } : null}
        lang={lang}
      />

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget
          if (!target) return
          const ids: string[] = []
          if (target.fr) ids.push(target.fr.id)
          if (target.en) ids.push(target.en.id)
          if (ids.length > 0) deleteMut.mutate(ids)
        }}
        lang={lang}
        loading={deleteMut.isPending}
      />

      {/* Permanent delete confirm */}
      <ConfirmDialog
        open={!!hardDeleteTarget}
        onClose={() => setHardDeleteTarget(null)}
        onConfirm={() => {
          const target = hardDeleteTarget
          if (!target) return
          const ids: string[] = []
          if (target.fr) ids.push(target.fr.id)
          if (target.en) ids.push(target.en.id)
          if (ids.length > 0) hardDeleteMut.mutate(ids)
        }}
        lang={lang}
        loading={hardDeleteMut.isPending}
        permanent
      />
    </div>
  )
}
