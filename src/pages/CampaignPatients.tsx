import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Phone, Clock, Stethoscope, MessageSquare, XCircle,
  Bot, Send, CheckCircle, UserRound
} from 'lucide-react'
import { getCampaign, sendPatientMessage, resolvePatientConversation } from '../api'
import { useAuth } from '../store/auth'
import { PageHeader, PageLoader, Empty } from '../components/ui'
import type { Campaign, CampaignPatient, CampaignPatientStatus, CampaignMessage } from '../types'

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CampaignPatientStatus, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: 'bg-neutral-100 dark:bg-neutral-800',    text: 'text-neutral-600 dark:text-neutral-400', dot: 'bg-neutral-400' },
  PARKED:      { bg: 'bg-amber-100 dark:bg-amber-900/30',     text: 'text-amber-700 dark:text-amber-300',     dot: 'bg-amber-400'   },
  CONTACTED:   { bg: 'bg-blue-100 dark:bg-blue-900/30',       text: 'text-blue-700 dark:text-blue-300',       dot: 'bg-blue-400'    },
  REPLIED:     { bg: 'bg-purple-100 dark:bg-purple-900/30',   text: 'text-purple-700 dark:text-purple-300',   dot: 'bg-purple-400'  },
  COMPLETED:   { bg: 'bg-green-100 dark:bg-green-900/30',     text: 'text-green-700 dark:text-green-300',     dot: 'bg-green-400'   },
  OPTED_OUT:   { bg: 'bg-red-100 dark:bg-red-900/30',         text: 'text-red-700 dark:text-red-300',         dot: 'bg-red-400'     },
  NO_RESPONSE: { bg: 'bg-neutral-100 dark:bg-neutral-800',    text: 'text-neutral-500 dark:text-neutral-500', dot: 'bg-neutral-300' },
}

const STATUS_LABELS: Record<CampaignPatientStatus, string> = {
  PENDING: 'Pending', PARKED: 'Parked', CONTACTED: 'Contacted',
  REPLIED: 'Replied', COMPLETED: 'Completed', OPTED_OUT: 'Opted out', NO_RESPONSE: 'No response',
}

const OUTCOME_LABELS: Record<string, string> = {
  COMPLETED: 'Completed', COMPLAINED: 'Complained', REBOOKED: 'Rebooked',
  HANDED_OFF: 'Handed off', URGENT: 'Urgent', OPTED_OUT: 'Opted out', NO_RESPONSE: 'No response',
}

// ── Conversation Thread Drawer (live agent mode) ──────────────────────────────

interface ConversationThreadProps {
  patient:    CampaignPatient
  campaignId: string
  lang:       string
  onClose:    () => void
}

function ConversationThread({ patient, campaignId, lang, onClose }: ConversationThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [localMessages, setLocalMessages] = useState<CampaignMessage[]>(patient.messages ?? [])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const queryClient = useQueryClient()

  const isHandoff =
    patient.status === 'COMPLETED' &&
    (patient.outcome === 'HANDED_OFF' || patient.sessionStatus === 'handed_off' || patient.sessionStatus === 'admin_handling')

  // Refresh conversation every 3s when drawer is open
  const { data: refreshed } = useQuery<CampaignPatient>({
    queryKey: ['campaign-patient', patient.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/v1/campaigns/${campaignId}/patients/${patient.id}/conversation`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') }` },
      })
      if (!res.ok) throw new Error('Failed to load conversation')
      return res.json()
    },
    enabled: !!patient.id,
    refetchInterval: 3000,
  })

  useEffect(() => {
    if (refreshed?.messages) {
      setLocalMessages(refreshed.messages)
    }
  }, [refreshed])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages])

  const sendMutation = useMutation({
    mutationFn: (msg: string) => sendPatientMessage(campaignId, patient.id, msg),
    onSuccess: () => {
      setDraft('')
      setSending(false)
      queryClient.invalidateQueries({ queryKey: ['campaign-patient', patient.id] })
    },
    onError: () => setSending(false),
  })

  const resolveMutation = useMutation({
    mutationFn: () => resolvePatientConversation(campaignId, patient.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['campaign-patient', patient.id] })
      onClose()
    },
  })

  const handleSend = () => {
    const trimmed = draft.trim()
    if (!trimmed || sending) return
    setSending(true)
    sendMutation.mutate(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 shadow-2xl flex flex-col">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-neutral-200 dark:border-neutral-800 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
              {patient.patientName}
              {isHandoff && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">HANDOFF</span>}
            </h3>
            <p className="text-xs text-neutral-500">{patient.phone}</p>
          </div>
          <div className="flex items-center gap-2">
            {isHandoff && (
              <button
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending}
                className="btn-outline h-8 px-3 text-xs flex items-center gap-1.5"
                title={lang === 'FR' ? 'Marquer comme résolu' : 'Mark as resolved'}
              >
                <CheckCircle size={14} />
                {lang === 'FR' ? 'Résoudre' : 'Resolve'}
              </button>
            )}
            <button onClick={onClose} className="btn-ghost h-8 w-8 p-0">
              <XCircle size={18} />
            </button>
          </div>
        </div>

        {/* ── Patient info strip ─────────────────────────────────────────── */}
        <div className="shrink-0 px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-1.5 text-xs text-neutral-500">
            <span>📅 {new Date(patient.visitDate).toLocaleDateString(lang === 'FR' ? 'fr-MA' : 'en-GB')}</span>
            <span>👨‍⚕️ {patient.medecinTraitant}</span>
            <span>📋 {patient.prestation}</span>
            <span>🔄 {lang === 'FR' ? 'Tours' : 'Turns'}: {patient.turnCount}</span>
            {patient.outcome && (
              <span className="col-span-2">
                📊 {OUTCOME_LABELS[patient.outcome] ?? patient.outcome}
              </span>
            )}
          </div>
        </div>

        {/* ── Handoff banner (agent mode) ────────────────────────────────── */}
        {isHandoff && (
          <div className="shrink-0 px-5 py-2.5 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-900/40 flex items-center gap-2">
            <UserRound size={14} className="text-orange-600 dark:text-orange-400" />
            <p className="text-xs text-orange-700 dark:text-orange-300">
              {lang === 'FR'
                ? 'Conversation en mode agent. Vous pouvez répondre directement au patient.'
                : 'Conversation in agent mode. You can reply directly to the patient.'}
            </p>
          </div>
        )}

        {/* ── Bot status bar (read-only) ────────────────────────────────── */}
        {!isHandoff && !(
          patient.status === 'COMPLETED' ||
          patient.status === 'OPTED_OUT' ||
          patient.status === 'NO_RESPONSE'
        ) && (
          <div className="shrink-0 px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Bot size={13} className="text-blue-500" />
              <span>{lang === 'FR' ? 'Bot actif' : 'Bot active'}</span>
            </div>
          </div>
        )}

        {/* ── Message thread ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {localMessages.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-8">
              {lang === 'FR' ? 'Aucun message' : 'No messages yet'}
            </p>
          ) : (
            localMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : msg.role === 'assistant' && isHandoff
                      ? 'bg-orange-50 dark:bg-orange-900/20 text-neutral-800 dark:text-neutral-200 rounded-bl-md border border-orange-100 dark:border-orange-900/40'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.timestamp && (
                    <p className={`text-[10px] mt-1 ${
                      msg.role === 'user'
                        ? 'text-blue-200'
                        : 'text-neutral-400'
                    }`}>
                      {new Date(msg.timestamp).toLocaleTimeString(
                        lang === 'FR' ? 'fr-MA' : 'en-GB',
                        { hour: '2-digit', minute: '2-digit' },
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Agent input (only in handoff mode) ─────────────────────────── */}
        {isHandoff && (
          <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <textarea
                className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder={lang === 'FR' ? 'Écrire un message au patient...' : 'Type a message to the patient...'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !draft.trim()}
                className="btn-primary h-10 w-10 p-0 flex items-center justify-center disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mt-1.5">
              {lang === 'FR'
                ? 'Le message sera envoyé via WhatsApp et enregistré dans la conversation.'
                : 'Message will be sent via WhatsApp and saved to the conversation.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function CampaignPatientsPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { lang } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialStatus = (searchParams.get('status') as CampaignPatientStatus | null) ?? 'ALL'
  const [statusFilter,     setStatusFilter]     = useState<CampaignPatientStatus | 'ALL'>(initialStatus)
  const [selectedPatient,  setSelectedPatient]  = useState<CampaignPatient | null>(null)

  const { data: campaign, isLoading, isError, refetch } = useQuery<Campaign & { patients: CampaignPatient[] }>({
    queryKey: ['campaign', campaignId],
    queryFn:  () => getCampaign(campaignId!),
    enabled:  !!campaignId,
  })

  if (isLoading) return <PageLoader />

  if (isError || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-neutral-500">
          {lang === 'FR' ? 'Erreur de chargement' : 'Error loading data'}
        </p>
        <button className="btn-outline" onClick={() => refetch()}>
          {lang === 'FR' ? 'Réessayer' : 'Try again'}
        </button>
      </div>
    )
  }

  const patients = campaign.patients ?? []
  const filtered = statusFilter === 'ALL'
    ? patients
    : patients.filter(p => p.status === statusFilter)

  // Status counts for filter chips
  const counts: Record<string, number> = {}
  for (const p of patients) {
    counts[p.status] = (counts[p.status] ?? 0) + 1
  }

  const statusFilters: (CampaignPatientStatus | 'ALL')[] = [
    'ALL', 'PENDING', 'CONTACTED', 'REPLIED', 'COMPLETED', 'OPTED_OUT', 'NO_RESPONSE',
  ]

  return (
    <div className="max-w-6xl">
      {/* Back + header */}
      <div className="mb-6">
        <button
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 mb-3"
          onClick={() => navigate('/campaigns')}
        >
          <ArrowLeft size={14} />
          {lang === 'FR' ? 'Retour aux campagnes' : 'Back to campaigns'}
        </button>
        <PageHeader
          title={campaign.name}
          subtitle={`${patients.length} ${lang === 'FR' ? 'patients' : 'patients'} • ${campaign.status}`}
        />
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statusFilters.map(s => {
          const isActive = statusFilter === s
          const count    = s === 'ALL' ? patients.length : (counts[s] ?? 0)
          return (
            <button
              key={s}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'ALL' ? (lang === 'FR' ? 'Tous' : 'All') : STATUS_LABELS[s]}
              {count > 0 && <span className="ml-1.5 opacity-70">({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Patient list */}
      {filtered.length === 0 ? (
        <Empty message={lang === 'FR' ? 'Aucun patient dans cette catégorie' : 'No patients in this category'} />
      ) : (
        <div className="space-y-2">
          {filtered.map(patient => {
            const style         = STATUS_STYLES[patient.status]
            const isHandoff =
              patient.status === 'COMPLETED' &&
              (patient.outcome === 'HANDED_OFF' || patient.sessionStatus === 'handed_off' || patient.sessionStatus === 'admin_handling')

            return (
              <div
                key={patient.id}
                className="card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedPatient(patient)}
              >
                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />

                {/* Patient info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {patient.patientName}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${style.bg} ${style.text}`}>
                      {STATUS_LABELS[patient.status]}
                    </span>
                    {patient.outcome && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                        {OUTCOME_LABELS[patient.outcome] ?? patient.outcome}
                      </span>
                    )}
                    {isHandoff && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        {lang === 'FR' ? 'Prise en charge' : 'Live agent'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Phone size={10} />
                      {patient.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Stethoscope size={10} />
                      {patient.medecinTraitant}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(patient.visitDate).toLocaleDateString(lang === 'FR' ? 'fr-MA' : 'en-GB')}
                    </span>
                  </div>
                </div>

                {/* Turn count + message count */}
                <div className="flex items-center gap-2 shrink-0 text-xs text-neutral-400">
                  {patient.messages && patient.messages.length > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare size={12} />
                      {patient.messages.length}
                    </span>
                  )}
                  <span>{patient.turnCount} {lang === 'FR' ? 'tours' : 'turns'}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Conversation thread drawer (live when handoff) */}
      {selectedPatient && (
        <ConversationThread
          patient={selectedPatient}
          campaignId={campaignId!}
          lang={lang}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </div>
  )
}