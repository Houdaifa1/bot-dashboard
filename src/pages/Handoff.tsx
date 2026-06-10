import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Phone } from 'lucide-react'
import { resolveHandoff } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t } from '../i18n'
import { PageHeader, Field } from '../components/ui'

export function HandoffPage() {
  const { lang } = useAuth()
  const { toast } = useToast()

  const [phone, setPhone] = useState('')

  const mutation = useMutation({
    mutationFn: (phoneNumber: string) => resolveHandoff(phoneNumber),
    onSuccess: () => {
      toast(t(lang, 'handoff_resolved'), 'success')
      setPhone('')
    },
    onError: () => {
      toast(t(lang, 'errorSaving'), 'error')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return
    mutation.mutate(phone.trim())
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={t(lang, 'handoff_title')}
        subtitle={t(lang, 'handoff_subtitle')}
      />

      {/* Info card */}
      <div className="card p-5 mb-6 flex items-start gap-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/50">
        <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
          <Phone size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
          {t(lang, 'handoff_info')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <Field
          label={t(lang, 'handoff_phone')}
          hint={t(lang, 'handoff_phone_hint')}
        >
          <input
            className="input h-10 tabular-nums"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder={t(lang, 'handoff_phone_hint')}
            required
          />
        </Field>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="btn-primary"
            disabled={mutation.isPending || !phone.trim()}
          >
            {mutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : t(lang, 'handoff_resolve')
            }
          </button>
        </div>
      </form>
    </div>
  )
}