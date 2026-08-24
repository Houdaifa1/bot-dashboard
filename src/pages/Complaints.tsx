import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Loader2, MessageSquare, StickyNote, ChevronDown, ChevronRight,
  Phone, Eye, CheckCircle, Inbox,
} from 'lucide-react'
import {
  getComplaints, updateComplaintStatus, updateComplaintStaffNote,
  updateComplaintStatusForPatient,
} from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import type { Lang } from '../i18n'
import { PageHeader, PageLoader, Modal, Field, ConfirmDialog } from '../components/ui'
import type { Complaint, ComplaintSeverity, ComplaintStatus } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Triage model
//
// The page is a work queue, not a report. Colour is spent on exactly one
// signal — severity — so a scan of the list answers "what do I open first?"
// without decoding a palette. Status, type and counts stay plain text.
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<ComplaintSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

/** The only coloured elements on the page. */
const SEVERITY_DOT: Record<ComplaintSeverity, string> = {
  HIGH:   'bg-red-500',
  MEDIUM: 'bg-amber-500',
  LOW:    'bg-neutral-300 dark:bg-neutral-600',
}

const SEVERITY_TEXT: Record<ComplaintSeverity, string> = {
  HIGH:   'text-red-600 dark:text-red-400',
  MEDIUM: 'text-amber-600 dark:text-amber-400',
  LOW:    'text-neutral-500 dark:text-neutral-400',
}

type StatusFilter = 'OPEN' | 'NEW' | 'REVIEWED' | 'RESOLVED' | 'ALL'
type SeverityFilter = 'ALL' | ComplaintSeverity

const isOpen = (c: Complaint) => c.status !== 'RESOLVED'

function severityLabel(sev: ComplaintSeverity, lang: Lang): string {
  if (sev === 'HIGH')   return t(lang, 'complaints_sev_high')
  if (sev === 'MEDIUM') return t(lang, 'complaints_sev_medium')
  return t(lang, 'complaints_sev_low')
}

function statusLabel(status: ComplaintStatus, lang: Lang): string {
  if (status === 'NEW')      return t(lang, 'complaints_status_NEW')
  if (status === 'REVIEWED') return t(lang, 'complaints_status_REVIEWED')
  return t(lang, 'complaints_status_RESOLVED')
}

/**
 * Unknown enum values must still render. The previous version returned null for
 * an unmapped type, which silently removed the complaint — and its entire
 * patient group — from the page.
 */
function typeLabel(type: string, lang: Lang): string {
  if (type === 'COMPLAINT')        return t(lang, 'complaints_type_COMPLAINT')
  if (type === 'MEDICAL_CONCERN')  return t(lang, 'complaints_type_MEDICAL_CONCERN')
  if (type === 'URGENT')           return t(lang, 'complaints_type_URGENT')
  return type
}

function ageLabel(iso: string, lang: Lang): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (hours < 1)  return t(lang, 'complaints_age_now')
  if (hours < 24) return `${hours}${t(lang, 'complaints_age_hours')}`
  return `${Math.floor(hours / 24)}${t(lang, 'complaints_age_days')}`
}

function formatDateTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === 'FR' ? 'fr-MA' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ─────────────────────────────────────────────────────────────────────────────

interface PatientGroup {
  patientId:    string
  patientName:  string
  phone:        string
  campaignId:   string
  complaints:   Complaint[]
  open:         Complaint[]
  resolved:     Complaint[]
  worstOpen:    ComplaintSeverity | null
  oldestOpenAt: string | null
}

// ── Severity marker ───────────────────────────────────────────────────────────

function SeverityDot({ severity }: { severity: ComplaintSeverity | null }) {
  // inline-block is load-bearing: width/height are ignored on a plain inline
  // span, which renders the dot at 0x0.
  return (
    <span
      aria-hidden
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${severity ? SEVERITY_DOT[severity] : 'bg-neutral-200 dark:bg-neutral-700'}`}
    />
  )
}

// ── Single complaint row ──────────────────────────────────────────────────────

function ComplaintRow({ complaint: c, lang, onNote, onStatus, pending }: {
  complaint: Complaint
  lang: Lang
  onNote: (c: Complaint) => void
  onStatus: (id: string, status: ComplaintStatus) => void
  pending: boolean
}) {
  const resolved = c.status === 'RESOLVED'

  return (
    <div className={`px-5 py-4 border-t border-neutral-100 dark:border-neutral-800 ${resolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <SeverityDot severity={c.severity} />
            <span className={`text-[11px] font-medium ${SEVERITY_TEXT[c.severity] ?? 'text-neutral-500'}`}>
              {severityLabel(c.severity, lang)}
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">·</span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{typeLabel(c.type, lang)}</span>
            <span className="text-neutral-300 dark:text-neutral-700">·</span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{statusLabel(c.status, lang)}</span>
          </div>

          <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">{c.summary}</p>

          {c.triggeringMessage && (
            <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 px-3 py-2">
              <MessageSquare size={12} className="shrink-0 mt-0.5 text-neutral-400" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-neutral-400 mb-0.5">
                  {t(lang, 'complaints_patientMessage')}
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 break-words">{c.triggeringMessage}</p>
              </div>
            </div>
          )}

          {c.staffNote && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-neutral-100 dark:border-neutral-800 px-3 py-2">
              <StickyNote size={12} className="shrink-0 mt-0.5 text-neutral-400" />
              <p className="text-xs text-neutral-600 dark:text-neutral-300 break-words">{c.staffNote}</p>
            </div>
          )}

          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2">
            {formatDateTime(c.createdAt, lang)}
            {resolved && c.resolvedAt && ` · ${statusLabel('RESOLVED', lang)} ${formatDateTime(c.resolvedAt, lang)}`}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {pending && <Loader2 size={13} className="animate-spin text-neutral-400 mr-1" />}

          {c.status === 'NEW' && (
            <button
              disabled={pending}
              onClick={() => onStatus(c.id, 'REVIEWED')}
              className="px-2.5 py-1 rounded-md text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
            >
              {t(lang, 'complaints_action_review')}
            </button>
          )}

          {resolved ? (
            <button
              disabled={pending}
              onClick={() => onStatus(c.id, 'NEW')}
              className="px-2.5 py-1 rounded-md text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
            >
              {t(lang, 'complaints_action_reopen')}
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() => onStatus(c.id, 'RESOLVED')}
              className="px-2.5 py-1 rounded-md text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
            >
              {t(lang, 'complaints_action_resolve')}
            </button>
          )}

          <button
            disabled={pending}
            title={t(lang, 'complaints_action_note')}
            onClick={() => onNote(c)}
            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
          >
            <StickyNote size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Patient group ─────────────────────────────────────────────────────────────

function PatientGroupCard({ group, lang, onNote, onStatus, onResolveAll, pendingIds, bulkPending }: {
  group: PatientGroup
  lang: Lang
  onNote: (c: Complaint) => void
  onStatus: (id: string, status: ComplaintStatus) => void
  onResolveAll: (group: PatientGroup) => void
  pendingIds: Set<string>
  bulkPending: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const navigate = useNavigate()

  const openCount = group.open.length
  const preview   = group.open[0] ?? group.complaints[0]
  const totalWord = group.complaints.length === 1
    ? t(lang, 'complaints_word_one')
    : t(lang, 'complaints_word_many')

  return (
    <div className="card overflow-hidden">
      {/* The expand target and the row actions are siblings, never nested
          buttons — nesting is invalid HTML and swallows the inner clicks. */}
      <div className="flex items-stretch">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 min-w-0 px-5 py-4 flex items-start gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
        >
          <span className="mt-1.5"><SeverityDot severity={group.worstOpen} /></span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-neutral-800 dark:text-neutral-100">{group.patientName}</span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500 inline-flex items-center gap-1">
                <Phone size={10} /> {group.phone}
              </span>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {group.complaints.length} {totalWord}
              {openCount > 0 && group.oldestOpenAt
                ? ` · ${openCount} ${String(t(lang, 'complaints_stat_open')).toLowerCase()} · ${t(lang, 'complaints_openFor')} ${ageLabel(group.oldestOpenAt, lang)}`
                : ` · ${t(lang, 'complaints_allClear')}`}
            </p>

            {!expanded && preview && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 line-clamp-1">{preview.summary}</p>
            )}
          </div>

          <span className="mt-0.5 text-neutral-400 shrink-0">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </button>

        <div className="flex items-center gap-1 pl-1 pr-4 py-4 shrink-0">
          {group.campaignId && (
            <button
              title={t(lang, 'complaints_action_conversation')}
              onClick={() => navigate(`/campaigns/${group.campaignId}/patients?patientId=${group.patientId}`)}
              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <Eye size={14} />
            </button>
          )}

          {openCount > 0 && (
            <button
              disabled={bulkPending}
              onClick={() => onResolveAll(group)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
            >
              {bulkPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              {t(lang, 'complaints_action_resolveAll')} ({openCount})
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="bg-neutral-50/50 dark:bg-neutral-800/20">
          {group.open.map(c => (
            <ComplaintRow
              key={c.id} complaint={c} lang={lang}
              onNote={onNote} onStatus={onStatus}
              pending={pendingIds.has(c.id) || bulkPending}
            />
          ))}

          {group.resolved.length > 0 && (
            <>
              <button
                onClick={() => setShowResolved(v => !v)}
                className="w-full px-5 py-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors"
              >
                {showResolved ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {group.resolved.length} {t(lang, 'complaints_resolvedGroup')}
              </button>

              {showResolved && group.resolved.map(c => (
                <ComplaintRow
                  key={c.id} complaint={c} lang={lang}
                  onNote={onNote} onStatus={onStatus}
                  pending={pendingIds.has(c.id) || bulkPending}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Staff note modal ──────────────────────────────────────────────────────────

function StaffNoteModal({ complaint, lang, onClose, onSave, saving }: {
  complaint: Complaint
  lang: Lang
  onClose: () => void
  onSave: (note: string) => void
  saving: boolean
}) {
  const [note, setNote] = useState(complaint.staffNote ?? '')
  // Clearing a note is a legitimate edit, so the guard is "unchanged", not
  // "empty" — an empty note is stored as null server-side.
  const unchanged = note.trim() === (complaint.staffNote ?? '').trim()

  return (
    <Modal open onClose={onClose} title={t(lang, 'complaints_note_title')} size="md">
      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
          <p className="text-sm text-neutral-800 dark:text-neutral-200">{complaint.summary}</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {complaint.campaignPatient?.patientName} · {complaint.campaignPatient?.phone}
          </p>
        </div>

        <Field label={t(lang, 'complaints_note_title')}>
          <textarea
            className="input h-28 resize-none"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t(lang, 'complaints_note_placeholder')}
          />
        </Field>

        <div className="flex justify-end gap-3">
          <button className="btn-outline" onClick={onClose} disabled={saving}>{t(lang, 'cancel')}</button>
          <button className="btn-primary" onClick={() => onSave(note)} disabled={saving || unchanged}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : t(lang, 'save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Stat tile (doubles as a filter control) ───────────────────────────────────

function StatTile({ label, value, active, accent, onClick }: {
  label: string
  value: number
  active: boolean
  accent?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left transition-colors ${
        active
          ? 'ring-1 ring-neutral-400 dark:ring-neutral-500'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
      }`}
    >
      <p className={`text-2xl font-semibold leading-none ${
        accent && value > 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-800 dark:text-neutral-100'
      }`}>
        {value}
      </p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">{label}</p>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function ComplaintsPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Default to the triage view: what still needs a human.
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('OPEN')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const [noteTarget, setNoteTarget]         = useState<Complaint | null>(null)
  const [resolveAllTarget, setResolveAllTarget] = useState<PatientGroup | null>(null)

  // One unfiltered fetch, filtered in memory. Server-side filters would swap the
  // query key on every click, unmounting the list into a spinner and collapsing
  // every expanded group — and would make the counters below describe the
  // filtered subset rather than the real totals.
  const { data, isLoading, isError, refetch, error } = useQuery<Complaint[]>({
    queryKey: ['complaints'],
    queryFn: () => getComplaints(),
    refetchInterval: 30_000,
  })

  const all = useMemo(() => data ?? [], [data])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['complaints'] })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ComplaintStatus }) =>
      updateComplaintStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['complaints'] })
      const previous = queryClient.getQueryData<Complaint[]>(['complaints'])
      queryClient.setQueryData<Complaint[]>(['complaints'], old =>
        old?.map(c => (c.id === id ? { ...c, status } : c)),
      )
      return { previous }
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['complaints'], ctx.previous)
      toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error')
    },
    onSuccess: () => toast(t(lang, 'complaints_status_updated'), 'success'),
    onSettled: invalidate,
  })

  const bulkMut = useMutation({
    mutationFn: ({ campaignPatientId }: { campaignPatientId: string }) =>
      updateComplaintStatusForPatient(campaignPatientId, 'RESOLVED'),
    onMutate: async ({ campaignPatientId }) => {
      await queryClient.cancelQueries({ queryKey: ['complaints'] })
      const previous = queryClient.getQueryData<Complaint[]>(['complaints'])
      queryClient.setQueryData<Complaint[]>(['complaints'], old =>
        old?.map(c => (c.campaignPatientId === campaignPatientId
          ? { ...c, status: 'RESOLVED' as ComplaintStatus }
          : c)),
      )
      return { previous }
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['complaints'], ctx.previous)
      toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error')
    },
    onSuccess: (res) => {
      toast(`${res.count} ${t(lang, 'complaints_resolveAll_done')}`, 'success')
      setResolveAllTarget(null)
    },
    onSettled: invalidate,
  })

  const noteMut = useMutation({
    mutationFn: ({ id, staffNote }: { id: string; staffNote: string }) =>
      updateComplaintStaffNote(id, staffNote),
    onSuccess: () => {
      invalidate()
      toast(t(lang, 'complaints_note_saved'), 'success')
      setNoteTarget(null)
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? t(lang, 'errorSaving'), 'error'),
  })

  // Counters always describe the whole dataset, never the current filter.
  const stats = useMemo(() => {
    const open = all.filter(isOpen)
    return {
      open:     open.length,
      high:     open.filter(c => c.severity === 'HIGH').length,
      patients: new Set(open.map(c => c.campaignPatientId)).size,
      resolved: all.length - open.length,
    }
  }, [all])

  const groups = useMemo<PatientGroup[]>(() => {
    const matches = (c: Complaint) => {
      if (severityFilter !== 'ALL' && c.severity !== severityFilter) return false
      if (statusFilter === 'ALL')  return true
      if (statusFilter === 'OPEN') return isOpen(c)
      return c.status === statusFilter
    }

    const map = new Map<string, PatientGroup>()

    for (const c of all) {
      if (!matches(c)) continue
      // Complaint.campaignPatientId is required in the schema, so the group key
      // is always well defined — no "Unknown patient" bucket is possible.
      const key = c.campaignPatientId
      let g = map.get(key)
      if (!g) {
        g = {
          patientId:    key,
          patientName:  c.campaignPatient?.patientName ?? key,
          phone:        c.campaignPatient?.phone ?? '',
          campaignId:   c.campaignPatient?.campaignId ?? '',
          complaints:   [],
          open:         [],
          resolved:     [],
          worstOpen:    null,
          oldestOpenAt: null,
        }
        map.set(key, g)
      }
      g.complaints.push(c)
    }

    for (const g of map.values()) {
      // Severity first, then oldest first — the longest-waiting issue on top.
      g.complaints.sort((a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      g.open     = g.complaints.filter(isOpen)
      g.resolved = g.complaints.filter(c => !isOpen(c))
      g.worstOpen = g.open.length
        ? g.open.reduce<ComplaintSeverity>(
            (worst, c) => (SEVERITY_RANK[c.severity] < SEVERITY_RANK[worst] ? c.severity : worst),
            g.open[0].severity,
          )
        : null
      g.oldestOpenAt = g.open.length
        ? g.open.reduce<string>(
            (oldest, c) => (new Date(c.createdAt) < new Date(oldest) ? c.createdAt : oldest),
            g.open[0].createdAt,
          )
        : null
    }

    return Array.from(map.values()).sort((a, b) => {
      // Patients with open work first, then worst severity, then who has been
      // waiting longest.
      if (!!a.open.length !== !!b.open.length) return a.open.length ? -1 : 1
      if (a.worstOpen && b.worstOpen && a.worstOpen !== b.worstOpen) {
        return SEVERITY_RANK[a.worstOpen] - SEVERITY_RANK[b.worstOpen]
      }
      const aTime = new Date(a.oldestOpenAt ?? a.complaints[0].createdAt).getTime()
      const bTime = new Date(b.oldestOpenAt ?? b.complaints[0].createdAt).getTime()
      return a.open.length ? aTime - bTime : bTime - aTime
    })
  }, [all, statusFilter, severityFilter])

  const pendingIds = useMemo(() => {
    const s = new Set<string>()
    if (statusMut.isPending && statusMut.variables) s.add(statusMut.variables.id)
    return s
  }, [statusMut.isPending, statusMut.variables])

  const filtersActive = statusFilter !== 'ALL' || severityFilter !== 'ALL'

  const clearFilters = () => { setStatusFilter('ALL'); setSeverityFilter('ALL') }

  const toggleStatus = (next: StatusFilter) =>
    setStatusFilter(prev => (prev === next ? 'ALL' : next))

  const renderList = () => {
    // A genuinely empty dataset and a filter that hides everything are different
    // states and must never share a message.
    if (all.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400 dark:text-neutral-600">
          <Inbox size={32} className="mb-3 opacity-30" />
          <p className="text-sm">{t(lang, 'complaints_empty_none')}</p>
        </div>
      )
    }

    if (groups.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-400 dark:text-neutral-600">
          <Inbox size={32} className="opacity-30" />
          <p className="text-sm">{t(lang, 'complaints_empty_filtered')}</p>
          <button className="btn-outline" onClick={clearFilters}>
            {t(lang, 'complaints_clearFilters')}
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-2.5">
        {groups.map(g => (
          <PatientGroupCard
            key={g.patientId}
            group={g}
            lang={lang}
            onNote={setNoteTarget}
            onStatus={(id, status) => statusMut.mutate({ id, status })}
            onResolveAll={setResolveAllTarget}
            pendingIds={pendingIds}
            bulkPending={bulkMut.isPending && bulkMut.variables?.campaignPatientId === g.patientId}
          />
        ))}
      </div>
    )
  }

  const renderContent = () => {
    if (isLoading) return <PageLoader />

    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertTriangle size={20} className="text-neutral-300 dark:text-neutral-700" />
          <p className="text-sm text-neutral-500">
            {error instanceof Error ? error.message : t(lang, 'errorLoading')}
          </p>
          <button className="btn-outline" onClick={() => refetch()}>{t(lang, 'tryAgain')}</button>
        </div>
      )
    }

    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatTile
            label={t(lang, 'complaints_stat_open')} value={stats.open}
            active={statusFilter === 'OPEN'} onClick={() => toggleStatus('OPEN')}
          />
          <StatTile
            label={t(lang, 'complaints_stat_high')} value={stats.high} accent
            active={severityFilter === 'HIGH'}
            onClick={() => setSeverityFilter(p => (p === 'HIGH' ? 'ALL' : 'HIGH'))}
          />
          <StatTile
            label={t(lang, 'complaints_stat_patients')} value={stats.patients}
            active={false} onClick={() => toggleStatus('OPEN')}
          />
          <StatTile
            label={t(lang, 'complaints_stat_resolved')} value={stats.resolved}
            active={statusFilter === 'RESOLVED'} onClick={() => toggleStatus('RESOLVED')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          {([
            ['OPEN',     t(lang, 'complaints_filter_open')],
            ['NEW',      t(lang, 'complaints_filter_new')],
            ['REVIEWED', t(lang, 'complaints_filter_reviewed')],
            ['RESOLVED', t(lang, 'complaints_filter_resolved')],
            ['ALL',      t(lang, 'all')],
          ] as [StatusFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === key
                  ? 'bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {label}
            </button>
          ))}

          <span className="w-px h-5 bg-neutral-200 dark:bg-neutral-800 mx-1" />

          <select
            className="input w-auto py-1.5 text-xs"
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value as SeverityFilter)}
          >
            <option value="ALL">{t(lang, 'complaints_filter_allSev')}</option>
            <option value="HIGH">{t(lang, 'complaints_sev_high')}</option>
            <option value="MEDIUM">{t(lang, 'complaints_sev_medium')}</option>
            <option value="LOW">{t(lang, 'complaints_sev_low')}</option>
          </select>

          {filtersActive && (
            <button
              onClick={clearFilters}
              className="px-2.5 py-1.5 rounded-lg text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {t(lang, 'complaints_clearFilters')}
            </button>
          )}
        </div>

        {renderList()}
      </>
    )
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title={t(lang, 'complaints_title')} subtitle={t(lang, 'complaints_subtitle')} />
      {renderContent()}

      {noteTarget && (
        <StaffNoteModal
          complaint={noteTarget}
          lang={lang}
          onClose={() => setNoteTarget(null)}
          onSave={note => noteMut.mutate({ id: noteTarget.id, staffNote: note })}
          saving={noteMut.isPending}
        />
      )}

      <ConfirmDialog
        open={!!resolveAllTarget}
        lang={lang}
        icon={CheckCircle}
        title={t(lang, 'complaints_resolveAll_title')}
        body={`${resolveAllTarget?.patientName ?? ''} — ${resolveAllTarget?.open.length ?? 0} ${t(lang, 'complaints_word_many')}. ${t(lang, 'complaints_resolveAll_body')}`}
        confirmLabel={t(lang, 'complaints_action_resolveAll')}
        loading={bulkMut.isPending}
        onClose={() => setResolveAllTarget(null)}
        onConfirm={() => {
          if (!resolveAllTarget) return
          bulkMut.mutate({ campaignPatientId: resolveAllTarget.patientId })
        }}
      />
    </div>
  )
}
