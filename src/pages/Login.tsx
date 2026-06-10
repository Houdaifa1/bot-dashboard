import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { login } from '../api'
import { t } from '../i18n'

export function LoginPage() {
  const { setAuth, lang, setLang } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await login(email, password)
      setAuth(data.access_token, data.admin)
      toast(lang === 'FR' ? 'Connexion réussie' : 'Signed in successfully', 'success')
      navigate('/')
    } catch (err: any) {
      let message = t(lang, 'login_error')
      const status = err?.response?.status
      const code = err?.code

      if (status === 401) {
        message = lang === 'FR' ? 'Email ou mot de passe incorrect' : 'Invalid email or password'
      } else if (status === 429) {
        message = lang === 'FR' ? 'Trop de tentatives. Réessayez plus tard.' : 'Too many attempts. Try again later.'
      } else if (status >= 500) {
        message = lang === 'FR' ? 'Erreur serveur. Réessayez plus tard.' : 'Server error. Please try again later.'
      } else if (code === 'ERR_NETWORK') {
        message = lang === 'FR' ? 'Impossible de joindre le serveur' : 'Cannot reach server'
      }

      setError(message)
      toast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between bg-neutral-900 dark:bg-neutral-950 p-12 border-r border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">Healthcare Bot</span>
        </div>

        <div>
          <blockquote className="text-white/80 text-xl font-light leading-relaxed max-w-xs">
            {lang === 'FR'
              ? 'Gérez votre clinique, vos médecins et vos rendez-vous depuis un seul endroit.'
              : 'Manage your clinic, doctors and appointments from one place.'
            }
          </blockquote>

          <div className="mt-8 space-y-2 text-white/60 text-sm">
            <p>• WhatsApp bot monitoring</p>
            <p>• Clinics management</p>
            <p>• Doctors & appointments</p>
            <p>• Real-time conversations</p>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-medium">
              H
            </div>
            <div>
              <p className="text-white text-sm font-medium">Healthcare Bot</p>
              <p className="text-white/40 text-xs mt-0.5">
                {lang === 'FR' ? 'Tableau de bord administrateur' : 'Admin dashboard'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-1.5">
          <div className="w-8 h-1 rounded-full bg-white" />
          <div className="w-4 h-1 rounded-full bg-white/20" />
          <div className="w-4 h-1 rounded-full bg-white/20" />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center bg-white dark:bg-neutral-900 p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-800 flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-neutral-800 dark:text-neutral-100">Healthcare Bot</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {t(lang, 'login_welcome')}
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5">
              {t(lang, 'login_subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t(lang, 'login_email')}</label>
              <input
                type="email"
                className="input h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">{t(lang, 'login_password')}</label>
              <input
                type="password"
                className="input h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="px-3.5 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 dark:border-neutral-900/20 border-t-white dark:border-t-neutral-900 rounded-full animate-spin" />
                  {lang === 'FR' ? 'Connexion...' : 'Signing in...'}
                </div>
              ) : (
                t(lang, 'login_btn')
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800 flex justify-center">
            <button
              type="button"
              onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR')}
              className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              {t(lang, lang === 'FR' ? 'lang_switch' : 'lang_switchEn')}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}