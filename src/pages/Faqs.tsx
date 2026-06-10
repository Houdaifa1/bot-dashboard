import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, RotateCcw, Loader2 } from 'lucide-react'
import { getFaqs, createFaq, updateFaq, deleteFaq } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import { PageHeader, PageLoader, Modal, ConfirmDialog, Empty, Field } from '../components/ui'
import type { FAQ } from '../types'

interface FAQGroup {
  displayOrder: number
  fr: FAQ | null
  en: FAQ | null
}

function groupByOrder(faqs: FAQ[]): FAQGroup[] {
  const map = new Map<number, FAQGroup>()
  for (const faq of faqs) {
    const existing = map.get(faq.displayOrder)
    if (existing) {
      if (faq.language === 'FR') existing.fr = faq
      else if (faq.language === 'EN') existing.en = faq
    } else {
      map.set(faq.displayOrder, {
        displayOrder: faq.displayOrder,
        fr: faq.language === 'FR' ? faq : null,
        en: faq.language === 'EN' ? faq : null,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.displayOrder - b.displayOrder)
}

interface GroupForm {
  frQuestion: string
  frAnswer: string
  frKeywords: string
  enQuestion: string
  enAnswer: string
  enKeywords: string
  displayOrder: number
}

const emptyForm = (): GroupForm => ({
  frQuestion: '',
  frAnswer: '',
  frKeywords: '',
  enQuestion: '',
  enAnswer: '',
  enKeywords: '',
  displayOrder: 0,
})

function FaqModal({
  open, onClose, onSave, saving, initial, lang,
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
      title={isEditing ? `${t(lang, 'edit')} #${initial?.displayOrder}` : t(lang, 'faq_add')}
      size="lg"
    >
      <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-5">
        {/* FR */}
        <div className="card p-4 space-y-4 bg-neutral-50/50 dark:bg-neutral-800/30 border-neutral-100 dark:border-neutral-800">
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
            {t(lang, 'msg_fr')}
          </p>
          <Field label={t(lang, 'faq_question')}>
            <input
              className="input h-10"
              value={form.frQuestion}
              onChange={e => set('frQuestion', e.target.value)}
              required
            />
          </Field>
          <Field label={t(lang, 'faq_answer')}>
            <textarea
              className="input min-h-[80px] resize-y text-sm leading-relaxed"
              value={form.frAnswer}
              onChange={e => set('frAnswer', e.target.value)}
              required
            />
          </Field>
          <Field
            label={t(lang, 'faq_keywords')}
            hint={t(lang, 'faq_keywords_hint')}
          >
            <input
              className="input h-10"
              value={form.frKeywords}
              onChange={e => set('frKeywords', e.target.value)}
            />
          </Field>
        </div>

        {/* EN */}
        <div className="card p-4 space-y-4 bg-neutral-50/50 dark:bg-neutral-800/30 border-neutral-100 dark:border-neutral-800">
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
            {t(lang, 'msg_en')}
          </p>
          <Field label={t(lang, 'faq_question')}>
            <input
              className="input h-10"
              value={form.enQuestion}
              onChange={e => set('enQuestion', e.target.value)}
              required
            />
          </Field>
          <Field label={t(lang, 'faq_answer')}>
            <textarea
              className="input min-h-[80px] resize-y text-sm leading-relaxed"
              value={form.enAnswer}
              onChange={e => set('enAnswer', e.target.value)}
              required
            />
          </Field>
          <Field
            label={t(lang, 'faq_keywords')}
            hint={t(lang, 'faq_keywords_hint')}
          >
            <input
              className="input h-10"
              value={form.enKeywords}
              onChange={e => set('enKeywords', e.target.value)}
            />
          </Field>
        </div>

        <Field label={t(lang, 'faq_order')}>
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
            disabled={saving || !dirty || !form.frQuestion || !form.frAnswer || !form.enQuestion || !form.enAnswer}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : t(lang, 'save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function FaqsPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FAQGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ order: number; fr: FAQ | null; en: FAQ | null } | null>(null)

  const { data: faqs, isLoading, isError, refetch } = useQuery<FAQ[]>({
    queryKey: ['faqs'],
    queryFn: () => getFaqs(),
  })

  const createMut = useMutation({
    mutationFn: (data: GroupForm) =>
      Promise.all([
        createFaq({
          question: data.frQuestion,
          answer: data.frAnswer,
          keywords: data.frKeywords ? data.frKeywords.split(',').map(k => k.trim()) : [],
          language: 'FR',
          displayOrder: data.displayOrder,
        }),
        createFaq({
          question: data.enQuestion,
          answer: data.enAnswer,
          keywords: data.enKeywords ? data.enKeywords.split(',').map(k => k.trim()) : [],
          language: 'EN',
          displayOrder: data.displayOrder,
        }),
      ]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] })
      toast(t(lang, 'faq_created'), 'success')
      setModalOpen(false)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const updateMut = useMutation({
    mutationFn: (payload: { id: string; data: Partial<FAQ> }[]) =>
      Promise.all(payload.map(p => updateFaq(p.id, p.data))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] })
      toast(t(lang, 'faq_updated'), 'success')
      setModalOpen(false)
      setEditing(null)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map(id => deleteFaq(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] })
      toast(t(lang, 'faq_deleted'), 'success')
      setDeleteTarget(null)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const handleSave = (form: GroupForm) => {
    if (editing) {
      const updates: { id: string; data: Partial<FAQ> }[] = []
      if (editing.fr) {
        updates.push({
          id: editing.fr.id,
          data: {
            question: form.frQuestion,
            answer: form.frAnswer,
            keywords: form.frKeywords ? form.frKeywords.split(',').map(k => k.trim()) : [],
            displayOrder: form.displayOrder,
          },
        })
      }
      if (editing.en) {
        updates.push({
          id: editing.en.id,
          data: {
            question: form.enQuestion,
            answer: form.enAnswer,
            keywords: form.enKeywords ? form.enKeywords.split(',').map(k => k.trim()) : [],
            displayOrder: form.displayOrder,
          },
        })
      }
      if (updates.length > 0) {
        updateMut.mutate(updates)
      } else {
        queryClient.invalidateQueries({ queryKey: ['faqs'] })
        toast(t(lang, 'faq_updated'), 'success')
        setModalOpen(false)
        setEditing(null)
      }
    } else {
      createMut.mutate(form)
    }
  }

  const handleReactivate = (group: FAQGroup) => {
    const updates: { id: string; data: Partial<FAQ> }[] = []
    if (group.fr && !group.fr.isActive) updates.push({ id: group.fr.id, data: { isActive: true } })
    if (group.en && !group.en.isActive) updates.push({ id: group.en.id, data: { isActive: true } })
    if (updates.length > 0) updateMut.mutate(updates)
  }

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (group: FAQGroup) => {
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

  const groups = groupByOrder(faqs ?? [])

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t(lang, 'faq_title')}
        subtitle={t(lang, 'faq_subtitle')}
        action={
          <button className="btn-primary" onClick={openAdd}>
            <Plus size={16} />
            {t(lang, 'faq_add')}
          </button>
        }
      />

      {groups.length === 0 ? (
        <Empty message={t(lang, 'noData')} />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(group => {
            const isActive = group.fr?.isActive !== false && group.en?.isActive !== false
            const bothExist = group.fr && group.en

            return (
              <div key={group.displayOrder} className="card p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs font-mono font-medium text-neutral-600 dark:text-neutral-400">
                      #{group.displayOrder}
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
                      <button
                        className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                        onClick={() => setDeleteTarget({ order: group.displayOrder, fr: group.fr, en: group.en })}
                        title={t(lang, 'delete')}
                      >
                        <Trash2 size={14} />
                      </button>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* FR */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                      {t(lang, 'msg_fr')}
                    </span>
                    {group.fr ? (
                      <>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 leading-snug">
                          {group.fr.question}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                          {group.fr.answer}
                        </p>
                        {group.fr.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {group.fr.keywords.map(k => (
                              <span key={k} className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] text-neutral-500 dark:text-neutral-400">
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-neutral-300 dark:text-neutral-600 italic">
                        {t(lang, 'toTranslate')}
                      </p>
                    )}
                  </div>

                  {/* EN */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                      {t(lang, 'msg_en')}
                    </span>
                    {group.en ? (
                      <>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 leading-snug">
                          {group.en.question}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                          {group.en.answer}
                        </p>
                        {group.en.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {group.en.keywords.map(k => (
                              <span key={k} className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] text-neutral-500 dark:text-neutral-400">
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-neutral-300 dark:text-neutral-600 italic">
                        {t(lang, 'toTranslateEn')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      <FaqModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSave={handleSave}
        saving={saving}
        initial={editing ? {
          frQuestion: editing.fr?.question ?? '',
          frAnswer: editing.fr?.answer ?? '',
          frKeywords: editing.fr?.keywords?.join(', ') ?? '',
          enQuestion: editing.en?.question ?? '',
          enAnswer: editing.en?.answer ?? '',
          enKeywords: editing.en?.keywords?.join(', ') ?? '',
          displayOrder: editing.displayOrder,
        } : null}
        lang={lang}
      />

      {/* Delete confirm */}
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
    </div>
  )
}