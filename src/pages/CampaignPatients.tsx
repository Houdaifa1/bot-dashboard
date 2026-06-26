import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Phone, Clock, Stethoscope, MessageSquare, XCircle,
  Send, CheckCircle, UserRound, RefreshCw
} from 'lucide-react'
import { getCampaign, sendPatientMessage, resolvePatientConversation, takeOverPatientConversation } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { PageHeader, PageLoader, Empty } from '../components/ui'
import type { Campaign, CampaignPatient, CampaignPatientStatus, CampaignMessage } from '../types'

function parseMessageContent(content: string): string {
  const trimmed = content.trim();
  if ((trimmed.startsWith('[') || trimmed.startsWith('{')) && (trimmed.endsWith(']') || trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n\n');
      }
    } catch {}
  }
  return content;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: 'bg-neutral-100 dark:bg-neutral-800',    text: 'text-neutral-600 dark:text-neutral-400', dot: 'bg-neutral-400' },
  PARKED:      { bg: 'bg-amber-100 dark:bg-amber-900/30',     text: 'text-amber-700 dark:text-amber-300',     dot: 'bg-amber-400'   },
  CONTACTED:   { bg: 'bg-blue-100 dark:bg-blue-900/30',       text: 'text-blue-700 dark:text-blue-300',       dot: 'bg-blue-400'    },
  REPLIED:     { bg: 'bg-purple-100 dark:bg-purple-900/30',   text: 'text-purple-700 dark:text-purple-300',   dot: 'bg-purple-400'  },
  COMPLETED:   { bg: 'bg-green-100 dark:bg-green-900/30',     text: 'text-green-700 dark:text-green-300',     dot: 'bg-green-400'   },
  OPTED_OUT:   { bg: 'bg-red-100 dark:bg-red-900/30',         text: 'text-red-700 dark:text-red-300',         dot: 'bg-red-400'     },
  NO_RESPONSE: { bg: 'bg-neutral-100 dark:bg-neutral-800',    text: 'text-neutral-500 dark:text-neutral-500', dot: 'bg-neutral-300' },
  HANDOFF:     { bg: 'bg-orange-100 dark:bg-orange-900/30',   text: 'text-orange-700 dark:text-orange-300',   dot: 'bg-orange-400' },
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', PARKED: 'Parked', CONTACTED: 'Contacted',
  REPLIED: 'Replied', COMPLETED: 'Completed', OPTED_OUT: 'Opted out', NO_RESPONSE: 'No response',
  HANDOFF: 'Needs agent',
}

const OUTCOME_LABELS: Record<string, string> = {
  COMPLETED: 'Completed', COMPLAINED: 'Complained', REBOOKED: 'Rebooked',
  HANDED_OFF: 'Handed off', URGENT: 'Urgent', OPTED_OUT: 'Opted out', NO_RESPONSE: 'No response',
}

// ── Conversation Thread Drawer ──────────────────────────────────────────────

function ConversationDrawer({ patient, campaignId, lang, onClose }: {
  patient: CampaignPatient; campaignId: string; lang: string; onClose: () => void
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const isHandoff = patient.outcome === 'HANDED_OFF' || patient.sessionStatus === 'handed_off' || patient.sessionStatus === 'admin_handling'
  const isActive = patient.status === 'CONTACTED' || patient.status === 'REPLIED'

  // Refresh conversation every 2s
  const { data: refreshed } = useQuery<CampaignPatient & { sessionStatus?: string }>({
    queryKey: ['campaign-conversation', patient.id],
    queryFn: async () => {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/v1/campaigns/${campaignId}/patients/${patient.id}/conversation`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load conversation')
      return res.json()
    },
    refetchInterval: 2_000,
  })

  const current = refreshed ?? patient
  const messages = current.messages ?? []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMut = useMutation({
    mutationFn: (msg: string) => sendPatientMessage(campaignId, patient.id, msg),
    onSuccess: () => {
      setDraft('')
      queryClient.invalidateQueries({ queryKey: ['campaign-conversation', patient.id] })
      toast(lang === 'FR' ? 'Message envoyé' : 'Message sent', 'success')
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Send failed', 'error'),
  })

  const takeOverMut = useMutation({
    mutationFn: () => takeOverPatientConversation(campaignId, patient.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-conversation', patient.id] })
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      toast(lang === 'FR' ? 'Conversation récupérée' : 'Conversation taken over', 'success')
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Error', 'error'),
  })

  const resolveMut = useMutation({
    mutationFn: () => resolvePatientConversation(campaignId, patient.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['campaign-conversation', patient.id] })
      onClose()
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Error', 'error'),
  })

  const handleSend = () => {
    const trimmed = draft.trim()
    if (!trimmed || sendMut.isPending) return
    sendMut.mutate(trimmed)
  }

  const handleTakeOver = () => {
    if (confirm(lang === 'FR' ? 'Récupérer cette conversation ? Le bot sera désactivé pour ce patient.' : 'Take over this conversation? The bot will be disabled for this patient.')) {
      takeOverMut.mutate()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-neutral-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="shrink-0 border-b px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                {patient.patientName}
                {isHandoff && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">HANDOFF</span>}
              </h3>
              <p className="text-xs text-neutral-500">{patient.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive && !isHandoff && (
              <button onClick={handleTakeOver} disabled={takeOverMut.isPending} className="btn-outline h-8 px-3 text-xs flex items-center gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50">
                <UserRound size={14} />
                {lang === 'FR' ? 'Prendre en charge' : 'Take over'}
              </button>
            )}
            {isHandoff && (
              <button onClick={() => resolveMut.mutate()} disabled={resolveMut.isPending} className="btn-outline h-8 px-3 text-xs flex items-center gap-1.5 border-green-300 text-green-600 hover:bg-green-50">
                <CheckCircle size={14} />
                {lang === 'FR' ? 'Résoudre' : 'Resolve'}
              </button>
            )}
            <button onClick={onClose} className="btn-ghost h-8 w-8 p-0"><XCircle size={18} /></button>
          </div>
        </div>

        {/* Info strip */}
        <div className="shrink-0 px-5 py-2 bg-neutral-50 dark:bg-neutral-800/50 border-b flex items-center gap-4 text-xs text-neutral-500">
          <span>📅 {new Date(patient.visitDate).toLocaleDateString()}</span>
          <span>👨‍⚕️ {patient.medecinTraitant}</span>
          <span>🔄 {current.turnCount ?? patient.turnCount} turns</span>
          {current.sessionStatus && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              current.sessionStatus === 'awaiting_reply' ? 'bg-blue-100 text-blue-700' :
              current.sessionStatus === 'active' ? 'bg-green-100 text-green-700' :
              current.sessionStatus === 'admin_handling' ? 'bg-orange-100 text-orange-700' :
              current.sessionStatus === 'handed_off' ? 'bg-red-100 text-red-700' :
              'bg-neutral-100 text-neutral-500'
            }`}>
              {current.sessionStatus}
            </span>
          )}
        </div>

        {/* Handoff banner */}
        {isHandoff && (
          <div className="shrink-0 px-5 py-2.5 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 flex items-center gap-2">
            <UserRound size={14} className="text-orange-600" />
            <p className="text-xs text-orange-700">{lang === 'FR' ? 'Agent mode — vous pouvez répondre directement.' : 'Agent mode — you can reply directly to the patient.'}</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-8">{lang === 'FR' ? 'Aucun message' : 'No messages'}</p>
          ) : (
            messages.map((msg: CampaignMessage, i: number) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : isHandoff
                      ? 'bg-orange-50 dark:bg-orange-900/20 text-neutral-800 rounded-bl-md border border-orange-200'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{parseMessageContent(msg.content)}</p>
                  {msg.timestamp && (
                    <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-neutral-400'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString(lang === 'FR' ? 'fr-MA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input — shown during handoff */}
        {(isHandoff || (current.sessionStatus === 'admin_handling')) && (
          <div className="shrink-0 border-t px-4 py-3">
            <div className="flex items-center gap-2">
              <textarea
                className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder={lang === 'FR' ? 'Écrire un message...' : 'Type a message...'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              />
              <button onClick={handleSend} disabled={sendMut.isPending || !draft.trim()} className="btn-primary h-10 w-10 p-0 flex items-center justify-center disabled:opacity-40">
                {sendMut.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
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
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus)
  const [selectedPatient, setSelectedPatient] = useState<CampaignPatient | null>(null)

  const { data: campaign, isLoading, isError, refetch } = useQuery<Campaign & { patients: CampaignPatient[] }>({
    queryKey: ['campaign', campaignId],
    queryFn: () => getCampaign(campaignId!),
    enabled: !!campaignId,
    refetchInterval: 5_000,
  })

  if (isLoading) return <PageLoader />

  if (isError || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-neutral-500">{lang === 'FR' ? 'Erreur de chargement' : 'Error loading'}</p>
        <button className="btn-outline" onClick={() => refetch()}>{lang === 'FR' ? 'Réessayer' : 'Retry'}</button>
      </div>
    )
  }

  const patients = campaign.patients ?? []

  // Compute handoff count
  const handoffCount = patients.filter(p =>
    p.outcome === 'HANDED_OFF' || p.sessionStatus === 'handed_off' || p.sessionStatus === 'admin_handling'
  ).length

  const counts: Record<string, number> = { ALL: patients.length, HANDOFF: handoffCount }
  for (const p of patients) counts[p.status] = (counts[p.status] ?? 0) + 1

  const filtered = statusFilter === 'ALL' ? patients
    : statusFilter === 'HANDOFF' ? patients.filter(p =>
        p.outcome === 'HANDED_OFF' || p.sessionStatus === 'handed_off' || p.sessionStatus === 'admin_handling'
      )
    : patients.filter(p => p.status === statusFilter)

  const filters = ['ALL', 'HANDOFF', 'PENDING', 'CONTACTED', 'REPLIED', 'COMPLETED', 'OPTED_OUT', 'NO_RESPONSE']
  const getLabel = (s: string) => s === 'HANDOFF' ? (lang === 'FR' ? 'Agent' : 'Agent') : STATUS_LABELS[s] || s

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <button className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 mb-3" onClick={() => navigate('/campaigns')}>
          <ArrowLeft size={14} />
          {lang === 'FR' ? '← Retour' : '← Back'}
        </button>
        <PageHeader title={campaign.name} subtitle={`${patients.length} patients • ${campaign.status}`} />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map(s => {
          const isActive = statusFilter === s
          const count = counts[s] ?? 0
          return (
            <button key={s} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isActive ? 'bg-blue-600 text-white shadow-sm' :
              s === 'HANDOFF' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 hover:bg-orange-200' :
              'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`} onClick={() => setStatusFilter(s)}>
              {getLabel(s)}{count > 0 && <span className="ml-1.5 opacity-70">({count})</span>}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <Empty message={lang === 'FR' ? 'Aucun patient' : 'No patients'} />
      ) : (
        <div className="space-y-2">
          {filtered.map(patient => {
            const isHandoff = patient.outcome === 'HANDED_OFF' || patient.sessionStatus === 'handed_off' || patient.sessionStatus === 'admin_handling'
            const statusKey = isHandoff ? 'HANDOFF' : patient.status
            const style = STATUS_STYLES[statusKey] ?? { bg: '', text: '', dot: 'bg-neutral-400' }

            return (
              <div key={patient.id} className="card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPatient(patient)}>
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot} ${isHandoff ? 'animate-pulse' : ''}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{patient.patientName}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${style.bg} ${style.text}`}>
                      {isHandoff ? '🚨 Agent' : STATUS_LABELS[patient.status]}
                    </span>
                    {patient.outcome && !isHandoff && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                        {OUTCOME_LABELS[patient.outcome] ?? patient.outcome}
                      </span>
                    )}
                    {patient.sessionStatus && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                        {patient.sessionStatus}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500 flex-wrap">
                    <span className="flex items-center gap-1"><Phone size={10} />{patient.phone}</span>
                    <span className="flex items-center gap-1"><Stethoscope size={10} />{patient.medecinTraitant}</span>
                    <span className="flex items-center gap-1"><Clock size={10} />{new Date(patient.visitDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-neutral-400">
                  {patient.messages?.length > 0 && (
                    <span className="flex items-center gap-1"><MessageSquare size={12} />{patient.messages.length}</span>
                  )}
                  <span>{patient.turnCount} turns</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedPatient && (
        <ConversationDrawer patient={selectedPatient} campaignId={campaignId!} lang={lang} onClose={() => setSelectedPatient(null)} />
      )}
    </div>
  )
}