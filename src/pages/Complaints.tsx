import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, AlertCircle, Loader2, MessageSquare, StickyNote,
} from 'lucide-react'
import { getComplaints, updateComplaintStatus, updateComplaintStaffNote } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { PageHeader, PageLoader, Modal, Empty, Field } from '../components/ui'
import type { Complaint, ComplaintType, ComplaintSeverity, ComplaintStatusFilter } from '../types'

// ── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ComplaintType, { icon: any; label: string; color: string }> = {
  COMPLAINT:      { icon: AlertCircle, label: 'Complaint', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  MEDICAL_CONCERN: { icon: AlertTriangle, label: 'Medical', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  URGENT:         { icon: AlertTriangle, label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

const SEVERITY_CONFIG: Record<ComplaintSeverity, { label: string; color: string }> = {
  LOW:    { label: 'Low', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
  MEDIUM: { label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  HIGH:   { label: 'High', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

const STATUS_CONFIG: Record<ComplaintStatusFilter, { label: string; color: string }> = {
  NEW:      { label: 'New', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  REVIEWED: { label: 'Reviewed', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  RESOLVED: { label: 'Resolved', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
}

// ── Staff Note Modal ─────────────────────────────────────────────────────────

function StaffNoteModal({ complaint, lang, onClose, onSave, saving }: {
  complaint: Complaint; lang: string; onClose: () => void;
  onSave: (note: string) => void; saving: boolean
}) {
  const [note, setNote] = useState(complaint.staffNote ?? '')

  return (
    <Modal open={!!complaint} onClose={onClose} title={lang === 'FR' ? 'Note du personnel' : 'Staff Note'} size="md">
      <div className="space-y-4">
        <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-sm">
          <p className="font-medium text-neutral-800 dark:text-neutral-200">{complaint.summary}</p>
          <p className="text-xs text-neutral-500 mt-1">
            {complaint.campaignPatient?.patientName} • {complaint.campaignPatient?.phone}
          </p>
        </div>
        <Field label={lang === 'FR' ? 'Note' : 'Note'}>
          <textarea
            className="input h-24 resize-none"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={lang === 'FR' ? 'Ajouter une note...' : 'Add a note...'}
          />
        </Field>
        <div className="flex justify-end gap-3">
          <button className="btn-outline" onClick={onClose} disabled={saving}>
            {lang === 'FR' ? 'Annuler' : 'Cancel'}
          </button>
          <button className="btn-primary" onClick={() => onSave(note)} disabled={saving || !note.trim()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : lang === 'FR' ? 'Enregistrer' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function ComplaintsPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<ComplaintStatusFilter | 'ALL'>('ALL')
  const [severityFilter, setSeverityFilter] = useState<ComplaintSeverity | 'ALL'>('ALL')
  const [typeFilter] = useState<ComplaintType | 'ALL'>('ALL')
  const [noteTarget, setNoteTarget] = useState<Complaint | null>(null)

  const { data: complaints, isLoading, isError, refetch } = useQuery<Complaint[]>({
    queryKey: ['complaints', statusFilter, severityFilter, typeFilter],
    queryFn: () => {
      const params: any = {}
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (severityFilter !== 'ALL') params.severity = severityFilter
      if (typeFilter !== 'ALL') params.type = typeFilter
      return getComplaints(params)
    },
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ComplaintStatusFilter }) =>
      updateComplaintStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      toast(lang === 'FR' ? 'Statut mis à jour' : 'Status updated', 'success')
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Error', 'error'),
  })

  const noteMut = useMutation({
    mutationFn: ({ id, staffNote }: { id: string; staffNote: string }) =>
      updateComplaintStaffNote(id, staffNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      toast(lang === 'FR' ? 'Note enregistrée' : 'Note saved', 'success')
      setNoteTarget(null)
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Error', 'error'),
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

  const items = complaints ?? []

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={lang === 'FR' ? 'Plaintes' : 'Complaints'}
        subtitle={lang === 'FR' ? 'Suivi des plaintes et préoccupations patients' : 'Track patient complaints and concerns'}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Status filter */}
        {(['ALL', 'NEW', 'REVIEWED', 'RESOLVED'] as const).map(s => (
          <button
            key={s}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              statusFilter === s
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'ALL' ? (lang === 'FR' ? 'Tous' : 'All') : STATUS_CONFIG[s].label}
          </button>
        ))}

        <span className="w-px h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />

        {/* Severity filter */}
        {(['ALL', 'LOW', 'MEDIUM', 'HIGH'] as const).map(s => (
          <button
            key={s}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              severityFilter === s
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
            onClick={() => setSeverityFilter(s)}
          >
            {s === 'ALL' ? (lang === 'FR' ? 'Toutes' : 'All') : SEVERITY_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <Empty message={lang === 'FR' ? 'Aucune plainte' : 'No complaints yet'} />
      ) : (
        <div className="space-y-2">
          {items.map(c => {
            const typeStyle = TYPE_CONFIG[c.type]
            const sevStyle = SEVERITY_CONFIG[c.severity]
            const statStyle = STATUS_CONFIG[c.status]
            const TypeIcon = typeStyle.icon

            return (
              <div key={c.id} className="card p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`p-1.5 rounded-lg ${typeStyle.color}`}>
                      <TypeIcon size={14} />
                    </span>
                    <div>
                      <p className="font-medium text-sm text-neutral-800 dark:text-neutral-200">{c.summary}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {c.campaignPatient?.patientName} • {c.campaignPatient?.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sevStyle.color}`}>
                      {sevStyle.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statStyle.color}`}>
                      {statStyle.label}
                    </span>
                  </div>
                </div>

                {/* Triggering message */}
                {c.triggeringMessage && (
                  <div className="flex items-start gap-2 text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2.5">
                    <MessageSquare size={12} className="shrink-0 mt-0.5" />
                    <span className="italic">"{c.triggeringMessage}"</span>
                  </div>
                )}

                {/* Staff note */}
                {c.staffNote && (
                  <div className="flex items-start gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5">
                    <StickyNote size={12} className="shrink-0 mt-0.5" />
                    <span>{c.staffNote}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400">
                    {new Date(c.createdAt).toLocaleString(lang === 'FR' ? 'fr-MA' : 'en-GB')}
                  </span>
                  <div className="flex items-center gap-2">
                    {c.status === 'NEW' && (
                      <button className="btn-ghost h-7 text-xs" onClick={() => statusMut.mutate({ id: c.id, status: 'REVIEWED' })}>
                        {lang === 'FR' ? 'Marquer vu' : 'Mark reviewed'}
                      </button>
                    )}
                    {c.status !== 'RESOLVED' && (
                      <button className="btn-ghost h-7 text-xs text-green-600" onClick={() => statusMut.mutate({ id: c.id, status: 'RESOLVED' })}>
                        {lang === 'FR' ? 'Résoudre' : 'Resolve'}
                      </button>
                    )}
                    <button className="btn-ghost h-7 text-xs" onClick={() => setNoteTarget(c)}>
                      <StickyNote size={12} className="mr-1" />
                      {lang === 'FR' ? 'Note' : 'Note'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Staff note modal */}
      {noteTarget && (
        <StaffNoteModal
          complaint={noteTarget}
          lang={lang}
          onClose={() => setNoteTarget(null)}
          onSave={(note) => noteMut.mutate({ id: noteTarget.id, staffNote: note })}
          saving={noteMut.isPending}
        />
      )}
    </div>
  )
}