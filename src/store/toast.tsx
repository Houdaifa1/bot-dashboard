import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning'

interface Toast { id: number; message: string; type: ToastType }

interface ToastCtx { toast: (msg: string, type?: ToastType) => void }

const ToastContext = createContext<ToastCtx | null>(null)

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = (message: string, type: ToastType = 'success') => {
    const id = ++counter
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }

  const remove = (id: number) => setToasts(t => t.filter(x => x.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium
            ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
              t.type === 'error'   ? 'bg-red-50 border-red-200 text-red-700' :
                                     'bg-amber-50 border-amber-200 text-amber-700'}`}>
            {t.type === 'success' && <CheckCircle size={16} className="mt-0.5 shrink-0" />}
            {t.type === 'error'   && <XCircle size={16} className="mt-0.5 shrink-0" />}
            {t.type === 'warning' && <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast outside ToastProvider')
  return ctx
}