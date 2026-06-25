import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Phone, Clock, Stethoscope, MessageSquare, XCircle,
  UserCheck, Bot, Send, Loader2, AlertTriangle, ShieldAlert,
} from 'lucide-react'
import {
  getCampaign,
  campaignTakeover,
  releaseBotControl,
  sendStaffMessage,
} from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
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

// ── Conversation Thread Drawer ───────────────────────────────────────────────

interface ConversationThreadProps {
  patient:    CampaignPatient
  lang:       string
  onClose:    () => void
  campaignId: string
}

function ConversationThread({ patient, lang, onClose, campaignId }: ConversationThreadProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Local state — optimistically updated so UI feels instant
  const [localMessages, setLocalMessages] = useState<CampaignMessage[]>(patient.messages ?? [])
  const [draftMessage,  setDraftMessage]  = useState('')

  // Derive whether this patient's session is currently admin-handled.
  // sessionStatus is optionally populated by the API. If not present,
  // we fall back to checking the session via the handovers endpoint.
  const [isAdminHandling, setIsAdminHandling] = useState<boolean>(
    patient.sessionStatus === 'admin_handling',
  )

  // Keep local messages in sync if parent re-fetches and passes new patient
  useEffect(() => {
    setLocalMessages(patient.messages ?? [])
  }, [patient.messages])

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages])

  // ── Takeover mutation ──────────────────────────────────────────────────────
  const takeoverMutation = useMutation({
    mutationFn: () => campaignTakeover(patient.phone),
    onSuccess: () => {
      setIsAdminHandling(true)
      toast(lang === 'FR' ? 'Conversation prise en charge' : 'Conversation taken over', 'success')
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? (lang === 'FR' ? 'Erreur' : 'Error')
      toast(msg, 'error')
    },
  })

  // ── Release mutation ───────────────────────────────────────────────────────
  const releaseMutation = useMutation({
    mutationFn: () => releaseBotControl(patient.phone),
    onSuccess: () => {
      setIsAdminHandling(false)
      toast(lang === 'FR' ? 'Bot réactivé' : 'Bot resumed', 'success')
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? (lang === 'FR' ? 'Erreur' : 'Error')
      toast(msg, 'error')
    },
  })

  // ── Send staff message mutation ────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (message: string) => sendStaffMessage(patient.phone, message),
    onSuccess: (_data, message) => {
      // Optimistic UI — append the sent message immediately
      const newMsg: CampaignMessage = {
        role:      'assistant',
        content:   message,
        timestamp: Date.now(),
      }
      setLocalMessages(prev => [...prev, newMsg])
      setDraftMessage('')
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? (lang === 'FR' ? 'Erreur d\'envoi' : 'Send error')
      toast(msg, 'error')
    },
  })

  const handleSend = () => {
    const trimmed = draftMessage.trim()
    if (!trimmed || sendMutation.isPending) return
    sendMutation.mutate(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isConversationEnded =
    patient.status === 'COMPLETED' ||
    patient.status === 'OPTED_OUT'  ||
    patient.status === 'NO_RESPONSE'

  const canTakeOver =
    !isAdminHandling &&
    !isConversationEnded &&
    (patient.status === 'CONTACTED' || patient.status === 'REPLIED')

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
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">
              {patient.patientName}
            </h3>
            <p className="text-xs text-neutral-500">{patient.phone}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Admin handling badge */}
            {isAdminHandling && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                <ShieldAlert size={10} />
                {lang === 'FR' ? 'Prise en charge' : 'Staff handling'}
              </span>
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

        {/* ── Takeover / Release bar ────────────────────────────────────── */}
        {!isConversationEnded && (
          <div className="shrink-0 px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
            {!isAdminHandling ? (
              <>
                <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <Bot size={13} className="text-blue-500" />
                  <span>{lang === 'FR' ? 'Bot actif' : 'Bot active'}</span>
                </div>
                {canTakeOver && (
                  <button
                    className="ml-auto btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"
                    onClick={() => takeoverMutation.mutate()}
                    disabled={takeoverMutation.isPending}
                  >
                    {takeoverMutation.isPending
                      ? <Loader2 size={12} className="animate-spin" />
                      : <UserCheck size={12} />
                    }
                    {lang === 'FR' ? 'Prendre en charge' : 'Take over'}
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 font-medium">
                  <AlertTriangle size={13} />
                  <span>{lang === 'FR' ? 'Bot silencieux — vous gérez' : 'Bot silent — you\'re handling'}</span>
                </div>
                <button
                  className="ml-auto btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
                  onClick={() => releaseMutation.mutate()}
                  disabled={releaseMutation.isPending}
                >
                  {releaseMutation.isPending
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Bot size={12} />
                  }
                  {lang === 'FR' ? 'Rendre au bot' : 'Release to bot'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Message thread ────────────────────────────────────────────── */}
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
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.timestamp && (
                    <p className={`text-[10px] mt-1 ${
                      msg.role === 'user' ? 'text-blue-200' : 'text-neutral-400'
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

        {/* ── Staff reply input — only visible when admin_handling ──────── */}
        {isAdminHandling && (
          <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 flex items-end gap-3">
            <textarea
              rows={2}
              className="flex-1 resize-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400"
              placeholder={lang === 'FR' ? 'Votre message...' : 'Your message...'}
              value={draftMessage}
              onChange={e => setDraftMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sendMutation.isPending}
            />
            <button
              className="shrink-0 w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSend}
              disabled={!draftMessage.trim() || sendMutation.isPending}
              aria-label={lang === 'FR' ? 'Envoyer' : 'Send'}
            >
              {sendMutation.isPending
                ? <Loader2 size={16} className="animate-spin" />
                : <Send size={16} />
              }
            </button>
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
    // Refetch every 15s so admin_handling badge stays current
    refetchInterval: 15_000,
  })

  // Keep selectedPatient in sync with fresh data from query refetches
  useEffect(() => {
    if (!selectedPatient || !campaign?.patients) return
    const fresh = campaign.patients.find(p => p.id === selectedPatient.id)
    if (fresh) setSelectedPatient(fresh)
  }, [campaign?.patients])

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

  // Count admin_handling sessions for awareness badge
  const handlingCount = patients.filter(p => p.sessionStatus === 'admin_handling').length

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

      {/* Staff-handling awareness banner */}
      {handlingCount > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 text-sm text-orange-700 dark:text-orange-300">
          <ShieldAlert size={15} />
          <span>
            {handlingCount} {lang === 'FR'
              ? `conversation${handlingCount > 1 ? 's' : ''} prise${handlingCount > 1 ? 's' : ''} en charge par le personnel`
              : `conversation${handlingCount > 1 ? 's' : ''} currently handled by staff`
            }
          </span>
        </div>
      )}

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
            const isHandling    = patient.sessionStatus === 'admin_handling'
            return (
              <div
                key={patient.id}
                className={`card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow ${
                  isHandling ? 'ring-1 ring-orange-300 dark:ring-orange-700' : ''
                }`}
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
                    {isHandling && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                        <ShieldAlert size={9} />
                        {lang === 'FR' ? 'Personnel' : 'Staff'}
                      </span>
                    )}
                    {patient.outcome && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                        {OUTCOME_LABELS[patient.outcome] ?? patient.outcome}
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

      {/* Conversation thread drawer */}
      {selectedPatient && (
        <ConversationThread
          patient={selectedPatient}
          lang={lang}
          onClose={() => setSelectedPatient(null)}
          campaignId={campaignId!}
        />
      )}
    </div>
  )
}