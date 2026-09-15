import { Languages } from 'lucide-react'
import { useLanguage } from '@/app/providers/LanguageProvider'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'en', short: 'EN', name: 'English' },
  { value: 'so', short: 'SO', name: 'Soomaali' },
] as const

/** English / Soomaali switch. The choice is kept on this device and saved to the account. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage()
  return (
    <div
      role="group"
      aria-label="Language · Luqadda"
      className={cn('inline-flex h-9 items-center rounded-[10px] border border-line-strong bg-surface p-0.5', className)}
    >
      <Languages className="mx-1.5 size-4 text-ink-500" aria-hidden />
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          title={option.name}
          aria-pressed={language === option.value}
          onClick={() => language !== option.value && setLanguage(option.value)}
          className={cn(
            'h-7 rounded-lg px-2.5 text-xs font-semibold transition-colors',
            language === option.value ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
          )}
        >
          {option.short}
        </button>
      ))}
    </div>
  )
}
