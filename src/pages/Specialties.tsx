import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, RotateCcw, Loader2, ToggleLeft } from 'lucide-react'
import { getSpecialties, createSpecialty, updateSpecialty, deleteSpecialty, hardDeleteSpecialty } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import { PageHeader, PageLoader, Modal, ConfirmDialog, Empty, Field } from '../components/ui'
import type { Specialty } from '../types'

interface SpecialtyForm {
  frLabel: string
  enLabel: string
  slug: string
  displayOrder: number
}

const emptyForm = (): SpecialtyForm => ({
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
  onSave: (data: SpecialtyForm) => void
  saving: boolean
  initial: SpecialtyForm | null
  lang: 'FR' | 'EN'
}) {
  const [form, setForm] = useState<SpecialtyForm>(emptyForm())
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial ?? emptyForm())
      setDirty(false)
    }
  }, [open, initial])

  const set = (field: keyof SpecialtyForm, value: any) => {
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
  const [editing, setEditing] = useState<Specialty | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Specialty | null>(null)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Specialty | null>(null)

  const { data: specialties, isLoading, isError, refetch } = useQuery<Specialty[]>({
    queryKey: ['specialties', 'all'],
    queryFn: () => getSpecialties(),
  })

  const createMut = useMutation({
    mutationFn: (data: SpecialtyForm) =>
      createSpecialty({
        labels: { FR: data.frLabel, EN: data.enLabel },
        slug: data.slug,
        displayOrder: data.displayOrder,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] })
      toast(t(lang, 'spec_created'), 'success')
      setModalOpen(false)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string; labels: Record<string, string>; slug: string; displayOrder: number }) =>
      updateSpecialty(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] })
      toast(t(lang, 'spec_updated'), 'success')
      setModalOpen(false)
      setEditing(null)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSpecialty(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] })
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast(t(lang, 'spec_deleted'), 'success')
      setDeleteTarget(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? t(lang, 'errorSaving')
      toast(msg, 'error')
    },
  })

  const hardDeleteMut = useMutation({
    mutationFn: (id: string) => hardDeleteSpecialty(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] })
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast(t(lang, 'spec_hard_deleted'), 'success')
      setHardDeleteTarget(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? t(lang, 'errorSaving')
      toast(msg, 'error')
    },
  })

  const handleSave = (form: SpecialtyForm) => {
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        labels: { FR: form.frLabel, EN: form.enLabel },
        slug: form.slug,
        displayOrder: form.displayOrder,
      })
    } else {
      createMut.mutate(form)
    }
  }

  const reactivateMut = useMutation({
    mutationFn: (id: string) => updateSpecialty(id, { isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] })
      toast(t(lang, 'spec_reactivated'), 'success')
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const handleReactivate = (spec: Specialty) => {
    reactivateMut.mutate(spec.id)
  }

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (spec: Specialty) => {
    setEditing(spec)
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

  const sorted = [...(specialties ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)

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

      {sorted.length === 0 ? (
        <Empty message={t(lang, 'noData')} />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map(spec => {
            const labels = (spec.labels ?? {}) as Record<string, string>
            const frLabel = labels['FR'] ?? ''
            const enLabel = labels['EN'] ?? ''

            return (
              <div key={spec.id} className="card p-5 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs font-mono font-medium text-neutral-600 dark:text-neutral-400">
                      {spec.slug}
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      {t(lang, 'spec_order')}: <span className="tabular-nums">{spec.displayOrder}</span>
                    </span>
                    {spec.isActive
                      ? <span className="badge-success">{t(lang, 'active')}</span>
                      : <span className="badge-neutral">{t(lang, 'inactive')}</span>
                    }
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="btn-ghost h-8 w-8 p-0"
                      onClick={() => openEdit(spec)}
                      title={t(lang, 'edit')}
                    >
                      <Pencil size={14} />
                    </button>
                    {spec.isActive ? (
                      <>
                        <button
                          className="btn-ghost h-8 w-8 p-0 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                          onClick={() => setDeleteTarget(spec)}
                          title={lang === 'FR' ? 'Désactiver' : 'Deactivate'}
                        >
                          <ToggleLeft size={14} />
                        </button>
                        <button
                          className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                          onClick={() => setHardDeleteTarget(spec)}
                          title={lang === 'FR' ? 'Supprimer définitivement' : 'Delete permanently'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-ghost h-8 w-8 p-0 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                        onClick={() => handleReactivate(spec)}
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
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      {frLabel || '…'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                      {t(lang, 'msg_en')}
                    </span>
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      {enLabel || '…'}
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
          frLabel: ((editing.labels ?? {}) as Record<string, string>)['FR'] ?? '',
          enLabel: ((editing.labels ?? {}) as Record<string, string>)['EN'] ?? '',
          slug: editing.slug,
          displayOrder: editing.displayOrder,
        } : null}
        lang={lang}
      />

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        lang={lang}
        loading={deleteMut.isPending}
      />

      {/* Permanent delete confirm */}
      <ConfirmDialog
        open={!!hardDeleteTarget}
        onClose={() => setHardDeleteTarget(null)}
        onConfirm={() => hardDeleteTarget && hardDeleteMut.mutate(hardDeleteTarget.id)}
        lang={lang}
        loading={hardDeleteMut.isPending}
        permanent
      />
    </div>
  )
}