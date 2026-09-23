import { createContext, useContext } from 'react'

export type ToastType = 'success' | 'error' | 'warning'

export interface ToastCtx {
  toast: (message: string, type?: ToastType) => void
}

export const ToastContext = createContext<ToastCtx | null>(null)

export function useToast(): ToastCtx {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast outside ToastProvider')
  return context
}
