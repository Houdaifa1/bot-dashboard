import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { getBotMessages, updateBotMessage } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import { PageHeader, PageLoader } from '../components/ui'
import type { BotMessage } from '../types'

// Variables that can appear in message bodies
const VARIABLES: Record<string, string[]> = {
  SELECT_DOCTOR:    ['{{specialty}}'],
  CONFIRM_BOOKING:  ['{{patientName}}', '{{doctorName}}', '{{date}}', '{{time}}'],
  BOOKING_SUCCESS:  ['{{doctorName}}', '{{date}}', '{{time}}'],
  NO_SLOTS_AVAILABLE: ['{{doctorName}}'],
  OUTSIDE_HOURS:    ['{{workingHours}}'],
}

interface GroupedMessage {
  key: string
  fr: BotMessage | null
  en: BotMessage | null
}

function groupMessages(messages: BotMessage[]): GroupedMessage[] {
  const map = new Map<string, GroupedMessage>()
  for (const msg of messages) {
    if (!map.has(msg.key)) map.set(msg.key, { key: msg.key, fr: null, en: null })
    const group = map.get(msg.key)!
    if (msg.language === 'FR') group.fr = msg
    else if (msg.language === 'EN') group.en = msg
  }
  return Array.from(map.values())
}

function MessageRow({
  group,
  clinicId,
  lang,
}: {
  group: GroupedMessage
  clinicId: string
  lang: 'FR' | 'EN'
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [frBody, setFrBody] = useState(group.fr?.body ?? '')
  const [enBody, setEnBody] = useState(group.en?.body ?? '')
  const [frDirty, setFrDirty] = useState(false)
  const [enDirty, setEnDirty] = useState(false)

  useEffect(() => {
    setFrBody(group.fr?.body ?? '')
    setEnBody(group.en?.body ?? '')
    setFrDirty(false)
    setEnDirty(false)
  }, [group])

  const mutateFr = useMutation({
    mutationFn: () => updateBotMessage(clinicId, group.key, 'FR', frBody),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-messages', clinicId] })
      toast(t(lang, 'msg_saved'), 'success')
      setFrDirty(false)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const mutateEn = useMutation({
    mutationFn: () => updateBotMessage(clinicId, group.key, 'EN', enBody),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-messages', clinicId] })
      toast(t(lang, 'msg_saved'), 'success')
      setEnDirty(false)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const vars = VARIABLES[group.key]

  return (
    <div className="card p-5 space-y-4">
      {/* Key header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs font-mono font-medium text-neutral-600 dark:text-neutral-400">
            {group.key}
          </span>
          {vars && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {t(lang, 'msg_hint')}: {vars.join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* FR / EN side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* FR */}
        {group.fr && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t(lang, 'msg_fr')}
              </span>
              <span className="text-xs text-neutral-400 dark:text-neutral-600">
                {new Date(group.fr.updatedAt).toLocaleDateString(
                  lang === 'FR' ? 'fr-MA' : 'en-GB',
                  { day: '2-digit', month: 'short', year: 'numeric' }
                )}
              </span>
            </div>
            <textarea
              className="input min-h-[90px] resize-y text-sm leading-relaxed"
              value={frBody}
              onChange={e => { setFrBody(e.target.value); setFrDirty(true) }}
            />
            <div className="flex justify-end">
              <button
                className="btn-primary h-8 px-3 text-xs"
                disabled={!frDirty || mutateFr.isPending}
                onClick={() => mutateFr.mutate()}
              >
                {mutateFr.isPending
                  ? <Loader2 size={12} className="animate-spin" />
                  : t(lang, 'save')
                }
              </button>
            </div>
          </div>
        )}

        {/* EN */}
        {group.en && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t(lang, 'msg_en')}
              </span>
              <span className="text-xs text-neutral-400 dark:text-neutral-600">
                {new Date(group.en.updatedAt).toLocaleDateString(
                  lang === 'FR' ? 'fr-MA' : 'en-GB',
                  { day: '2-digit', month: 'short', year: 'numeric' }
                )}
              </span>
            </div>
            <textarea
              className="input min-h-[90px] resize-y text-sm leading-relaxed"
              value={enBody}
              onChange={e => { setEnBody(e.target.value); setEnDirty(true) }}
            />
            <div className="flex justify-end">
              <button
                className="btn-primary h-8 px-3 text-xs"
                disabled={!enDirty || mutateEn.isPending}
                onClick={() => mutateEn.mutate()}
              >
                {mutateEn.isPending
                  ? <Loader2 size={12} className="animate-spin" />
                  : t(lang, 'save')
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function BotMessagesPage() {
  const { lang, admin } = useAuth()
  const clinicId = admin!.clinicId

  const { data: messages, isLoading, isError, refetch } = useQuery<BotMessage[]>({
    queryKey: ['bot-messages', clinicId],
    queryFn: () => getBotMessages(clinicId),
  })

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

  const grouped = groupMessages(messages ?? [])

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t(lang, 'msg_title')}
        subtitle={t(lang, 'msg_subtitle')}
      />

      <div className="space-y-3">
        {grouped.map(group => (
          <MessageRow
            key={group.key}
            group={group}
            clinicId={clinicId}
            lang={lang}
          />
        ))}
      </div>
    </div> 
  )
}
