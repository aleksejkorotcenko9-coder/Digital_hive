'use client'

/**
 * Колокольчик уведомлений: по клику открывает поповер со списком ближайших
 * напоминаний (просроченные — первыми, красным). Из поповера можно отметить
 * «выполнено» и перейти в календарь напоминаний. Анимация раскрытия —
 * встроенная у Popover, пункты списка появляются каскадом (framer-motion).
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlarmClock, BellRing, CalendarDays, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useAppState } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { whenLabelShort } from './reminders-utils'
import type { ReminderDto } from '@/lib/api-types'

const SHOW_LIMIT = 5

export function RemindersBell() {
  const t = useT()
  const reminders = useAppState((s) => s.reminders)
  const setReminders = useAppState((s) => s.setReminders)
  const setView = useAppState((s) => s.setView)
  const [open, setOpen] = useState(false)

  const now = Date.now()
  const pending = reminders
    .filter((r) => !r.done)
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
  const overdue = pending.filter((r) => new Date(r.remindAt).getTime() <= now)
  const soon = pending.filter((r) => new Date(r.remindAt).getTime() > now)
  const top = [...overdue, ...soon].slice(0, SHOW_LIMIT)

  // бейдж: просроченные + ближайшая неделя
  const badge = pending.filter((r) => new Date(r.remindAt).getTime() <= now + 7 * 86400000).length

  const toggleDone = async (r: ReminderDto) => {
    setReminders(reminders.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)))
    const res = await fetch(`/api/reminders/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !r.done }),
    })
    if (!res.ok) setReminders(reminders)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t('bell.triggerAria')}
        className="relative rounded-full border border-red-100 bg-white p-2 text-gray-500 transition-colors hover:text-red-600 dark:bg-[#221814]"
      >
        <BellRing className={cn('h-4 w-4', overdue.length > 0 && 'animate-bounce text-red-500')} />
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden rounded-2xl p-0">
        <div className="flex items-center gap-2 border-b border-red-50 bg-red-50/50 px-4 py-3 dark:bg-[#2C211C]">
          <AlarmClock className="h-4 w-4 text-red-600" />
          <span className="text-sm font-bold text-[#2A1A12]">{t('bell.title')}</span>
          {pending.length > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {pending.length}
            </span>
          )}
        </div>

        {top.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
            <BellRing className="h-6 w-6 text-red-300" />
            <p className="text-sm font-bold text-[#2A1A12]">{t('bell.empty')}</p>
            <p className="text-xs text-gray-500">{t('bell.emptyHint')}</p>
          </div>
        ) : (
          <ul className="max-h-72 overflow-y-auto px-3 py-2">
            {top.map((r, i) => {
              const isOverdue = new Date(r.remindAt).getTime() <= now
              return (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.05, ease: 'easeOut' }}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-red-50/60 dark:hover:bg-[#2C211C]',
                    isOverdue && 'bg-red-50/60 dark:bg-[#2C211C]',
                  )}
                >
                  <button
                    onClick={() => void toggleDone(r)}
                    aria-label={t('bell.markDone')}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-red-300 text-transparent transition-all hover:border-emerald-400 hover:text-emerald-400 active:scale-90"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setOpen(false)
                      setView('reminders')
                    }}
                  >
                    <p className="truncate text-sm font-semibold text-gray-800">{r.text}</p>
                    <p
                      className={cn(
                        'mt-0.5 text-[11px]',
                        isOverdue ? 'font-bold text-red-600' : r.allDay ? 'text-amber-600' : 'text-gray-400',
                      )}
                    >
                      {r.allDay ? t('bell.allDay') : whenLabelShort(r.remindAt)}
                      {isOverdue && t('bell.dueNow')}
                    </p>
                  </button>
                </motion.li>
              )
            })}
          </ul>
        )}

        <div className="border-t border-red-50 p-2">
          <Button
            variant="ghost"
            className="w-full gap-1.5 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => {
              setOpen(false)
              setView('reminders')
            }}
          >
            <CalendarDays className="h-3.5 w-3.5" /> {t('bell.openCalendar')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
