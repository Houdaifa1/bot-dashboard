import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, Phone, CheckCircle2, Send, MessageSquare, Bot, XCircle,
} from 'lucide-react'
import { getHandoffSessions, sendHandoffMessage, resolveHandoff } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { PageHeader, PageLoader, Empty } from '../components/ui'

// Helper to parse message content (handles JSON stored by backend)
function parseMessageContent(content: string): string {
  const trimmed = content.trim();
  if ((trimmed.startsWith('[') || trimmed.startsWith('{')) && (trimmed.endsWith(']') || trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        // Extract text from content blocks (e.g., [{"type":"text","text":"Hello"}])
        return parsed
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n\n');
      }
    } catch {
      // Not valid JSON, return as-is
    }
  }
  return content;
}

interface HandoffSession {
  campaignPatientId: string
  campaignId:        string
  patientName:       string
  phone:             string
  language:          string | null
  messages:          { role: string; content: string; timestamp: number }[]
  turnCount:         number
  handoffReason:     string
  handedOffAt:       number
  lastActivityAt:    number
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function ConversationDrawer({ session, lang, onClose }: {
  session: HandoffSession; lang: string; onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [localMsgs, setLocalMsgs] = useState(session.messages)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMsgs])

  const sendMut = useMutation({
    mutationFn: () => sendHandoffMessage(session.phone, draft.trim()),
    onSuccess: () => {
      const newMsg = { role: 'assistant', content: draft.trim(), timestamp: Date.now() }
      setLocalMsgs(prev => [...prev, newMsg])
      setDraft('')
      queryClient.invalidateQueries({ queryKey: ['handoff-sessions'] })
      toast(lang === 'FR' ? 'Message envoyé' : 'Message sent', 'success')
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Error', 'error'),
  })

  const resolveMut = useMutation({
    mutationFn: () => resolveHandoff(session.phone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handoff-sessions'] })
      toast(lang === 'FR' ? 'Session résolue' : 'Session resolved', 'success')
      onClose()
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Error', 'error'),
  })

  const handleSend = () => {
    if (!draft.trim() || sendMut.isPending) return
    sendMut.mutate()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="shrink-0 border-b px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">{session.patientName}</h3>
            <p className="text-xs text-neutral-500">{session.phone}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium">
              Handoff
            </span>
            <button onClick={onClose} className="btn-ghost h-8 w-8 p-0">
              <XCircle size={18} />
            </button>
          </div>
        </div>

        {/* Info strip */}
        <div className="shrink-0 px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b text-xs text-neutral-500 space-y-1">
          <p><span className="font-medium">Reason:</span> {session.handoffReason}</p>
          <p><span className="font-medium">Turns:</span> {session.turnCount}</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {localMsgs.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{parseMessageContent(msg.content)}</p>
                {msg.timestamp && (
                  <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-neutral-400'}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t px-4 py-3 flex items-end gap-3">
          <textarea
            rows={2}
            className="flex-1 resize-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder={lang === 'FR' ? 'Votre message...' : 'Your message...'}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sendMut.isPending}
          />
          <button
            className="shrink-0 w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-50"
            onClick={handleSend}
            disabled={!draft.trim() || sendMut.isPending}
          >
            {sendMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        {/* Resolve button */}
        <div className="shrink-0 px-4 pb-3">
          <button
            className="w-full btn-outline text-xs py-2 flex items-center justify-center gap-2 border-green-300 text-green-600 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
            onClick={() => resolveMut.mutate()}
            disabled={resolveMut.isPending}
          >
            {resolveMut.isPending
              ? <Loader2 size={12} className="animate-spin" />
              : <CheckCircle2 size={12} />
            }
            {lang === 'FR' ? 'Marquer comme résolu' : 'Mark as resolved'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function HandoffPage() {
  const { lang } = useAuth()
  const [selectedSession, setSelectedSession] = useState<HandoffSession | null>(null)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const sendMutation = useMutation({
    mutationFn: ({ phone, message }: { phone: string; message: string }) =>
      sendHandoffMessage(phone, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handoff-sessions'] })
      toast(lang === 'FR' ? 'Message envoyé' : 'Message sent', 'success')
      setReplyTexts(prev => {
        const next = { ...prev }
        delete next[expandedSession ?? '']
        return next
      })
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Send failed', 'error'),
  })

  const { data: sessions, isLoading, isError, refetch } = useQuery<HandoffSession[]>({
    queryKey: ['handoff-sessions'],
    queryFn: () => getHandoffSessions(),
    refetchInterval: 10_000,
  })

  if (isLoading) return <PageLoader />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-neutral-500">{lang === 'FR' ? 'Erreur de chargement' : 'Error loading data'}</p>
        <button className="btn-outline" onClick={() => refetch()}>
          {lang === 'FR' ? 'Réessayer' : 'Try again'}
        </button>
      </div>
    )
  }

  const items = sessions ?? []

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={lang === 'FR' ? 'Sessions en attente' : 'Pending Handoffs'}
        subtitle={lang === 'FR' ? "Patients en attente d'une réponse humaine" : 'Patients waiting for a human response'}
      />

      {/* Info card */}
      <div className="card p-5 mb-6 flex items-start gap-4 bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/50">
        <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
          <Phone size={16} className="text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">
            {lang === 'FR' ? 'Répondre aux patients' : 'Respond to patients'}
          </p>
          <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
            {lang === 'FR'
              ? 'Ces patients ont demandé à parler à un humain. Cliquez sur une session pour voir la conversation et répondre.'
              : 'These patients asked to speak to a human. Click a session to view the conversation and reply.'
            }
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <Empty message={lang === 'FR' ? 'Aucune session en attente' : 'No pending handoffs'} />
      ) : (
        <div className="space-y-3">
          {items.map(session => {
            const isExpanded = expandedSession === session.phone
            return (
              <div
                key={session.phone}
                className={`card transition-all ${isExpanded ? 'p-0 overflow-hidden' : 'p-5'}`}
              >
                {!isExpanded ? (
                  <div
                    className="flex items-center justify-between gap-4 cursor-pointer hover:shadow-md"
                    onClick={() => setExpandedSession(session.phone)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                        <MessageSquare size={18} className="text-red-600 dark:text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                          {session.patientName}
                        </p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {session.phone}
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 line-clamp-1">
                          {session.handoffReason}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-neutral-400">{session.turnCount} turns</span>
                      <div className="flex items-center gap-1 text-xs text-blue-500">
                        <Bot size={12} />
                        <span>AI</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-neutral-200 dark:border-neutral-700">
                    {/* Inline conversation */}
                    <div className="p-4 max-h-[420px] overflow-y-auto space-y-3 bg-neutral-50 dark:bg-neutral-800/30">
                      {session.messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-md border border-neutral-200 dark:border-neutral-700'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{parseMessageContent(msg.content)}</p>
                            {msg.timestamp && (
                              <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-neutral-400'}`}>
                                {formatTime(msg.timestamp)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Inline reply */}
                    <div className="p-3 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                      <div className="flex items-end gap-2">
                        <textarea
                          rows={2}
                          className="flex-1 resize-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={lang === 'FR' ? 'Répondre à ce patient...' : 'Reply to this patient...'}
                          value={replyTexts[session.phone] ?? ''}
                          onChange={e => setReplyTexts(prev => ({ ...prev, [session.phone]: e.target.value }))}
                        />
                        <button
                          className="shrink-0 w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-50"
                          disabled={sendMutation.isPending || !(replyTexts[session.phone]?.trim())}
                          onClick={() => {
                            const text = replyTexts[session.phone]?.trim()
                            if (!text) return
                            sendMutation.mutate({ phone: session.phone, message: text })
                          }}
                        >
                          {sendMutation.isPending
                            ? <Loader2 size={16} className="animate-spin" />
                            : <Send size={16} />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <button
                          className="text-[11px] text-neutral-400 hover:text-neutral-600"
                          onClick={() => setExpandedSession(null)}
                        >
                          {lang === 'FR' ? 'Fermer' : 'Close'}
                        </button>
                        <button
                          className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedSession(null)
                            setSelectedSession(session)
                          }}
                        >
                          {lang === 'FR' ? 'Ouvrir dans un volet' : 'Open in drawer'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedSession && (
        <ConversationDrawer
          session={selectedSession}
          lang={lang}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  )
}