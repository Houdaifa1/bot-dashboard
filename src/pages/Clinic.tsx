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
    supportedLangs: [] as string[],
    isActive: true,
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
        supportedLangs: clinic.supportedLangs,
        isActive: clinic.isActive,
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

  const toggleSupportedLang = (l: string) => {
    const next = form.supportedLangs.includes(l)
      ? form.supportedLangs.filter(x => x !== l)
      : [...form.supportedLangs, l]
    set('supportedLangs', next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      name: form.name,
      phone: form.phone,
      address: form.address,
      timezone: form.timezone,
      defaultLanguage: form.defaultLanguage as any,
      supportedLangs: form.supportedLangs as any,
      isActive: form.isActive,
    })
  }

  const handleReset = () => {
    if (clinic) {
      setForm({
        name: clinic.name,
        phone: clinic.phone,
        address: clinic.address ?? '',
        timezone: clinic.timezone,
        defaultLanguage: clinic.defaultLanguage,
        supportedLangs: clinic.supportedLangs,
        isActive: clinic.isActive,
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
            label={t(lang, 'clinic_phone')}
            hint={lang === 'FR' ? 'Format international, ex: +212600000000' : 'International format, e.g. +212600000000'}
          >
            <input
              className="input h-10"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
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

          <Field
            label={lang === 'FR' ? 'Langues supportées' : 'Supported languages'}
            hint={lang === 'FR' ? 'Langues disponibles pour les patients WhatsApp' : 'Languages available to WhatsApp patients'}
          >
            <div className="flex gap-3 mt-1">
              {LANGUAGES.map(l => (
                <label
                  key={l}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors
                    ${form.supportedLangs.includes(l)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.supportedLangs.includes(l)}
                    onChange={() => toggleSupportedLang(l)}
                  />
                  {t(lang, l === 'FR' ? 'french' : 'english')}
                </label>
              ))}
            </div>
          </Field>
        </div>

        {/* Status */}
        <div className="card p-6">
          <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-5">
            {lang === 'FR' ? 'Statut' : 'Status'}
          </p>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {lang === 'FR' ? 'Clinique active' : 'Clinic active'}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {lang === 'FR'
                  ? 'Désactiver stoppe toutes les conversations WhatsApp'
                  : 'Disabling stops all WhatsApp conversations'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => set('isActive', !form.isActive)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30
                ${form.isActive ? 'bg-blue-600' : 'bg-neutral-200 dark:bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </label>
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