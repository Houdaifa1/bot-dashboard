import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Play, Pause, Square, CalendarClock, Users, MessageSquare,
  AlertTriangle, CheckCircle2, XCircle, Loader2, Ban, ChevronRight, Trash2, Eye, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { getCampaigns, createCampaign, launchCampaign, pauseCampaign, resumeCampaign, stopCampaign, cancelCampaignSchedule, deleteCampaign, previewCampaign, previewCampaignFilters, getCampaignTargetingOptions } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { PageHeader, PageLoader, Modal, ConfirmDialog, Empty, Field } from '../components/ui'
import type { Campaign, CampaignStatus } from '../types'

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CampaignStatus, { bg: string; text: string; label: string }> = {
  DRAFT:     { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-600 dark:text-neutral-400', label: 'Draft' },
  SCHEDULED: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Scheduled' },
  RUNNING:   { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Running' },
  PAUSED:    { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Paused' },
  COMPLETED: { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-500 dark:text-neutral-500', label: 'Completed' },
  STOPPED:   { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Stopped' },
}

// ── Chip Multi-Select ────────────────────────────────────────────────────────
// Toggleable chip list for picking one or more items from a live-loaded API
// list. Used for specialties and doctors so staff pick exact values instead
// of typing free text.

function ChipMultiSelect({ options, selected, onToggle, getKey, getLabel, emptyMessage }: {
  options: any[]; selected: string[]; onToggle: (label: string) => void
  getKey: (o: any) => string | number; getLabel: (o: any) => string; emptyMessage: string
}) {
  if (options.length === 0) {
    return <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">{emptyMessage}</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const label = getLabel(o)
        const active = selected.includes(label)
        return (
          <button
            key={getKey(o)}
            type="button"
            onClick={() => onToggle(label)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              active
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-transparent border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-blue-400'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Tag Input ────────────────────────────────────────────────────────────────
// Type a value, press Enter (or comma) to add it as a chip. Used for motif,
// CIN/passport, and phone number — fields where staff already know the exact
// value to type and there's no API-provided list to pick from.

function TagInput({ value, onChange, placeholder }: {
  value: string[]; onChange: (v: string[]) => void; placeholder: string
}) {
  const [draft, setDraft] = useState('')

  const addTag = () => {
    const v = draft.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map(v => (
            <span key={v} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
              {v}
              <button type="button" onClick={() => onChange(value.filter(x => x !== v))} className="hover:opacity-70">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="input h-10"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
        }}
        onBlur={addTag}
        placeholder={placeholder}
      />
    </div>
  )
}

// ── Create Modal ─────────────────────────────────────────────────────────────

const SEND_NOW = 'send_now'
const SCHEDULE_LATER = 'schedule_later'

function CreateCampaignModal({
  open, onClose, onSave, saving, lang,
}: {
  open: boolean; onClose: () => void; onSave: (data: any) => void; saving: boolean; lang: string
}) {
  const [name, setName] = useState('')
  const [filterMotifs, setFilterMotifs] = useState<string[]>([])
  const [filterCinPassports, setFilterCinPassports] = useState<string[]>([])
  const [filterPhoneNumbers, setFilterPhoneNumbers] = useState<string[]>([])
  const [showRefine, setShowRefine] = useState(false)
  const [filterDoctors, setFilterDoctors] = useState<string[]>([])
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [onlyVerifiedNumbers, setOnlyVerifiedNumbers] = useState(true)
  const [scheduledStartAt, setScheduledStartAt] = useState('')
  const [scheduleType, setScheduleType] = useState(SEND_NOW)

  // Reset the form every time the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setName('')
      setFilterMotifs([]); setFilterCinPassports([]); setFilterPhoneNumbers([])
      setShowRefine(false); setFilterDoctors([])
      setFilterDateFrom(''); setFilterDateTo(''); setOnlyVerifiedNumbers(true)
      setScheduledStartAt(''); setScheduleType(SEND_NOW)
    }
  }, [open])

  // Exact doctor list from ClinOps, so staff pick from the real list instead
  // of typing free text (no way to get this wrong).
  const { data: options } = useQuery({
    queryKey: ['campaign-targeting-options'],
    queryFn: () => getCampaignTargetingOptions(),
    enabled: open,
  })

  const toggleDoctor = (label: string) => {
    setFilterDoctors(prev => prev.includes(label) ? prev.filter(d => d !== label) : [...prev, label])
  }

  const hasTarget = filterMotifs.length > 0 || filterCinPassports.length > 0 || filterPhoneNumbers.length > 0

  // ── Live "how many patients match" preview, debounced on selection changes ──
  const previewMut = useMutation({
    mutationFn: (filters: any) => previewCampaignFilters(filters),
  })

  useEffect(() => {
    if (!hasTarget) {
      previewMut.reset()
      return
    }
    const t = setTimeout(() => {
      previewMut.mutate({
        ...(filterMotifs.length ? { filterMotifs } : {}),
        ...(filterCinPassports.length ? { filterCinPassports } : {}),
        ...(filterPhoneNumbers.length ? { filterPhoneNumbers } : {}),
        onlyVerifiedNumbers,
        ...(filterDoctors.length ? { filterDoctors } : {}),
        ...(filterDateFrom ? { filterDateFrom } : {}),
        ...(filterDateTo ? { filterDateTo } : {}),
      })
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMotifs, filterCinPassports, filterPhoneNumbers, onlyVerifiedNumbers, filterDoctors, filterDateFrom, filterDateTo])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = { name, onlyVerifiedNumbers }

    if (filterMotifs.length) payload.filterMotifs = filterMotifs
    if (filterCinPassports.length) payload.filterCinPassports = filterCinPassports
    if (filterPhoneNumbers.length) payload.filterPhoneNumbers = filterPhoneNumbers
    if (filterDoctors.length) payload.filterDoctors = filterDoctors
    if (filterDateFrom) payload.filterDateFrom = filterDateFrom
    if (filterDateTo) payload.filterDateTo = filterDateTo

    if (scheduleType === SCHEDULE_LATER && scheduledStartAt) {
      payload.scheduledStartAt = new Date(scheduledStartAt).toISOString()
    } else {
      // Forces the backend to treat this as immediate.
      payload.delayHours = 0
    }

    onSave(payload)
  }

  const canSubmit = name.trim().length >= 2 && hasTarget

  return (
    <Modal open={open} onClose={onClose} title={lang === 'FR' ? 'Nouvelle campagne' : 'New campaign'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name: simple, just a name */}
        <Field label={lang === 'FR' ? 'Nom de la campagne' : 'Campaign name'}>
          <input className="input h-10" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} placeholder="ex: Suivi post-consultation juin" />
        </Field>

        {/* Who to reach: the 3 real ways the system can find patients */}
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {lang === 'FR' ? '🎯 Qui voulez-vous contacter ?' : '🎯 Who do you want to reach?'}
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              {lang === 'FR'
                ? "Utilisez au moins une des 3 méthodes ci-dessous. Vous pouvez en combiner plusieurs."
                : 'Use at least one of the 3 methods below. You can combine more than one.'}
            </p>
          </div>

          <Field
            label={lang === 'FR' ? '🩺 Motif de visite' : '🩺 Visit reason'}
            hint={lang === 'FR'
              ? "Reçoit plusieurs patients à la fois. Tapez le motif exact tel qu'il apparaît dans votre dossier, ex: Consultation cardiologie."
              : 'Reaches many patients at once. Type the exact reason as it appears in your record, e.g. Consultation cardiologie.'}
          >
            <TagInput value={filterMotifs} onChange={setFilterMotifs} placeholder={lang === 'FR' ? 'ex: Consultation cardiologie, puis Entrée' : 'e.g. Consultation cardiologie, then Enter'} />
          </Field>

          <Field
            label={lang === 'FR' ? '🪪 Numéro CIN / Passeport' : '🪪 CIN / Passport number'}
            hint={lang === 'FR'
              ? 'Pour cibler un ou plusieurs patients précis que vous connaissez déjà.'
              : 'To target one or more specific patients you already know.'}
          >
            <TagInput value={filterCinPassports} onChange={setFilterCinPassports} placeholder={lang === 'FR' ? 'ex: CIN1002, puis Entrée' : 'e.g. CIN1002, then Enter'} />
          </Field>

          <Field
            label={lang === 'FR' ? '📱 Numéro de téléphone' : '📱 Phone number'}
            hint={lang === 'FR'
              ? 'Format international avec le +, ex: +212666666666.'
              : 'International format with the +, e.g. +212666666666.'}
          >
            <TagInput value={filterPhoneNumbers} onChange={setFilterPhoneNumbers} placeholder="+212666666666" />
          </Field>

          {/* Live match feedback */}
          <div className="flex items-center gap-2 text-xs min-h-[1.25rem]">
            {previewMut.isPending && (
              <span className="flex items-center gap-1.5 text-neutral-400"><Loader2 size={12} className="animate-spin" /> {lang === 'FR' ? 'Recherche...' : 'Searching...'}</span>
            )}
            {previewMut.isSuccess && (
              previewMut.data.count > 0 ? (
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                  <Users size={12} /> {previewMut.data.count} {lang === 'FR' ? 'patient(s) correspondant(s)' : 'matching patient(s)'}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle size={12} /> {lang === 'FR' ? 'Aucun patient trouvé pour cette sélection' : 'No patients found for this selection'}
                </span>
              )
            )}
            {previewMut.isError && (
              <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <XCircle size={12} /> {lang === 'FR' ? 'Erreur de recherche' : 'Search failed'}
              </span>
            )}
          </div>
        </div>

        {/* Optional local refinements */}
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 space-y-3">
          <button
            type="button"
            className="flex items-center justify-between w-full text-sm font-medium text-neutral-600 dark:text-neutral-400"
            onClick={() => setShowRefine(v => !v)}
          >
            <span>{lang === 'FR' ? '🔍 Affiner (facultatif)' : '🔍 Narrow it down (optional)'}</span>
            {showRefine ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showRefine && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                {lang === 'FR'
                  ? 'Ces options réduisent la liste des patients déjà trouvés ci-dessus. Elles ne ciblent jamais de patients seules.'
                  : 'These options narrow down the patients already matched above. They never target patients on their own.'}
              </p>
              <Field label={lang === 'FR' ? 'Médecins' : 'Doctors'}>
                <ChipMultiSelect
                  options={options?.doctors ?? []}
                  selected={filterDoctors}
                  onToggle={toggleDoctor}
                  getKey={d => d.doctorId}
                  getLabel={d => d.doctorLabel}
                  emptyMessage={lang === 'FR' ? 'Aucun médecin disponible' : 'No doctors available'}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={lang === 'FR' ? 'Visite du' : 'Visit from'}>
                  <input type="date" className="input h-10" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                </Field>
                <Field label={lang === 'FR' ? 'Visite au' : 'Visit to'}>
                  <input type="date" className="input h-10" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                </Field>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" checked={onlyVerifiedNumbers} onChange={e => setOnlyVerifiedNumbers(e.target.checked)} className="accent-blue-600 h-4 w-4" />
                <span className="text-sm">
                  {lang === 'FR' ? 'Envoyer seulement aux numéros vérifiés' : 'Only send to verified phone numbers'}
                  <span className="text-neutral-400"> ({lang === 'FR' ? 'recommandé' : 'recommended'})</span>
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Schedule: simple choice */}
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {lang === 'FR' ? '⏰ Envoi' : '⏰ Send'}
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="schedule" checked={scheduleType === SEND_NOW} onChange={() => setScheduleType(SEND_NOW)} className="accent-blue-600" />
              <span className="text-sm">{lang === 'FR' ? 'Envoyer maintenant' : 'Send now'}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="schedule" checked={scheduleType === SCHEDULE_LATER} onChange={() => setScheduleType(SCHEDULE_LATER)} className="accent-blue-600" />
              <span className="text-sm">{lang === 'FR' ? 'Programmer' : 'Schedule'}</span>
            </label>
          </div>
          {scheduleType === SCHEDULE_LATER && (
            <input
              type="datetime-local"
              className="input h-10 mt-2"
              value={scheduledStartAt}
              onChange={e => setScheduledStartAt(e.target.value)}
            />
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {lang === 'FR' ? 'Annuler' : 'Cancel'}
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !canSubmit}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : (
              scheduleType === SCHEDULE_LATER ? (lang === 'FR' ? 'Programmer' : 'Schedule') : (lang === 'FR' ? 'Créer' : 'Create')
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ icon: Icon, value, label, color, onClick }: {
  icon: any; value: number; label: string; color: string; onClick?: () => void
}) {
  if (value === 0) return null
  return (
    <button
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all hover:opacity-80 ${color} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <Icon size={12} />
      {value} {label}
    </button>
  )
}

// ── Preview Modal — "who exactly will get this?" before Launch ────────────────

function PreviewCampaignModal({ campaign, onClose, lang }: { campaign: Campaign | null; onClose: () => void; lang: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['campaign-preview', campaign?.id],
    queryFn: () => previewCampaign(campaign!.id),
    enabled: !!campaign,
  })

  return (
    <Modal open={!!campaign} onClose={onClose} title={lang === 'FR' ? `Aperçu : ${campaign?.name ?? ''}` : `Preview: ${campaign?.name ?? ''}`} size="md">
      {isLoading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-neutral-400" /></div>}
      {isError && <p className="text-sm text-red-600 dark:text-red-400">{lang === 'FR' ? "Erreur lors de l'aperçu" : 'Failed to load preview'}</p>}
      {data && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {data.count > 0
              ? (lang === 'FR' ? `${data.count} patient(s) recevront ce message :` : `${data.count} patient(s) will receive this message:`)
              : (lang === 'FR' ? 'Aucun patient ne correspond à ces filtres' : 'No patients match these filters')}
          </p>
          {data.count > 0 && (
            <div className="max-h-72 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg divide-y divide-neutral-100 dark:divide-neutral-800">
              {data.patients.map((p: any) => (
                <div key={p.patient_id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-700 dark:text-neutral-300 truncate">{p.patient}</p>
                    <p className="text-xs text-neutral-400 truncate">{p.prestation} · {p.medecin_traitant}</p>
                  </div>
                  <span className="text-xs text-neutral-400 shrink-0 ml-2">{p.numeroTelephonePrincipale}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex justify-end pt-4">
        <button className="btn-outline" onClick={onClose}>{lang === 'FR' ? 'Fermer' : 'Close'}</button>
      </div>
    </Modal>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function CampaignsPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)
  const [previewTarget, setPreviewTarget] = useState<Campaign | null>(null)

  const { data: campaigns, isLoading, isError, refetch } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => getCampaigns(),
  })

  const createMut = useMutation({
    mutationFn: (data: any) => createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast(lang === 'FR' ? 'Campagne créée' : 'Campaign created', 'success')
      setCreateOpen(false)
    },
    onError: (err: any) => toast(lang === 'FR' ? 'Erreur lors de la création' : (err?.response?.data?.message ?? 'Failed to create campaign'), 'error'),
  })

  const launchMut = useMutation({
    mutationFn: (id: string) => launchCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast(lang === 'FR' ? 'Campagne lancée' : 'Campaign launched', 'success')
    },
    onError: (err: any) => toast(lang === 'FR' ? 'Erreur lors du lancement' : (err?.response?.data?.message ?? 'Failed to launch campaign'), 'error'),
  })

  const pauseMut = useMutation({
    mutationFn: (id: string) => pauseCampaign(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast(lang === 'FR' ? 'Campagne en pause' : 'Campaign paused', 'success') },
    onError: (err: any) => toast(lang === 'FR' ? 'Erreur lors de la pause' : (err?.response?.data?.message ?? 'Failed to pause campaign'), 'error'),
  })

  const resumeMut = useMutation({
    mutationFn: (id: string) => resumeCampaign(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast(lang === 'FR' ? 'Campagne reprise' : 'Campaign resumed', 'success') },
    onError: (err: any) => toast(lang === 'FR' ? 'Erreur lors de la reprise' : (err?.response?.data?.message ?? 'Failed to resume campaign'), 'error'),
  })

  const stopMut = useMutation({
    mutationFn: (id: string) => stopCampaign(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast(lang === 'FR' ? 'Campagne arrêtée' : 'Campaign stopped', 'success') },
    onError: (err: any) => toast(lang === 'FR' ? "Erreur lors de l'arrêt" : (err?.response?.data?.message ?? 'Failed to stop campaign'), 'error'),
  })

  const cancelScheduleMut = useMutation({
    mutationFn: (id: string) => cancelCampaignSchedule(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast(lang === 'FR' ? 'Programmation annulée' : 'Schedule cancelled', 'success') },
    onError: (err: any) => toast(lang === 'FR' ? "Erreur lors de l'annulation" : (err?.response?.data?.message ?? 'Failed to cancel schedule'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast(lang === 'FR' ? 'Campagne supprimée' : 'Campaign deleted', 'success') },
    onError: (err: any) => toast(lang === 'FR' ? 'Erreur lors de la suppression' : (err?.response?.data?.message ?? 'Failed to delete campaign'), 'error'),
  })

  if (isLoading) return <PageLoader />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-neutral-500">{lang === 'FR' ? 'Erreur de chargement' : 'Error loading data'}</p>
        <button className="btn-outline" onClick={() => refetch()}>{lang === 'FR' ? 'Réessayer' : 'Try again'}</button>
      </div>
    )
  }

  const sorted = [...(campaigns ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={lang === 'FR' ? 'Campagnes' : 'Campaigns'}
        subtitle={lang === 'FR' ? 'Suivi post-visite WhatsApp' : 'WhatsApp follow-up campaigns'}
        action={
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            {lang === 'FR' ? 'Nouvelle campagne' : 'New campaign'}
          </button>
        }
      />

      {sorted.length === 0 ? (
        <Empty message={lang === 'FR' ? 'Aucune campagne créée' : 'No campaigns yet'} />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map(c => {
            const style = STATUS_STYLES[c.status]
            return (
              <div key={c.id} className="card p-5 space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{c.name}</h3>
                    {c.scheduledStartAt && c.status === 'SCHEDULED' && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <CalendarClock size={12} />
                        {new Date(c.scheduledStartAt).toLocaleString(lang === 'FR' ? 'fr-MA' : 'en-GB')}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(c.status === 'DRAFT') && (
                      <>
                        <button className="btn-outline h-8 text-xs" onClick={() => setPreviewTarget(c)}>
                          <Eye size={12} className="mr-1" />{lang === 'FR' ? 'Aperçu' : 'Preview'}
                        </button>
                        <button className="btn-primary h-8 text-xs" onClick={() => launchMut.mutate(c.id)} disabled={launchMut.isPending}>
                          {launchMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} className="mr-1" />}
                          {lang === 'FR' ? 'Lancer' : 'Launch'}
                        </button>
                      </>
                    )}
                    {c.status === 'SCHEDULED' && (
                      <>
                        <button className="btn-outline h-8 text-xs" onClick={() => setPreviewTarget(c)}>
                          <Eye size={12} className="mr-1" />{lang === 'FR' ? 'Aperçu' : 'Preview'}
                        </button>
                        <button className="btn-primary h-8 text-xs" onClick={() => launchMut.mutate(c.id)} disabled={launchMut.isPending}>
                          <Play size={12} className="mr-1" />{lang === 'FR' ? 'Lancer maintenant' : 'Launch now'}
                        </button>
                        <button className="btn-outline h-8 text-xs" onClick={() => cancelScheduleMut.mutate(c.id)} disabled={cancelScheduleMut.isPending}>
                          <Ban size={12} className="mr-1" />{lang === 'FR' ? 'Annuler' : 'Cancel'}
                        </button>
                      </>
                    )}
                    {c.status === 'RUNNING' && (
                      <>
                        <button className="btn-outline h-8 text-xs" onClick={() => pauseMut.mutate(c.id)} disabled={pauseMut.isPending}>
                          <Pause size={12} className="mr-1" />{lang === 'FR' ? 'Pause' : 'Pause'}
                        </button>
                        <button className="btn-outline h-8 text-xs text-red-600 hover:text-red-700 dark:text-red-400" onClick={() => stopMut.mutate(c.id)} disabled={stopMut.isPending}>
                          <Square size={12} className="mr-1" />{lang === 'FR' ? 'Arrêter' : 'Stop'}
                        </button>
                      </>
                    )}
                    {c.status === 'PAUSED' && (
                      <>
                        <button className="btn-primary h-8 text-xs" onClick={() => resumeMut.mutate(c.id)} disabled={resumeMut.isPending}>
                          <Play size={12} className="mr-1" />{lang === 'FR' ? 'Reprendre' : 'Resume'}
                        </button>
                        <button className="btn-outline h-8 text-xs text-red-600 hover:text-red-700 dark:text-red-400" onClick={() => stopMut.mutate(c.id)} disabled={stopMut.isPending}>
                          <Square size={12} className="mr-1" />{lang === 'FR' ? 'Arrêter' : 'Stop'}
                        </button>
                      </>
                    )}
                    {/* Delete button — shown on DRAFT, STOPPED, COMPLETED, SCHEDULED */}
                    {(c.status === 'DRAFT' || c.status === 'STOPPED' || c.status === 'COMPLETED' || c.status === 'SCHEDULED') && (
                      <button className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 dark:text-red-400" onClick={() => setDeleteTarget(c)} disabled={deleteMut.isPending}>
                        <Trash2 size={14} />
                      </button>
                    )}
                    {/* View patients button — shown if campaign has been launched */}
                    {c.targetedCount > 0 && (
                      <button
                        className="btn-ghost h-8 text-xs"
                        onClick={() => navigate(`/campaigns/${c.id}/patients`)}
                      >
                        <Users size={12} className="mr-1" />
                        {c.targetedCount} {lang === 'FR' ? 'patients' : 'patients'}
                        <ChevronRight size={12} className="ml-1" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filters display */}
                <div className="flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                  {c.filterMotifs?.length > 0 && <span>🩺 {c.filterMotifs.join(', ')}</span>}
                  {c.filterCinPassports?.length > 0 && <span>🪪 {c.filterCinPassports.join(', ')}</span>}
                  {c.filterPhoneNumbers?.length > 0 && <span>📱 {c.filterPhoneNumbers.join(', ')}</span>}
                  {c.filterDoctors?.length > 0 && <span>👨‍⚕️ {c.filterDoctors.join(', ')}</span>}
                  {c.filterDateFrom && <span>📅 {new Date(c.filterDateFrom).toLocaleDateString(lang === 'FR' ? 'fr-MA' : 'en-GB')}</span>}
                  {c.filterDateTo && <span>→ {new Date(c.filterDateTo).toLocaleDateString(lang === 'FR' ? 'fr-MA' : 'en-GB')}</span>}
                  {c.delayHours && <span>⏱ {c.delayHours}h delay</span>}
                </div>

                {/* Stats chips — clickable to filter patients */}
                <div className="flex flex-wrap gap-2">
                  <StatChip icon={Users} value={c.targetedCount} label="targeted" color="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                    onClick={() => navigate(`/campaigns/${c.id}/patients`)} />
                  <StatChip icon={MessageSquare} value={c.contactedCount} label="contacted" color="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                    onClick={() => navigate(`/campaigns/${c.id}/patients?status=CONTACTED`)} />
                  <StatChip icon={MessageSquare} value={c.repliedCount} label="replied" color="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                    onClick={() => navigate(`/campaigns/${c.id}/patients?status=REPLIED`)} />
                  <StatChip icon={AlertTriangle} value={c.complainedCount} label="complained" color="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" />
                  <StatChip icon={CheckCircle2} value={c.completedCount} label="completed" color="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                    onClick={() => navigate(`/campaigns/${c.id}/patients?status=COMPLETED`)} />
                  <StatChip icon={XCircle} value={c.noResponseCount} label="no response" color="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                    onClick={() => navigate(`/campaigns/${c.id}/patients?status=NO_RESPONSE`)} />
                </div>

                {/* Created date */}
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  {lang === 'FR' ? 'Créée le' : 'Created'} {new Date(c.createdAt).toLocaleString(lang === 'FR' ? 'fr-MA' : 'en-GB')}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <CreateCampaignModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={(data) => createMut.mutate(data)}
        saving={createMut.isPending}
        lang={lang}
      />

      <PreviewCampaignModal
        campaign={previewTarget}
        onClose={() => setPreviewTarget(null)}
        lang={lang}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget.id)
          setDeleteTarget(null)
        }}
        lang={lang}
        loading={deleteMut.isPending}
        permanent
      />
    </div>
  )
}