import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Phone, Clock, Stethoscope, MessageSquare,
  X, UserRound, Loader2, AlertCircle,
  RefreshCw, ChevronRight,
} from 'lucide-react'
import {
  getCampaign,
  takeOverPatientConversation,
} from '../api'
import { useToast } from '../store/toast'
import { PageHeader, PageLoader, Empty } from '../components/ui'
import type { Campaign, CampaignPatient, CampaignMessage } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseContent(content: string): string | null {
  if (!content?.trim()) return null
  const t = content.trim()
  if ((t.startsWith('[') || t.startsWith('{')) && (t.endsWith(']') || t.endsWith('}'))) {
    try {
      const parsed = JSON.parse(t)
      if (Array.isArray(parsed)) {
        const text = parsed
          .filter((b: any) => b.type === 'text' && b.text?.trim())
          .map((b: any) => b.text.trim())
          .join('\n\n')
        return text || null
      }
      if (parsed?.type === 'tool_result' || parsed?.type === 'tool_use') return null
    } catch {}
  }
  return content
}

function formatTime(ts: number | string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  PENDING:     { label: 'Pending',     dot: 'bg-gray-300',    badge: 'bg-gray-100 text-gray-600' },
  PARKED:      { label: 'Parked',      dot: 'bg-yellow-400',  badge: 'bg-yellow-100 text-yellow-700' },
  CONTACTED:   { label: 'Contacted',   dot: 'bg-blue-400',    badge: 'bg-blue-100 text-blue-700' },
  REPLIED:     { label: 'Replied',     dot: 'bg-purple-400',  badge: 'bg-purple-100 text-purple-700' },
  COMPLETED:   { label: 'Completed',   dot: 'bg-green-400',   badge: 'bg-green-100 text-green-700' },
  OPTED_OUT:   { label: 'Opted out',   dot: 'bg-red-400',     badge: 'bg-red-100 text-red-700' },
  NO_RESPONSE: { label: 'No response', dot: 'bg-gray-300',    badge: 'bg-gray-100 text-gray-500' },
  HANDOFF:     { label: 'Needs agent', dot: 'bg-orange-400',  badge: 'bg-orange-100 text-orange-700' },
}

function isAgentSession(p: { sessionStatus?: string | null; outcome?: string | null }): boolean {
  // If session is completed, it's no longer an active agent session
  if (p.sessionStatus?.toLowerCase() === 'completed') {
    return false
  }
  
  return (
    p.sessionStatus?.toLowerCase() === 'handed_off' ||
    p.sessionStatus?.toLowerCase() === 'admin_handling' ||
    p.outcome?.toUpperCase() === 'HANDED_OFF'
  )
}

// ─── Conversation Drawer (Watch Mode) ──────────────────────────────────────

function ConversationDrawer({
  patient,
  campaignId,
  onClose,
}: {
  patient: CampaignPatient
  campaignId: string
  onClose: () => void
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: conv, isLoading } = useQuery({
    queryKey: ['conv', patient.id],
    queryFn: async () => {
      const token = localStorage.getItem('token')
      const res = await fetch(
        `/api/admin/v1/campaigns/${campaignId}/patients/${patient.id}/conversation`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error('Failed to load conversation')
      return res.json()
    },
    refetchInterval: 2000,
  })

  const live         = conv ?? patient
  const sessionStatus = live.sessionStatus?.toLowerCase() ?? null
  const isAgent      = isAgentSession(live)

  const messages: CampaignMessage[] = (live.messages ?? []).filter((m: CampaignMessage) => {
    const parsed = parseContent(m.content)
    return !!parsed
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const takeMut = useMutation({
    mutationFn: () => takeOverPatientConversation(campaignId, patient.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conv', patient.id] })
      qc.invalidateQueries({ queryKey: ['campaign', campaignId] })
      toast('You are now handling this patient', 'success')
      navigate(`/handoff?patientId=${patient.id}`)
    },
    onError: (e: any) => toast(e?.response?.data?.message ?? 'Error', 'error'),
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 flex flex-col shadow-2xl transition-colors duration-200">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 px-5 py-4 bg-white dark:bg-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">
                  {patient.patientName}
                </span>
                {isAgent && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                    Agent
                  </span>
                )}
                {sessionStatus && !isAgent && (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    sessionStatus === 'active' ? 'bg-green-100 text-green-700' :
                    sessionStatus === 'awaiting_reply' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {sessionStatus.replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5 font-mono">{patient.phone}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isAgent && (sessionStatus === 'active' || sessionStatus === 'awaiting_reply') && (
                <button
                  onClick={() => takeMut.mutate()}
                  disabled={takeMut.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-xs font-medium transition-colors"
                >
                  {takeMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <UserRound size={12} />}
                  Take over
                </button>
              )}

              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1"><Clock size={10} />{formatDate(patient.visitDate)}</span>
            <span className="flex items-center gap-1"><Stethoscope size={10} />{patient.medecinTraitant}</span>
            <span className="flex items-center gap-1"><MessageSquare size={10} />{messages.length} messages</span>
            <span>{live.turnCount ?? patient.turnCount} turns</span>
          </div>
        </div>

        {/* ── Messages ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-gray-950">
          {isLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-gray-300 dark:text-gray-700" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600">
              <MessageSquare size={28} className="mb-2 opacity-30" />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const content = parseContent(msg.content)
              if (!content) return null

              const isPatient    = msg.role === 'user'
              const isStaffReply = !isPatient && isAgent

              return (
                <div key={i} className={`flex ${isPatient ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-left ${
                    isPatient
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : isStaffReply
                        ? 'bg-orange-50 dark:bg-orange-950/20 text-gray-900 dark:text-gray-100 rounded-bl-sm border border-orange-200 dark:border-orange-900/40'
                        : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-bl-sm border border-gray-100 dark:border-gray-800 shadow-sm'
                  }`}>
                    {isStaffReply && (
                      <p className="text-[10px] font-semibold text-orange-500 dark:text-orange-400 mb-1 uppercase tracking-wide">Staff</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
                    {msg.timestamp && (
                      <p className={`text-[10px] mt-1.5 ${isPatient ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input (Strictly Watch Mode with Reply Redirect) ────────────── */}
        <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-4 bg-gray-50 dark:bg-gray-950 text-center flex flex-col items-center justify-center">
          {isAgent ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                This patient requires active agent attention.
              </p>
              <button
                onClick={() => {
                  onClose()
                  navigate(`/handoff?patientId=${patient.id}`)
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors shadow-sm w-full max-w-xs justify-center"
              >
                <MessageSquare size={16} /> Reply in Handoff Panel
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {sessionStatus === 'completed'
                ? 'This conversation has been marked resolved.'
                : 'Viewing conversation history (Read-only mode).'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Patient Row ─────────────────────────────────────────────────────────────

function PatientRow({
  patient,
  onClick,
}: {
  patient: CampaignPatient
  onClick: () => void
}) {
  const agent = isAgentSession(patient)
  const sk    = agent ? 'HANDOFF' : patient.status
  const cfg   = STATUS_CONFIG[sk] ?? STATUS_CONFIG.PENDING

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm transition-all group"
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${agent ? 'animate-pulse' : ''}`} />

      <div className="flex-1 min-w-0 text-start">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{patient.patientName}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.badge}`}>
            {cfg.label}
          </span>
          {patient.outcome && patient.outcome !== 'HANDED_OFF' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 dark:bg-gray-950 text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-800">
              {patient.outcome}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><Phone size={9} />{patient.phone}</span>
          <span className="flex items-center gap-1"><Stethoscope size={9} />{patient.medecinTraitant}</span>
          <span className="flex items-center gap-1"><Clock size={9} />{formatDate(patient.visitDate)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400 dark:text-gray-500">
        {(patient.messages?.length ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare size={11} />{patient.messages.length}
          </span>
        )}
        <span>{patient.turnCount}t</span>
        <ChevronRight size={14} className="text-gray-300 dark:text-gray-700 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors" />
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const FILTERS = ['ALL', 'HANDOFF', 'PENDING', 'PARKED', 'CONTACTED', 'REPLIED', 'COMPLETED', 'OPTED_OUT', 'NO_RESPONSE'] as const
type FilterKey = typeof FILTERS[number]

export function CampaignPatientsPage() {
  const { campaignId }    = useParams<{ campaignId: string }>()
  const navigate          = useNavigate()
  const [searchParams]    = useSearchParams()
  const initialFilter     = (searchParams.get('status') ?? 'ALL') as FilterKey
  const [filter, setFilter] = useState<FilterKey>(initialFilter)
  const [selected, setSelected] = useState<CampaignPatient | null>(null)

  const { data, isLoading, isError, refetch } = useQuery<Campaign & { patients: CampaignPatient[] }>({
    queryKey: ['campaign', campaignId],
    queryFn: () => getCampaign(campaignId!),
    enabled: !!campaignId,
    refetchInterval: 5000,
  })

  if (isLoading) return <PageLoader />

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
        <AlertCircle size={20} className="text-gray-300 dark:text-gray-700" />
        <p className="text-sm">Failed to load campaign</p>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          onClick={() => refetch()}
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    )
  }

  const patients    = data.patients ?? []
  const agentCount  = patients.filter(isAgentSession).length

  const counts: Partial<Record<FilterKey, number>> = { ALL: patients.length, HANDOFF: agentCount }
  for (const p of patients) {
    const k = p.status as FilterKey
    counts[k] = (counts[k] ?? 0) + 1
  }

  const filtered =
    filter === 'ALL'     ? patients :
    filter === 'HANDOFF' ? patients.filter(isAgentSession) :
    patients.filter(p => p.status === filter)

  return (
    <div className="max-w-3xl mx-auto px-4 pb-10">
      <div className="mb-6">
        <button
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-3 transition-colors"
          onClick={() => navigate('/campaigns')}
        >
          <ArrowLeft size={13} /> Back to campaigns
        </button>
        <PageHeader
          title={data.name}
          subtitle={`${patients.length} patients · ${data.status}`}
        />
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Contacted', value: data.contactedCount, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Replied',   value: data.repliedCount,   color: 'text-purple-600 dark:text-purple-400' },
          { label: 'Completed', value: data.completedCount, color: 'text-green-600 dark:text-green-400' },
          { label: 'No reply',  value: data.noResponseCount, color: 'text-gray-400 dark:text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-start">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map(f => {
          const count = counts[f] ?? 0
          const cfg   = STATUS_CONFIG[f]
          const isActive = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-sm'
                  : f === 'HANDOFF' && agentCount > 0
                    ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {cfg?.label ?? f}
              {count > 0 && <span className="ml-1.5 opacity-60">{count}</span>}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <Empty message="No patients in this category" />
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <PatientRow 
              key={p.id} 
              patient={p} 
              onClick={() => setSelected(p)} // Changed back to just opening the drawer for everyone
            />
          ))}
        </div>
      )}

      {selected && (
        <ConversationDrawer
          patient={selected}
          campaignId={campaignId!}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}