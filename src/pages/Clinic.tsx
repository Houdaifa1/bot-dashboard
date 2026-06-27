import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getClinic, updateClinic } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import { PageHeader, PageLoader, Field } from '../components/ui'
import type { Clinic } from '../types'

const TIMEZONES = [
  'Africa/Casablanca',
  'Africa/Cairo',
  'Africa/Tunis',
  'Africa/Algiers',
  'Europe/Paris',
  'Europe/London',
  'Asia/Dubai',
  'UTC',
]

const LANGUAGES = ['FR', 'EN']

export function ClinicPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: clinic, isLoading, isError, refetch } = useQuery<Clinic>({
    queryKey: ['clinic'],
    queryFn: getClinic,
  })

  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    timezone: '',
    defaultLanguage: '',
    notificationPhone: '',
  })

  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (clinic) {
      setForm({
        name: clinic.name,
        phone: clinic.phone,
        address: clinic.address ?? '',
        timezone: clinic.timezone,
        defaultLanguage: clinic.defaultLanguage,
        notificationPhone: (clinic as any).notificationPhone ?? '',
      })
      setDirty(false)
    }
  }, [clinic])

  const mutation = useMutation({
    mutationFn: (data: Partial<Clinic>) => updateClinic(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic'] })
      toast(t(lang, 'clinic_saved'), 'success')
      setDirty(false)
    },
    onError: () => {
      toast(t(lang, 'errorSaving'), 'error')
    },
  })

  const set = (field: string, value: any) => {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      name: form.name,
      phone: form.phone,
      address: form.address,
      timezone: form.timezone,
      defaultLanguage: form.defaultLanguage as any,
      notificationPhone: form.notificationPhone || null,
    } as any)
  }

  const handleReset = () => {
    if (clinic) {
      setForm({
        name: clinic.name,
        phone: clinic.phone,
        address: clinic.address ?? '',
        timezone: clinic.timezone,
        defaultLanguage: clinic.defaultLanguage,
        notificationPhone: (clinic as any).notificationPhone ?? '',
      })
      setDirty(false)
    }
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
    <div className="max-w-2xl">
      <PageHeader
        title={t(lang, 'clinic_title')}
        subtitle={t(lang, 'clinic_subtitle')}
      />

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Basic info */}
        <div className="card p-6 space-y-5">
          <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
            {lang === 'FR' ? 'Informations générales' : 'General info'}
          </p>

          <Field label={t(lang, 'clinic_name')}>
            <input
              className="input h-10"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
            />
          </Field>

          <Field
            label={lang === 'FR' ? 'Numéro public de la clinique' : 'Clinic public phone number'}
            hint={lang === 'FR'
              ? 'Affiché aux patients dans les messages du bot. Format international, ex: +212600000000'
              : 'Shown to patients in bot messages. International format, e.g. +212600000000'}
          >
            <input
              className="input h-10"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="+212600000000"
              required
            />
          </Field>

          <Field label={t(lang, 'clinic_address')}>
            <input
              className="input h-10"
              value={form.address}
              onChange={e => set('address', e.target.value)}
            />
          </Field>
        </div>

        {/* Locale settings */}
        <div className="card p-6 space-y-5">
          <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
            {lang === 'FR' ? 'Localisation' : 'Locale'}
          </p>

          <Field label={t(lang, 'clinic_timezone')}>
            <select
              className="input h-10"
              value={form.timezone}
              onChange={e => set('timezone', e.target.value)}
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Field>

          <Field label={t(lang, 'clinic_defaultLang')}>
            <select
              className="input h-10"
              value={form.defaultLanguage}
              onChange={e => set('defaultLanguage', e.target.value)}
            >
              {LANGUAGES.map(l => (
                <option key={l} value={l}>{t(lang, l === 'FR' ? 'french' : 'english')}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Staff contact */}
        <div className="card p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
              {lang === 'FR' ? 'Contact du personnel' : 'Staff contact'}
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              {lang === 'FR'
                ? 'Ce numéro reçoit les alertes internes du bot : transferts vers agent humain, plaintes graves, demandes urgentes. Ne pas communiquer aux patients.'
                : 'This number receives internal bot alerts: human handoffs, high severity complaints, urgent requests. Do not share with patients.'}
            </p>
          </div>

          <Field
            label={lang === 'FR' ? 'Numéro WhatsApp du responsable' : 'Staff WhatsApp number'}
            hint={lang === 'FR'
              ? 'Doit être un numéro WhatsApp actif. Format international, ex: +212600000000'
              : 'Must be an active WhatsApp number. International format, e.g. +212600000000'}
          >
            <input
              className="input h-10"
              value={form.notificationPhone}
              onChange={e => set('notificationPhone', e.target.value)}
              placeholder="+212600000000"
            />
          </Field>

          {!form.notificationPhone && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <span className="text-amber-500 text-xs mt-0.5">⚠</span>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {lang === 'FR'
                  ? 'Aucun numéro configuré. Les alertes de transfert et les plaintes graves ne seront pas envoyées.'
                  : 'No number configured. Handoff alerts and high severity complaints will not be sent.'}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {dirty && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                {lang === 'FR' ? 'Modifications non enregistrées' : 'Unsaved changes'}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            {dirty && (
              <button
                type="button"
                className="btn-outline"
                onClick={handleReset}
                disabled={mutation.isPending}
              >
                {t(lang, 'cancel')}
              </button>
            )}
            <button
              type="submit"
              className="btn-primary"
              disabled={mutation.isPending || !dirty}
            >
              {mutation.isPending ? t(lang, 'saving') : t(lang, 'save')}
            </button>
          </div>
        </div>

      </form>
    </div>
  )
}