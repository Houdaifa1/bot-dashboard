import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, AlertCircle, Loader2, MessageSquare, StickyNote,
  ChevronDown, ChevronRight, UserRound, Phone, FileText,
} from 'lucide-react'
import { getComplaints, updateComplaintStatus, updateComplaintStaffNote } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { PageHeader, PageLoader, Modal, Empty, Field } from '../components/ui'
import type { Complaint, ComplaintType, ComplaintSeverity, ComplaintStatusFilter } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────

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

// ── Patient Complaint Group ───────────────────────────────────────────────────

interface PatientGroup {
  patientId: string
  patientName: string
  phone: string
  campaignId: string
  complaints: Complaint[]
}

function PatientGroupCard({ group, lang, onNote, statusMut }: {
  group: PatientGroup
  lang: string
  onNote: (c: Complaint) => void
  statusMut: any
}) {
  const [expanded, setExpanded] = useState(true)
  const latest = group.complaints[0]

  return (
    <div className="card overflow-hidden">
      {/* Patient header — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <UserRound size={18} className="text-blue-600 dark:text-blue-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              {group.patientName}
            </span>
            <span className="text-xs text-neutral-500 flex items-center gap-1">
              <Phone size={10} />
              {group.phone}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            {group.complaints.length} {group.complaints.length === 1 ? (lang === 'FR' ? 'plainte' : 'complaint') : (lang === 'FR' ? 'plaintes' : 'complaints')}
            {' • '}
            {lang === 'FR' ? 'Dernière' : 'Latest'}: {new Date(latest.createdAt).toLocaleDateString(lang === 'FR' ? 'fr-MA' : 'en-GB')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {latest.severity && (
            <span className={`px-2 py-1 rounded text-[10px] font-semibold ${SEVERITY_CONFIG[latest.severity].color}`}>
              {SEVERITY_CONFIG[latest.severity].label}
            </span>
          )}
          {expanded ? <ChevronDown size={16} className="text-neutral-400" /> : <ChevronRight size={16} className="text-neutral-400" />}
        </div>
      </button>

      {/* Complaints list */}
      {expanded && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
          {group.complaints.map(c => {
            const typeStyle = TYPE_CONFIG[c.type]
            const sevStyle  = SEVERITY_CONFIG[c.severity]
            const statStyle  = STATUS_CONFIG[c.status]
            const TypeIcon   = typeStyle.icon
            return (
              <div key={c.id} className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className={`p-1.5 rounded-lg shrink-0 ${typeStyle.color}`}>
                      <TypeIcon size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-neutral-800 dark:text-neutral-200 leading-snug">
                        {c.summary}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${sevStyle.color}`}>
                          {sevStyle.label}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statStyle.color}`}>
                          {STATUS_CONFIG[c.status].label}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {c.type}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.status === 'NEW' && (
                      <button
                        className="btn-ghost h-7 text-xs"
                        onClick={(e) => { e.stopPropagation(); statusMut.mutate({ id: c.id, status: 'REVIEWED' }) }}
                      >
                        {lang === 'FR' ? 'Vu' : 'Reviewed'}
                      </button>
                    )}
                    {c.status !== 'RESOLVED' && (
                      <button
                        className="btn-ghost h-7 text-xs text-green-600"
                        onClick={(e) => { e.stopPropagation(); statusMut.mutate({ id: c.id, status: 'RESOLVED' }) }}
                      >
                        {lang === 'FR' ? 'Résoudre' : 'Resolve'}
                      </button>
                    )}
                    <button
                      className="btn-ghost h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); onNote(c) }}
                    >
                      <StickyNote size={12} className="mr-1" />
                      {lang === 'FR' ? 'Note' : 'Note'}
                    </button>
                  </div>
                </div>

                {/* Triggering message */}
                {c.triggeringMessage && (
                  <div className="flex items-start gap-2 text-xs text-neutral-500 bg-white dark:bg-neutral-800/60 rounded-lg p-2.5 mt-3">
                    <MessageSquare size={12} className="shrink-0 mt-0.5" />
                    <span className="italic">"{c.triggeringMessage}"</span>
                  </div>
                )}

                {/* Staff note */}
                {c.staffNote && (
                  <div className="flex items-start gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 mt-2">
                    <StickyNote size={12} className="shrink-0 mt-0.5" />
                    <span>{c.staffNote}</span>
                  </div>
                )}

                <p className="text-[10px] text-neutral-400 mt-2">
                  {new Date(c.createdAt).toLocaleString(lang === 'FR' ? 'fr-MA' : 'en-GB')}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Staff Note Modal ──────────────────────────────────────────────────────────

function StaffNoteModal({ complaint, lang, onClose, onSave, saving }: {
  complaint: Complaint; lang: string; onClose: () => void;
  onSave: (note: string) => void; saving: boolean
}) {
  const [note, setNote] = useState(complaint.staffNote ?? '')

  return (
    <Modal open={!!complaint} onClose={onClose} title={lang === 'FR' ? 'Note du personnel' : 'Staff Note'} size="md">
      <div className="space-y-4">
        <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-sm">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-neutral-500" />
            <p className="font-medium text-neutral-800 dark:text-neutral-200">{complaint.summary}</p>
          </div>
          <p className="text-xs text-neutral-500">
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
  const [noteTarget, setNoteTarget] = useState<Complaint | null>(null)

  const { data: complaints, isLoading, isError, refetch } = useQuery<Complaint[]>({
    queryKey: ['complaints', statusFilter, severityFilter],
    queryFn: () => {
      const params: any = {}
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (severityFilter !== 'ALL') params.severity = severityFilter
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

  // Group by patient
  const groups = useMemo<PatientGroup[]>(() => {
    const map = new Map<string, PatientGroup>()
    for (const c of items) {
      const pid = c.campaignPatient?.id ?? c.id
      const key = `${pid}`
      const existing = map.get(key)
      if (existing) {
        existing.complaints.push(c)
      } else {
        map.set(key, {
          patientId: pid,
          patientName: c.campaignPatient?.patientName ?? 'Unknown',
          phone: c.campaignPatient?.phone ?? '',
          campaignId: c.campaignPatient?.campaignId ?? '',
          complaints: [c],
        })
      }
    }
    // Sort groups by latest complaint date
    return Array.from(map.values()).sort((a, b) => {
      const aLatest = new Date(a.complaints[0].createdAt).getTime()
      const bLatest = new Date(b.complaints[0].createdAt).getTime()
      return bLatest - aLatest
    })
  }, [items])

  // Summary stats
  const stats = useMemo(() => {
    const newCount = items.filter(c => c.status === 'NEW').length
    const highCount = items.filter(c => c.severity === 'HIGH').length
    return { total: items.length, newCount, highCount }
  }, [items])

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={lang === 'FR' ? 'Plaintes' : 'Complaints'}
        subtitle={lang === 'FR' ? 'Suivi des plaintes et préoccupations patients' : 'Track patient complaints and concerns'}
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <AlertCircle size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">{stats.total}</p>
            <p className="text-xs text-neutral-500">{lang === 'FR' ? 'Total plaintes' : 'Total complaints'}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <MessageSquare size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">{stats.newCount}</p>
            <p className="text-xs text-neutral-500">{lang === 'FR' ? 'Nouvelles' : 'New'}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">{stats.highCount}</p>
            <p className="text-xs text-neutral-500">{lang === 'FR' ? 'Haute sévérité' : 'High severity'}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
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

      {/* Grouped list */}
      {groups.length === 0 ? (
        <Empty message={lang === 'FR' ? 'Aucune plainte' : 'No complaints yet'} />
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <PatientGroupCard
              key={group.patientId}
              group={group}
              lang={lang}
              onNote={(c) => setNoteTarget(c)}
              statusMut={statusMut}
            />
          ))}
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