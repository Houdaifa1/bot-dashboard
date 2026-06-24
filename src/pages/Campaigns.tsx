import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Play, Pause, Square, CalendarClock, Users, MessageSquare,
  AlertTriangle, CheckCircle2, XCircle, Loader2, Ban, ChevronRight, Trash2,
} from 'lucide-react'
import { getCampaigns, getClinic, createCampaign, launchCampaign, pauseCampaign, resumeCampaign, stopCampaign, cancelCampaignSchedule, deleteCampaign } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { PageHeader, PageLoader, Modal, Empty, Field } from '../components/ui'
import type { Campaign, CampaignStatus, Clinic } from '../types'

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CampaignStatus, { bg: string; text: string; label: string }> = {
  DRAFT:     { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-600 dark:text-neutral-400', label: 'Draft' },
  SCHEDULED: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Scheduled' },
  RUNNING:   { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Running' },
  PAUSED:    { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Paused' },
  COMPLETED: { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-500 dark:text-neutral-500', label: 'Completed' },
  STOPPED:   { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Stopped' },
}

// ── Create Modal ─────────────────────────────────────────────────────────────

function CreateCampaignModal({
  open, onClose, onSave, saving, lang,
}: {
  open: boolean; onClose: () => void; onSave: (data: any) => void; saving: boolean; lang: string
}) {
  const [name, setName] = useState('')
  const [filterDoctor, setFilterDoctor] = useState('')
  const [filterMotif, setFilterMotif] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [scheduledStartAt, setScheduledStartAt] = useState('')
  const [delayHours, setDelayHours] = useState<number | null>(null)

  const { data: clinic } = useQuery<Clinic>({
    queryKey: ['clinic-settings'],
    queryFn: () => getClinic(),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name,
      ...(filterDoctor && { filterDoctor }),
      ...(filterMotif && { filterMotif }),
      ...(filterDateFrom && { filterDateFrom }),
      ...(filterDateTo && { filterDateTo }),
      ...(scheduledStartAt && { scheduledStartAt: new Date(scheduledStartAt).toISOString() }),
      ...(delayHours !== null && { delayHours }),
    })
  }

  const canSubmit = name.trim().length >= 2 && (filterDoctor || filterMotif || filterDateFrom || filterDateTo)

  return (
    <Modal open={open} onClose={onClose} title={lang === 'FR' ? 'Nouvelle campagne' : 'New campaign'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={lang === 'FR' ? 'Nom' : 'Name'}>
          <input className="input h-10" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={lang === 'FR' ? 'Médecin (filtre)' : 'Doctor (filter)'}>
            <input className="input h-10" value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} placeholder={lang === 'FR' ? 'Ex: Dr Ahmed' : 'e.g. Dr Ahmed'} />
          </Field>
          <Field label={lang === 'FR' ? 'Motif (filtre)' : 'Reason (filter)'}>
            <input className="input h-10" value={filterMotif} onChange={e => setFilterMotif(e.target.value)} placeholder={lang === 'FR' ? 'Ex: Consultation' : 'e.g. Consultation'} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={lang === 'FR' ? 'Date début' : 'Date from'}>
            <input type="date" className="input h-10" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          </Field>
          <Field label={lang === 'FR' ? 'Date fin' : 'Date to'}>
            <input type="date" className="input h-10" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          </Field>
        </div>

        <Field label={lang === 'FR' ? "Délai avant premier envoi (heures)" : 'Delay before first message (hours)'}>
          <input
            type="number"
            min={0}
            max={168}
            className="input h-10"
            value={delayHours ?? clinic?.campaignDelayHours ?? 24}
            onChange={e => setDelayHours(parseInt(e.target.value) || 0)}
          />
          <p className="text-xs text-neutral-400 mt-1">
            {lang === 'FR'
              ? `Par défaut: ${clinic?.campaignDelayHours ?? 24}h (réglage clinic). 0 = envoi immédiat.`
              : `Default: ${clinic?.campaignDelayHours ?? 24}h (clinic setting). 0 = send immediately.`
            }
          </p>
        </Field>

        <Field label={lang === 'FR' ? 'Programmer le démarrage (optionnel)' : 'Schedule start (optional)'}>
          <input type="datetime-local" className="input h-10" value={scheduledStartAt} onChange={e => setScheduledStartAt(e.target.value)} />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {lang === 'FR' ? 'Annuler' : 'Cancel'}
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !canSubmit}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : lang === 'FR' ? 'Créer' : 'Create'}
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

// ── Main Page ────────────────────────────────────────────────────────────────

export function CampaignsPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)

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
                      <button className="btn-primary h-8 text-xs" onClick={() => launchMut.mutate(c.id)} disabled={launchMut.isPending}>
                        {launchMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} className="mr-1" />}
                        {lang === 'FR' ? 'Lancer' : 'Launch'}
                      </button>
                    )}
                    {c.status === 'SCHEDULED' && (
                      <>
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
                      <button className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 dark:text-red-400" onClick={() => {
                        if (confirm(lang === 'FR' ? 'Supprimer cette campagne ?' : 'Delete this campaign?')) {
                          deleteMut.mutate(c.id)
                        }
                      }} disabled={deleteMut.isPending}>
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
                  {c.filterDoctor && <span>👨‍⚕️ {c.filterDoctor}</span>}
                  {c.filterMotif && <span>📋 {c.filterMotif}</span>}
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
    </div>
  )
}