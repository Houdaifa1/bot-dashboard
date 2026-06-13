import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import { getBotMessages, updateBotMessage } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import { PageHeader, PageLoader } from '../components/ui'
import type { BotMessage } from '../types'

// ── All 36 BotMessage keys, categorised ──────────────────────────────────────

const CATEGORIES: { name: string; keys: string[] }[] = [
  {
    name: 'Conversation Flow',
    keys: [
      'WELCOME',
      'LANGUAGE_PROMPT',
      'ASK_NAME',
      'SELECT_SPECIALTY',
      'SELECT_DOCTOR',
      'SELECT_DATE',
      'SELECT_TIME',
      'CONFIRM_BOOKING',
      'BOOKING_SUCCESS',
      'BOOKING_CANCELLED',
    ],
  },
  {
    name: 'FAQ',
    keys: [
      'FAQ_INTRO',
      'FAQ_NOT_FOUND',
      'FAQ_FOLLOW_UP',
      'FAQ_LIST_PROMPT',
    ],
  },
  {
    name: 'Errors',
    keys: [
      'FALLBACK',
      'HANDOFF_TRIGGERED',
      'SESSION_EXPIRED',
      'NO_SLOTS_AVAILABLE',
      'OUTSIDE_HOURS',
      'ERROR_MISSING_INFO',
      'ERROR_DOCTOR_NOT_FOUND',
      'ERROR_SPECIALTY_NOT_FOUND',
      'ERROR_MISSING_SPECIALTY',
      'ERROR_MISSING_DOCTOR',
    ],
  },
  {
    name: 'Buttons',
    keys: [
      'BUTTON_CONFIRM',
      'BUTTON_CANCEL',
      'BUTTON_BOOK_APP',
      'BUTTON_FAQ',
      'BUTTON_AGENT',
      'BUTTON_MENU',
      'BUTTON_FRENCH',
      'BUTTON_ENGLISH',
    ],
  },
  {
    name: 'Headers',
    keys: [
      'HEADER_SPECIALTIES',
      'HEADER_DOCTORS',
      'HEADER_TIMES',
      'HEADER_SELECT_TIME',
    ],
  },
]

// Variables that can appear in message bodies
const VARIABLES: Record<string, string[]> = {
  SELECT_DOCTOR:      ['{{specialty}}'],
  CONFIRM_BOOKING:    ['{{patientName}}', '{{doctorName}}', '{{date}}', '{{time}}'],
  BOOKING_SUCCESS:    ['{{doctorName}}', '{{date}}', '{{time}}'],
  NO_SLOTS_AVAILABLE: ['{{doctorName}}'],
  OUTSIDE_HOURS:      ['{{workingHours}}'],
}

// ── Individual language editor ────────────────────────────────────────────────

function LangEditor({
  keyName,
  language,
  body,
  clinicId,
}: {
  keyName: string
  language: 'FR' | 'EN'
  body: string
  clinicId: string
}) {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [value, setValue] = useState(body)
  const [dirty, setDirty] = useState(false)

  // Sync when body changes from parent re-render (but only if not dirty)
  useMemo(() => {
    if (body !== value && !dirty) setValue(body)
  }, [body])

  const mutation = useMutation({
    mutationFn: () => updateBotMessage(clinicId, keyName, language, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-messages', clinicId] })
      toast(t(lang, 'msg_saved'), 'success')
      setDirty(false)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const vars = VARIABLES[keyName]

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          {language === 'FR' ? t(lang, 'msg_fr') : t(lang, 'msg_en')}
          {vars && (
            <span className="ml-2 font-normal text-neutral-400 normal-case">
              ({t(lang, 'msg_hint')}: {vars.join(', ')})
            </span>
          )}
        </span>
      </div>
      <textarea
        className="input min-h-[72px] resize-y text-sm leading-relaxed"
        value={value}
        onChange={e => { setValue(e.target.value); setDirty(true) }}
      />
      <div className="flex justify-end">
        <button
          className="btn-primary h-7 px-3 text-xs"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? <Loader2 size={11} className="animate-spin" />
            : t(lang, 'save')
          }
        </button>
      </div>
    </div>
  )
}

// ── Button label input with auto-save ────────────────────────────────────────

function ButtonInput({
  keyName,
  language,
  body,
  clinicId,
}: {
  keyName: string
  language: 'FR' | 'EN'
  body: string
  clinicId: string
}) {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [value, setValue] = useState(body)

  useMemo(() => {
    if (body !== value) setValue(body)
  }, [body])

  const mutation = useMutation({
    mutationFn: () => updateBotMessage(clinicId, keyName, language, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-messages', clinicId] })
      toast(t(lang, 'msg_saved'), 'success')
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-[11px] font-mono text-neutral-500">
        {keyName.replace('BUTTON_', '')}
      </span>
      <div className="flex-1 flex items-center gap-1.5">
        <input
          className="input h-9 text-sm flex-1"
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => {
            if (value !== body) mutation.mutate()
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur()
            }
          }}
        />
        {value !== body && (
          <button
            className="btn-primary h-7 px-2 text-xs shrink-0"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 size={10} className="animate-spin" /> : t(lang, 'save')}
          </button>
        )}
      </div>
    </div>
  )
}

// ── WhatsApp preview of a button message ──────────────────────────────────────

function ButtonPreview({
  menuMessage,
  buttons,
}: {
  menuMessage: string
  buttons: { key: string; label: string }[]
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 max-w-sm mx-auto shadow-sm">
      {/* Chat bubble */}
      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl rounded-bl-sm p-3.5 mb-3 border border-blue-100 dark:border-blue-900/50">
        <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
          {menuMessage || '—'}
        </p>
      </div>

      {/* Button row */}
      <div className="flex flex-wrap gap-2">
        {buttons.map(btn => (
          <div
            key={btn.key}
            className="flex-1 min-w-[80px] text-center px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium"
          >
            {btn.label || btn.key}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Category section ─────────────────────────────────────────────────────────

function CategorySection({
  category,
  frMap,
  enMap,
  clinicId,
  search,
  lang,
}: {
  category: { name: string; keys: string[] }
  frMap: Map<string, BotMessage>
  enMap: Map<string, BotMessage>
  clinicId: string
  search: string
  lang: 'FR' | 'EN'
}) {
  const [collapsed, setCollapsed] = useState(false)

  // Filter keys by search
  const filteredKeys = useMemo(() => {
    if (!search) return category.keys
    const q = search.toLowerCase()
    return category.keys.filter(key => {
      const frBody = frMap.get(key)?.body ?? ''
      const enBody = enMap.get(key)?.body ?? ''
      return (
        key.toLowerCase().includes(q) ||
        frBody.toLowerCase().includes(q) ||
        enBody.toLowerCase().includes(q)
      )
    })
  }, [category.keys, search, frMap, enMap])

  if (filteredKeys.length === 0) return null

  const isButtons = category.name === 'Buttons'

  return (
    <div className="card overflow-hidden">
      {/* Category header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
          {category.name}
          <span className="ml-2 font-normal normal-case text-neutral-400">
            ({filteredKeys.length})
          </span>
        </span>
        {collapsed ? <ChevronRight size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {filteredKeys.map(keyName => {
            const frMsg = frMap.get(keyName)
            const enMsg = enMap.get(keyName)
            return (
              <div key={keyName} className="px-5 py-4 space-y-3">
                {/* Key badge */}
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono font-medium text-neutral-600 dark:text-neutral-400">
                    {keyName}
                  </span>
                  {!frMsg && (
                    <span className="badge-warning text-[10px]">{t('FR', 'spec_missing_fr')}</span>
                  )}
                  {!enMsg && (
                    <span className="badge-warning text-[10px]">{t('EN', 'spec_missing_en')}</span>
                  )}
                </div>

                {/* FR / EN side by side */}
                {!isButtons && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <LangEditor
                      keyName={keyName}
                      language="FR"
                      body={frMsg?.body ?? ''}
                      clinicId={clinicId}
                    />
                    <LangEditor
                      keyName={keyName}
                      language="EN"
                      body={enMsg?.body ?? ''}
                      clinicId={clinicId}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Buttons category — special layout with preview */}
          {isButtons && (
            <div className="px-5 py-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* FR column */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {t(lang, 'msg_fr')}
                  </h4>
                  {filteredKeys.map(keyName => (
                    <ButtonInput
                      key={keyName}
                      keyName={keyName}
                      language="FR"
                      body={frMap.get(keyName)?.body ?? ''}
                      clinicId={clinicId}
                    />
                  ))}

                  {/* Preview */}
                  <div className="pt-4">
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-2 flex items-center gap-1.5">
                      <MessageSquare size={12} />
                      Aperçu WhatsApp
                    </p>
                    <ButtonPreview
                      menuMessage={frMap.get('WELCOME')?.body ?? ''}
                      buttons={[
                        { key: 'BUTTON_BOOK_APP', label: frMap.get('BUTTON_BOOK_APP')?.body ?? '' },
                        { key: 'BUTTON_FAQ', label: frMap.get('BUTTON_FAQ')?.body ?? '' },
                        { key: 'BUTTON_AGENT', label: frMap.get('BUTTON_AGENT')?.body ?? '' },
                      ]}
                    />
                  </div>
                </div>

                {/* EN column */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {t(lang, 'msg_en')}
                  </h4>
                  {filteredKeys.map(keyName => (
                    <ButtonInput
                      key={keyName}
                      keyName={keyName}
                      language="EN"
                      body={enMap.get(keyName)?.body ?? ''}
                      clinicId={clinicId}
                    />
                  ))}

                  {/* Preview */}
                  <div className="pt-4">
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-2 flex items-center gap-1.5">
                      <MessageSquare size={12} />
                      WhatsApp preview
                    </p>
                    <ButtonPreview
                      menuMessage={enMap.get('WELCOME')?.body ?? ''}
                      buttons={[
                        { key: 'BUTTON_BOOK_APP', label: enMap.get('BUTTON_BOOK_APP')?.body ?? '' },
                        { key: 'BUTTON_FAQ', label: enMap.get('BUTTON_FAQ')?.body ?? '' },
                        { key: 'BUTTON_AGENT', label: enMap.get('BUTTON_AGENT')?.body ?? '' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BotMessagesPage() {
  const { lang, admin } = useAuth()
  const clinicId = admin!.clinicId
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch FR messages
  const { data: frMessages, isLoading: frLoading, isError: frError, refetch: refetchFr } = useQuery<BotMessage[]>({
    queryKey: ['bot-messages', clinicId, 'FR'],
    queryFn: () => getBotMessages(clinicId, 'FR'),
  })

  // Fetch EN messages
  const { data: enMessages, isLoading: enLoading, isError: enError, refetch: refetchEn } = useQuery<BotMessage[]>({
    queryKey: ['bot-messages', clinicId, 'EN'],
    queryFn: () => getBotMessages(clinicId, 'EN'),
  })

  // Build lookup maps by key
  const frMap = useMemo(() => {
    const map = new Map<string, BotMessage>()
    if (frMessages) for (const msg of frMessages) map.set(msg.key, msg)
    return map
  }, [frMessages])

  const enMap = useMemo(() => {
    const map = new Map<string, BotMessage>()
    if (enMessages) for (const msg of enMessages) map.set(msg.key, msg)
    return map
  }, [enMessages])

  if (frLoading || enLoading) return <PageLoader />

  if (frError || enError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-neutral-500">{t(lang, 'errorLoading')}</p>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => { refetchFr(); refetchEn() }}>
            {t(lang, 'tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  const totalKeys = CATEGORIES.reduce((sum, c) => sum + c.keys.length, 0)

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t(lang, 'msg_title')}
        subtitle={t(lang, 'msg_subtitle')}
      />

      {/* Search bar */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          className="input h-10 pl-10 text-sm"
          placeholder={t(lang, 'search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600"
            onClick={() => setSearch('')}
          >
            ✕
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-4 text-xs text-neutral-500 dark:text-neutral-400">
        <span>
          {t(lang, 'all')}: <strong className="text-neutral-700 dark:text-neutral-300">{totalKeys}</strong>
        </span>
        <span>
          FR: <strong className="text-green-600 dark:text-green-400">{frMap.size}</strong>
        </span>
        <span>
          EN: <strong className="text-green-600 dark:text-green-400">{enMap.size}</strong>
        </span>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {CATEGORIES.map(category => (
          <CategorySection
            key={category.name}
            category={category}
            frMap={frMap}
            enMap={enMap}
            clinicId={clinicId}
            search={search}
            lang={lang}
          />
        ))}
      </div>
    </div>
  )
}