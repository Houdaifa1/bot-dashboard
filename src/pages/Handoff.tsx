import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Phone, CheckCircle2, AlertTriangle } from 'lucide-react'
import { getHandoffSessions, resolveHandoff } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import { PageHeader, PageLoader, Empty } from '../components/ui'

interface HandoffSession {
  phone: string
  state: string
  patientName?: string
  updatedAt: number
}

export function HandoffPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: sessions, isLoading, isError, refetch } = useQuery<HandoffSession[]>({
    queryKey: ['handoff-sessions'],
    queryFn: () => getHandoffSessions(),
    refetchInterval: 10_000, // auto-refresh every 10s
  })

  const mutation = useMutation({
    mutationFn: (phone: string) => resolveHandoff(phone),
    onSuccess: () => {
      toast(t(lang, 'handoff_resolved'), 'success')
      queryClient.invalidateQueries({ queryKey: ['handoff-sessions'] })
    },
    onError: () => {
      toast(t(lang, 'errorSaving'), 'error')
    },
  })

  const handleResolve = (phone: string) => {
    mutation.mutate(phone)
  }

  const formatPhone = (phone: string) => {
    // Strip JID suffixes and format for display
    return phone.replace(/@(lid|s\.whatsapp\.net)$/, '').replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(lang === 'FR' ? 'fr-MA' : 'en-GB')
  }

  if (isLoading) return <PageLoader />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-neutral-500">{t(lang, 'errorLoading')}</p>
        <button className="btn-outline" onClick={() => refetch()}>
          {t(lang, 'tryAgain')}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t(lang, 'handoff_title')}
        subtitle={t(lang, 'handoff_subtitle')}
      />

      {/* Info card */}
      <div className="card p-5 mb-6 flex items-start gap-4 bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/50">
        <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
          <Phone size={16} className="text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
          {t(lang, 'handoff_info')}
        </p>
      </div>

      {/* Active sessions list */}
      {!sessions || sessions.length === 0 ? (
        <Empty message={t(lang, 'noData')} />
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div key={session.phone} className="card p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {session.patientName || 'Unknown'}
                  </p>
                  <p className="text-sm tabular-nums text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {formatPhone(session.phone)}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                    {formatTime(session.updatedAt)}
                  </p>
                </div>
              </div>
              <button
                className="btn-primary shrink-0"
                onClick={() => handleResolve(session.phone)}
                disabled={mutation.isPending}
              >
                {mutation.isPending
                  ? <Loader2 size={14} className="animate-spin" />
                  : <CheckCircle2 size={14} className="inline mr-1.5" />
                }
                {t(lang, 'handoff_resolve')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}