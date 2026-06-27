import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Phone, Send, Loader2, CheckCircle2, X, MessageSquare,
  Clock, AlertCircle, RefreshCw,
} from 'lucide-react'
import { getHandoffSessions, sendHandoffMessage, resolveHandoff } from '../api'
import { useToast } from '../store/toast'
import { PageHeader, PageLoader } from '../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HandoffMessage {
  role:      string
  content:   string
  timestamp: number
}

interface HandoffSession {
  campaignPatientId: string
  campaignId:        string
  patientName:       string
  phone:             string
  language:          string | null
  messages:          HandoffMessage[]
  turnCount:         number
  handoffReason:     string
  handedOffAt:       number
  lastActivityAt:    number
}

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

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Conversation Panel ───────────────────────────────────────────────────────

function ConversationPanel({
  session,
  onClose,
}: {
  session: HandoffSession
  onClose: () => void
}) {
  const { toast }      = useToast()
  const qc             = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState('')

  const { data: sessions } = useQuery<HandoffSession[]>({
    queryKey: ['handoff-sessions'],
    queryFn:  getHandoffSessions,
    refetchInterval: 2000,
  })

  const live     = sessions?.find(s => s.phone === session.phone) ?? session
  const messages = live.messages.filter(m => !!parseContent(m.content))

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const [lastSentTs, setLastSentTs] = useState<number | null>(null)

  const sendMut = useMutation({
    mutationFn: (msg: string) => sendHandoffMessage(session.phone, msg),
    onSuccess: () => {
      setDraft('')
      setLastSentTs(Date.now())
      qc.invalidateQueries({ queryKey: ['handoff-sessions'] })
    },
    onError: (e: any) => toast(e?.response?.data?.message ?? 'Send failed', 'error'),
  })

  const resolveMut = useMutation({
    mutationFn: () => resolveHandoff(session.phone),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handoff-sessions'] })
      toast('Session resolved', 'success')
      onClose()
    },
    onError: (e: any) => toast(e?.response?.data?.message ?? 'Error', 'error'),
  })

  const handleSend = useCallback(() => {
    const msg = draft.trim()
    if (!msg || sendMut.isPending) return
    sendMut.mutate(msg)
  }, [draft, sendMut])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 flex flex-col shadow-2xl transition-colors duration-200">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 px-5 py-4 bg-white dark:bg-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{session.patientName}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  Handoff
                </span>
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5 font-mono">{session.phone}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => resolveMut.mutate()}
                disabled={resolveMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 text-xs font-medium transition-colors"
              >
                {resolveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Resolve
              </button>
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1"><Clock size={9} />{timeAgo(live.lastActivityAt)}</span>
            <span className="flex items-center gap-1">
              <MessageSquare size={9} />
              {messages.length} messages
            </span>
            <span>{live.turnCount} turns</span>
          </div>
        </div>

        {/* ── Messages ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-gray-950">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600">
              <MessageSquare size={28} className="mb-2 opacity-30" />
              <p className="text-sm">No messages</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const content   = parseContent(msg.content)
              if (!content) return null
              const isPatient = msg.role === 'user'
              const isStaff   = !isPatient

              return (
                <div key={i} className={`flex ${isPatient ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-left ${
                      isPatient
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : isStaff
                          ? 'bg-orange-50 dark:bg-orange-950/20 text-gray-900 dark:text-gray-100 rounded-bl-sm border border-orange-200 dark:border-orange-900/40'
                          : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-bl-sm border border-gray-100 dark:border-gray-800 shadow-sm'
                    }`}
                  >
                    {isStaff && (
                      <p className="text-[10px] font-semibold text-orange-500 dark:text-orange-400 mb-1 uppercase tracking-wide">
                        Staff
                      </p>
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

        {/* ── Input ──────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={2}
              className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
              placeholder="Type a message to the patient..."
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sendMut.isPending}
            />
            <button
              onClick={handleSend}
              disabled={sendMut.isPending || !draft.trim()}
              className="shrink-0 w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-40 transition-colors"
            >
              {sendMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 px-1">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onClick,
}: {
  session: HandoffSession
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-4 flex items-center gap-4 cursor-pointer hover:border-red-200 dark:hover:border-red-900 hover:shadow-sm transition-all group"
    >
      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
        <Phone size={16} className="text-red-500 dark:text-red-400" />
      </div>

      <div className="flex-1 min-w-0 text-start">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{session.patientName}</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
            <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />
            needs agent
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">{session.phone}</p>
      </div>

      <div className="shrink-0 text-end">
        <p className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(session.lastActivityAt)}</p>
        <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">
          {session.turnCount} turns
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function HandoffPage() {
  const [selected, setSelected] = useState<HandoffSession | null>(null)

  const { data: sessions, isLoading, isError, refetch } = useQuery<HandoffSession[]>({
    queryKey: ['handoff-sessions'],
    queryFn:  getHandoffSessions,
    refetchInterval: 3000,
  })

  if (isLoading) return <PageLoader />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
        <AlertCircle size={20} className="text-gray-300 dark:text-gray-700" />
        <p className="text-sm">Failed to load sessions</p>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          onClick={() => refetch()}
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    )
  }

  const items = sessions ?? []

  return (
    <div className="max-w-3xl mx-auto px-4 pb-10">
      <div className="mb-6">
        <PageHeader
          title="Pending Handoffs"
          subtitle="Patients waiting for a human response"
        />
      </div>

      {items.length > 0 && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/50 flex items-center justify-center shrink-0 mt-0.5">
            <Phone size={14} className="text-red-600 dark:text-red-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {items.length} patient{items.length > 1 ? 's' : ''} waiting
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/60 mt-0.5">
              Click a patient to open the conversation and reply directly.
            </p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600">
          <CheckCircle2 size={32} className="mb-3 opacity-30" />
          <p className="text-sm font-medium text-gray-500">All clear</p>
          <p className="text-xs mt-1">No pending handoffs right now</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(s => (
            <SessionCard key={s.phone} session={s} onClick={() => setSelected(s)} />
          ))}
        </div>
      )}

      {selected && (
        <ConversationPanel
          session={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}