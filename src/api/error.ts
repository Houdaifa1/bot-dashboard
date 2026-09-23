import axios from 'axios'

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback
  const message: unknown = error.response?.data?.message
  if (typeof message === 'string') return message
  if (Array.isArray(message) && message.every(item => typeof item === 'string')) {
    return message.join(', ')
  }
  return fallback
}

export function apiErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}

export function apiErrorCode(error: unknown): string | undefined {
  return axios.isAxiosError(error) ? error.code : undefined
}
