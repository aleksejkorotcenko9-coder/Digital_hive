'use client'

/**
 * Раздел «Напоминания» как календарь.
 * Слева — календарь месяца: дни с заметками помечены точками; на выбранный день
 * можно добавить заметку со временем (напоминание) или без времени («в течение
 * дня»). Справа — все запланированные напоминания: отметка «выполнено», удаление.
 * По наступлении срока оповещение приходит через хук useReminders (тост +
 * системное уведомление браузера). Везде добавлены анимации (framer-motion):
 * смена месяца, появление пунктов списка, отклик на действия.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlarmClock,
  BellRing,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isTomorrow,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAppState } from '@/lib/store'
import { LANG_DATE_LOCALE, tr, useT, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { requestNotificationPermission } from '@/lib/use-reminders'
import type { ReminderDto } from '@/lib/api-types'

const WEEKDAY_KEYS = [
  'calendar.wd.1', 'calendar.wd.2', 'calendar.wd.3',
  'calendar.wd.4', 'calendar.wd.5', 'calendar.wd.6', 'calendar.wd.7',
]

function dayLabel(d: Date, lang: Lang): string {
  if (isToday(d)) return tr(lang, 'calendar.today')
  if (isTomorrow(d)) return tr(lang, 'calendar.tomorrow')
  return format(d, 'd MMMM, EEEE', { locale: LANG_DATE_LOCALE[lang] })
}

function whenLabel(r: ReminderDto, lang: Lang): string {
  const d = new Date(r.remindAt)
  if (r.allDay) return `${dayLabel(d, lang).toLowerCase()} · ${tr(lang, 'calendar.allDay')}`
  return `${dayLabel(d, lang).toLowerCase()}, ${format(d, 'HH:mm')}`
}

/** Сводка дня для точек под числом в календаре. */
interface DayStat {
  timed: number
  allDay: number
  done: number
}

const ease = { duration: 0.25, ease: 'easeOut' as const }

export function CalendarRemindersView() {
  const lang = useAppState((s) => s.lang)
  const t = useT()
  const reminders = useAppState((s) => s.reminders)
  const setReminders = useAppState((s) => s.setReminders)
  const real = useAppState((s) => s.real)
  const { toast } = useToast()

  // календарь
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [dir, setDir] = useState(0)
  const [selected, setSelected] = useState(() => startOfDay(new Date()))

  // форма
  const [text, setText] = useState('')
  const [time, setTime] = useState('')
  const [hiveId, setHiveId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)

  const hives = real?.hives ?? []

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reminders', { cache: 'no-store' })
      if (res.ok) {
        const j = (await res.json()) as { reminders: ReminderDto[] }
        setReminders(j.reminders)
      }
    } finally {
      setLoading(false)
    }
  }, [setReminders])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      // первый запрос напоминаний — заодно просим разрешение на системные уведомления
      await requestNotificationPermission()
      const date = format(selected, 'yyyy-MM-dd')
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), date, time: time || null, hiveId: hiveId || null }),
      })
      const j = (await res.json().catch(() => ({}))) as { reminder?: ReminderDto; error?: string }
      if (!res.ok || !j.reminder) {
        toast({ title: t('calendar.notCreated'), description: j.error ?? t('calendar.serverError'), variant: 'destructive' })
        return
      }
      setReminders([...reminders, j.reminder].sort((a, b) => a.remindAt.localeCompare(b.remindAt)))
      setText('')
      setTime('')
      setHiveId('')
      const when = time
        ? `${dayLabel(selected, lang)}, ${time}`
        : `${dayLabel(selected, lang)}, ${t('calendar.allDay')}`
      toast({
        title: time ? t('calendar.reminderSet') : t('calendar.noteAdded'),
        description: t('calendar.reminderToastBody', { text: j.reminder.text, when }),
      })
    } finally {
      setBusy(false)
    }
  }

  const toggleDone = async (r: ReminderDto) => {
    setReminders(reminders.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)))
    const res = await fetch(`/api/reminders/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !r.done }),
    })
    if (!res.ok) setReminders(reminders)
  }

  const remove = async (r: ReminderDto) => {
    setReminders(reminders.filter((x) => x.id !== r.id))
    const res = await fetch(`/api/reminders/${r.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setReminders(reminders)
      toast({ title: t('calendar.deleteFailed'), variant: 'destructive' })
    }
  }

  /** Статистика по дням для точек в календаре. */
  const byDay = useMemo(() => {
    const m = new Map<string, DayStat>()
    for (const r of reminders) {
      const k = format(new Date(r.remindAt), 'yyyy-MM-dd')
      const e = m.get(k) ?? { timed: 0, allDay: 0, done: 0 }
      if (r.done) e.done++
      else if (r.allDay) e.allDay++
      else e.timed++
      m.set(k, e)
    }
    return m
  }, [reminders])

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start, end })
    const out: Date[][] = []
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7))
    return out
  }, [cursor])

  const shiftMonth = (delta: number) => {
    setDir(delta)
    setCursor((c) => (delta > 0 ? addMonths(c, 1) : subMonths(c, 1)))
  }

  const selectedKey = format(selected, 'yyyy-MM-dd')
  const selectedItems = useMemo(
    () =>
      reminders
        .filter((r) => format(new Date(r.remindAt), 'yyyy-MM-dd') === selectedKey)
        .sort((a, b) => a.remindAt.localeCompare(b.remindAt)),
    [reminders, selectedKey],
  )

  const now = Date.now()
  const pending = useMemo(
    () =>
      reminders
        .filter((r) => !r.done)
        .sort((a, b) => a.remindAt.localeCompare(b.remindAt)),
    [reminders],
  )
  const overdue = pending.filter((r) => new Date(r.remindAt).getTime() <= now)
  const upcoming = pending.filter((r) => new Date(r.remindAt).getTime() > now)
  const doneCount = reminders.filter((r) => r.done).length

  const ReminderRow = ({ r, overdueStyle = false }: { r: ReminderDto; overdueStyle?: boolean }) => (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={ease}
      className={cn(
        'flex items-start gap-3 rounded-2xl border bg-white px-3.5 py-2.5 shadow-sm transition-colors dark:bg-[#221814]',
        isSameDay(new Date(r.remindAt), selected) ? 'border-red-300 bg-red-50/40 dark:bg-[#2C211C]' : 'border-red-100',
        overdueStyle && 'border-red-200',
      )}
    >
      <button
        onClick={() => void toggleDone(r)}
        aria-label={r.done ? t('calendar.markActive') : t('calendar.markDone')}
        className={cn(
          'mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90',
          r.done
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-red-300 text-transparent hover:border-emerald-400 hover:text-emerald-300',
        )}
      >
        <Check className="h-3 w-3" />
      </button>
      <button onClick={() => setSelected(startOfDay(new Date(r.remindAt)))} className="min-w-0 flex-1 text-left">
        <p className={cn('text-sm leading-snug', r.done ? 'text-gray-400 line-through' : 'font-semibold text-gray-800')}>
          {r.text}
        </p>
        <p
          className={cn(
            'mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]',
            overdueStyle && !r.done ? 'font-bold text-red-600' : 'text-gray-400',
          )}
        >
          <Clock className="h-3 w-3" />
          {whenLabel(r, lang)}
          {r.hiveName && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600 dark:bg-[#2C211C]">
              {r.hiveName}
            </span>
          )}
        </p>
      </button>
      <button
        onClick={() => void remove(r)}
        aria-label={t('calendar.delete')}
        className="mt-0.5 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-[#2C211C]"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.li>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2A1A12]">{t('calendar.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('calendar.subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
          onClick={() => void load()}
        >
          <RefreshCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> {t('calendar.refresh')}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
        {/* ЛЕВО: календарь + заметка на выбранный день */}
        <Card className="border-red-100 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold capitalize text-[#2A1A12]">
                {format(cursor, 'MMMM yyyy', { locale: LANG_DATE_LOCALE[lang] })}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => shiftMonth(-1)}
                  aria-label={t('calendar.prevMonth')}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-[#2C211C]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setDir(1)
                    setCursor(startOfMonth(new Date()))
                    setSelected(startOfDay(new Date()))
                  }}
                  className="rounded-full border border-red-100 px-2.5 py-1 text-[11px] font-bold text-red-600 transition-colors hover:bg-red-50"
                >
                  {t('calendar.today')}
                </button>
                <button
                  onClick={() => shiftMonth(1)}
                  aria-label={t('calendar.nextMonth')}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-[#2C211C]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={format(cursor, 'yyyy-MM')}
                initial={{ opacity: 0, x: dir * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -28 }}
                transition={ease}
              >
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAY_KEYS.map((k) => (
                    <div key={k} className="pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      {t(k)}
                    </div>
                  ))}
                  {weeks.flat().map((d) => {
                    const key = format(d, 'yyyy-MM-dd')
                    const stat = byDay.get(key)
                    const inMonth = isSameMonth(d, cursor)
                    const isSel = isSameDay(d, selected)
                    return (
                      <motion.button
                        key={key}
                        whileTap={{ scale: 0.88 }}
                        onClick={() => setSelected(startOfDay(d))}
                        aria-label={t('calendar.pickDay', { n: format(d, 'd MMMM', { locale: LANG_DATE_LOCALE[lang] }) })}
                        className={cn(
                          'relative flex h-11 flex-col items-center justify-center rounded-xl text-sm transition-colors',
                          !inMonth && 'text-gray-300 dark:text-gray-600',
                          inMonth && !isSel && 'text-gray-700 hover:bg-red-50 dark:hover:bg-[#2C211C]',
                          isToday(d) && !isSel && 'font-extrabold text-red-600 ring-1 ring-inset ring-red-200',
                          isSel && 'bg-gradient-to-br from-red-600 to-orange-500 font-bold text-white shadow-md shadow-red-100',
                        )}
                      >
                        <span>{format(d, 'd')}</span>
                        <span className="absolute bottom-1 flex h-1.5 items-center gap-0.5">
                          {stat && stat.timed > 0 && (
                            <span className={cn('h-1.5 w-1.5 rounded-full', isSel ? 'bg-white' : 'bg-red-500')} />
                          )}
                          {stat && stat.allDay > 0 && (
                            <span className={cn('h-1.5 w-1.5 rounded-full', isSel ? 'bg-white' : 'bg-amber-400')} />
                          )}
                          {stat && stat.done > 0 && (
                            <span className={cn('h-1 w-1 rounded-full', isSel ? 'bg-white/70' : 'bg-emerald-500')} />
                          )}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-red-50 pt-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {t('calendar.legendTimed')}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {t('calendar.legendAllDay')}</span>
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-emerald-500" /> {t('calendar.legendDone')}</span>
            </div>

            {/* Заметка на выбранный день */}
            <motion.div key={selectedKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
              <div className="mt-3 rounded-2xl bg-red-50/50 p-3 dark:bg-[#2C211C]">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#2A1A12]">
                  <CalendarDays className="h-3.5 w-3.5 text-red-600" />
                  {dayLabel(selected, lang)}
                </p>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t('calendar.notePlaceholder')}
                  aria-label={t('calendar.noteAria')}
                  maxLength={300}
                  className="border-red-100 bg-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && text.trim()) void create()
                  }}
                />
                <div className="mt-2 flex items-end gap-2">
                  <div className="w-28 space-y-1">
                    <Label htmlFor="cal-time" className="text-[10px] font-semibold text-gray-500">
                      {t('calendar.timeLabel')}
                    </Label>
                    <Input
                      id="cal-time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="border-red-100 bg-white"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="cal-hive" className="text-[10px] font-semibold text-gray-500">
                      {t('calendar.hiveLabel')}
                    </Label>
                    <select
                      id="cal-hive"
                      value={hiveId}
                      onChange={(e) => setHiveId(e.target.value)}
                      className="h-9 w-full rounded-md border border-red-100 bg-white px-2 text-sm text-gray-700 shadow-sm dark:bg-[#221814]"
                    >
                      <option value="">{t('calendar.noHive')}</option>
                      {hives.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={() => void create()}
                    disabled={busy || !text.trim()}
                    className="h-9 gap-1 bg-gradient-to-r from-red-600 to-orange-500 px-3 font-bold active:scale-95"
                  >
                    <Plus className="h-4 w-4" /> {t('calendar.add')}
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] text-gray-400">{t('calendar.timeHint')}</p>
              </div>
            </motion.div>
          </CardContent>
        </Card>

        {/* ПРАВО: запланированные напоминания */}
        <div className="space-y-4">
          <Card className="border-red-100 shadow-sm">
            <CardContent className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#2A1A12]">
                <AlarmClock className="h-4 w-4 text-red-600" /> {t('calendar.scheduled')}
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:bg-[#2C211C]">
                  {pending.length}
                </span>
                <span className="ml-auto text-[11px] font-medium text-gray-400">
                  {t('calendar.selectedIs', { n: dayLabel(selected, lang).toLowerCase() })}
                </span>
              </h2>

              {pending.length === 0 && doneCount === 0 ? (
                <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-red-200 bg-red-50/30 p-6 text-center dark:bg-[#221814]">
                  <BellRing className="h-7 w-7 text-red-300" />
                  <p className="font-bold text-[#2A1A12]">{t('calendar.emptyTitle')}</p>
                  <p className="max-w-sm text-xs text-gray-500">{t('calendar.emptyBody')}</p>
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  {overdue.length > 0 && (
                    <section className="space-y-2">
                      <p className="text-xs font-bold text-red-600">{t('calendar.overdue')}</p>
                      <ul className="space-y-2">
                        <AnimatePresence initial={false}>
                          {overdue.map((r) => (
                            <ReminderRow key={r.id} r={r} overdueStyle />
                          ))}
                        </AnimatePresence>
                      </ul>
                    </section>
                  )}
                  {upcoming.length > 0 && (
                    <section className="space-y-2">
                      <p className="text-xs font-bold text-gray-500">{t('calendar.upcoming')}</p>
                      <ul className="space-y-2">
                        <AnimatePresence initial={false}>
                          {upcoming.map((r) => (
                            <ReminderRow key={r.id} r={r} />
                          ))}
                        </AnimatePresence>
                      </ul>
                    </section>
                  )}
                  {pending.length === 0 && (
                    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-[#16302A]">
                      {t('calendar.allDone')}
                    </p>
                  )}
                  {doneCount > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer list-none text-xs font-bold text-gray-500 transition-colors hover:text-red-600">
                        {t('calendar.doneSection', { n: doneCount })}
                        <ChevronRight className="ml-1 inline h-3 w-3 transition-transform group-open:rotate-90" />
                      </summary>
                      <ul className="mt-2 space-y-2">
                        <AnimatePresence initial={false}>
                          {reminders
                            .filter((r) => r.done)
                            .sort((a, b) => b.remindAt.localeCompare(a.remindAt))
                            .map((r) => (
                              <ReminderRow key={r.id} r={r} />
                            ))}
                        </AnimatePresence>
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Заметки выбранного дня */}
          <Card className="border-red-100 bg-red-50/30 shadow-sm dark:bg-[#221814]">
            <CardContent className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#2A1A12]">
                <CalendarDays className="h-4 w-4 text-red-600" /> {t('calendar.forSelectedDay', { n: dayLabel(selected, lang) })}
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:bg-[#2C211C]">
                  {selectedItems.length}
                </span>
              </h2>
              {selectedItems.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">{t('calendar.noNotesForDay')}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  <AnimatePresence initial={false}>
                    {selectedItems.map((r) => (
                      <ReminderRow key={r.id} r={r} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </CardContent>
          </Card>

          <p className="text-xs leading-relaxed text-gray-400">{t('calendar.notifyNote')}</p>
        </div>
      </div>
    </div>
  )
}
