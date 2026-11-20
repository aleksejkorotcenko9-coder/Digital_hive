'use client'

/**
 * Переключатель «Демо / Мои данные»: сегментный контрол с анимированным
 * «язычком» (framer-motion layoutId). «Демо» — четыре сценарных улья с живой
 * телеметрией; «Мои данные» — телеметрия ульев, привязанных на карте.
 */
import { motion } from 'framer-motion'
import { FlaskConical, RadioTower } from 'lucide-react'
import { useAppState } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { id: 'demo' as const, labelKey: 'mode.demo', icon: FlaskConical },
  { id: 'real' as const, labelKey: 'mode.real', icon: RadioTower },
]

export function ModeSwitcher({ className }: { className?: string }) {
  const mode = useAppState((s) => s.mode)
  const setMode = useAppState((s) => s.setMode)
  const t = useT()
  return (
    <div
      role="tablist"
      aria-label={t('mode.aria')}
      className={cn(
        'relative inline-flex items-center gap-1 rounded-full border border-red-100 bg-white p-1 shadow-sm',
        className,
      )}
    >
      {OPTIONS.map((o) => {
        const active = mode === o.id
        const Icon = o.icon
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => setMode(o.id)}
            className={cn(
              'relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors sm:text-sm',
              active ? 'text-white' : 'text-gray-500 hover:text-red-600',
            )}
          >
            {active && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-full bg-gradient-to-r from-red-600 to-orange-500 shadow-md shadow-red-100"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Icon className={cn('h-3.5 w-3.5', active && 'animate-none')} />
              {t(o.labelKey)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
