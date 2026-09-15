import { toast as sonner } from 'sonner'
import { parseAppError } from '@/lib/errors'

export const toast = {
  success: (message: string, options?: { description?: string; action?: { label: string; onClick: () => void } }) =>
    sonner.success(message, options),
  info: (message: string, description?: string) => sonner(message, { description }),
  /** Turns a database error code into a sentence the gym owner can act on. */
  error: (error: unknown, fallback = 'Something went wrong.') => {
    const parsed = parseAppError(error)
    sonner.error(parsed.message || fallback, {
      description: parsed.code && parsed.code !== 'UNEXPECTED' ? `Code: ${parsed.code}` : undefined,
    })
    return parsed
  },
  message: sonner,
}
