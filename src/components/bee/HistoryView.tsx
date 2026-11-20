'use client'

/**
 * «История событий»: красиво оформленный почасовой журнал датчиков ульев.
 *
 * Параметры (температура, влажность, масса) фиксируются КАЖДЫЙ ЧАС — записи
 * журнала живут в БД (SensorLog) и наполняются по якорной CSV-выгрузке
 * телеметрии. При наведении на запись всплывает окно с подробной таблицей
 * изменений параметров; таблицу можно закрепить кликом (и на телефоне тоже).
 *
 * Быстрый доступ по периодам: День / Месяц / Год, шаг стрелками и кнопка
 * календаря — клик по числу открывает этот день с данными.
 * Времена журнала показываются в UTC — то же время, что в исходной таблице
 * телеметрии, независимо от часового пояса браузера.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Droplets,
  Hexagon,
  History,
  Loader2,
  MousePointerClick,
  RefreshCcw,
  Sparkles,
  Thermometer,
  TriangleAlert,
  Weight,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { hiveWord } from '@/lib/hive-sync'
import { LANG_DATE_LOCALE, tr, useT, type Lang } from '@/lib/i18n'
import { useAppState } from '@/lib/store'
import type {
  HistoryAiResponse,
  HistoryInsightDto,
  HistoryLogDto,
  HistoryResponse,
  HistoryScope,
} from '@/lib/api-types'

const ease = { duration: 0.25, ease: 'easeOut' as const }

/* ------------------------------------------------------------------ */
/* Форматирование «стеночных часов» журнала (UTC)                      */
/* ------------------------------------------------------------------ */

const MONTH_GEN_KEYS = [
  'history.monthGen.1', 'history.monthGen.2', 'history.monthGen.3',
  'history.monthGen.4', 'history.monthGen.5', 'history.monthGen.6',
  'history.monthGen.7', 'history.monthGen.8', 'history.monthGen.9',
  'history.monthGen.10', 'history.monthGen.11', 'history.monthGen.12',
]
const MONTH_NOM_KEYS = [
  'history.monthNom.1', 'history.monthNom.2', 'history.monthNom.3',
  'history.monthNom.4', 'history.monthNom.5', 'history.monthNom.6',
  'history.monthNom.7', 'history.monthNom.8', 'history.monthNom.9',
  'history.monthNom.10', 'history.monthNom.11', 'history.monthNom.12',
]
const WEEKDAY_KEYS = [
  'history.wd.1', 'history.wd.2', 'history.wd.3',
  'history.wd.4', 'history.wd.5', 'history.wd.6', 'history.wd.7',
]

const pad2 = (n: number) => String(n).padStart(2, '0')

/** «2026-08-29» → «29 августа 2026» (UTC). */
function fmtDateLabel(key: string, lang: Lang): string {
  const [y, m, d] = key.split('-').map(Number)
  return tr(lang, 'history.dayLabel', { d, month: tr(lang, MONTH_GEN_KEYS[m - 1]), y })
}

/** «2026-08» → «Август 2026». */
function fmtMonthLabel(key: string, lang: Lang): string {
  const [y, m] = key.split('-').map(Number)
  return tr(lang, 'history.monthYear', { month: tr(lang, MONTH_NOM_KEYS[m - 1]), y })
}

/** ISO → «HH:MM» (UTC). */
function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
}

const dayKeyOf = (d: Date) => d.toISOString().slice(0, 10)
const parseDayKey = (key: string) => new Date(`${key}T00:00:00Z`)

function addDaysKey(key: string, days: number): string {
  const d = parseDayKey(key)
  d.setUTCDate(d.getUTCDate() + days)
  return dayKeyOf(d)
}

function addMonthsKey(key: string, months: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + months, 1))
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`
}

/* ------------------------------------------------------------------ */
/* Плавающая таблица изменений                                         */
/* ------------------------------------------------------------------ */

interface PopRect {
  left: number
  right: number
  top: number
}

interface PopState {
  rect: PopRect
  title: string
  subtitle?: string
  table: React.ReactNode
}

/** Компактная таблица с дельтами: строка «время → параметры». */
function MiniTable({
  head,
  rows,
  highlight,
}: {
  head: string[]
  rows: Array<Array<React.ReactNode>>
  highlight?: number
}) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr className="bg-red-50/80 dark:bg-[#2C211C]">
          {head.map((h, idx) => (
            <th
              // ключ по позиции: в шапке встречаются повторяющиеся названия («Δ»)
              key={idx}
              className="whitespace-nowrap px-2 py-1.5 text-left font-bold uppercase tracking-wide text-gray-500 first:rounded-tl-lg last:rounded-tr-lg"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr
            key={i}
            className={cn(
              'border-t border-red-50 dark:border-[#2C211C]',
              i % 2 === 1 && 'bg-red-50/25 dark:bg-[#2A1D18]',
              highlight === i && 'bg-amber-50 ring-1 ring-inset ring-amber-200 dark:bg-[#3A2C14]',
            )}
          >
            {cells.map((c, j) => (
              <td key={j} className={cn('whitespace-nowrap px-2 py-1.5 tabular-nums', j === 0 && 'font-bold text-[#2A1A12] dark:text-[#E8D9CF]')}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Стрелка дельты: зелёный рост, красное падение, серый ноль. */
function Delta({ v, unit }: { v: number; unit: string }) {
  const eps = unit === '°C' ? 0.05 : unit === '%' ? 0.5 : 0.05
  const up = v > eps
  const down = v < -eps
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-semibold',
        up && 'text-emerald-600',
        down && 'text-red-600',
        !up && !down && 'text-gray-400',
      )}
    >
      {up ? '↑' : down ? '↓' : '·'} {up || down ? `${v > 0 ? '+' : ''}${unit === '%' ? Math.round(v) : v.toFixed(1)}` : '0'}
    </span>
  )
}

/** Всплывающее окно с подробной таблицей: следует за записью при наведении,
 *  закрепляется кликом (работает и на телефоне). */
function DetailPopup({
  pop,
  pinned,
  onEnter,
  onLeave,
  onClose,
}: {
  pop: PopState
  pinned: boolean
  onEnter: () => void
  onLeave?: () => void
  onClose: () => void
}) {
  const t = useT()
  const W = 372
  const space = typeof window !== 'undefined' ? window.innerWidth - pop.rect.right : 9999
  const left = space >= W + 16
    ? pop.rect.right + 12
    : Math.max(12, pop.rect.left - W - 12)
  const top = typeof window !== 'undefined'
    ? Math.max(12, Math.min(pop.rect.top - 8, window.innerHeight - 300))
    : pop.rect.top
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={ease}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ left, top, width: W }}
      className={cn(
        'fixed z-[61] overflow-hidden rounded-2xl border border-red-100 bg-white shadow-xl shadow-red-100/70 dark:bg-[#221814] dark:shadow-black/40',
        pinned && 'ring-2 ring-red-200',
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-red-50 bg-red-50/50 px-3.5 py-2.5 dark:border-[#2C211C] dark:bg-[#2C211C]">
        <div className="min-w-0">
          <p className="truncate text-xs font-extrabold text-[#2A1A12] dark:text-[#E8D9CF]">{pop.title}</p>
          {pop.subtitle && <p className="mt-0.5 text-[10px] text-gray-400">{pop.subtitle}</p>}
        </div>
        {pinned && (
          <button
            onClick={onClose}
            aria-label={t('history.closeTable')}
            className="rounded-md p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-[#2C211C]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="history-scroll max-h-[46vh] overflow-y-auto overscroll-contain px-1.5 py-1.5">
        {pop.table}
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Мелкие блоки интерфейса                                             */
/* ------------------------------------------------------------------ */

function SummaryChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-3.5 py-2 text-xs font-bold text-gray-600 shadow-sm dark:bg-[#221814]">
      <span className="text-red-600">{icon}</span>
      {value} <span className="font-semibold text-gray-400">{label}</span>
    </span>
  )
}

/* Оформление выводов ИИ-анализа: опасно / предупреждение / норма */
const SEVERITY_META = {
  danger: {
    label: 'history.sevDanger',
    wrap: 'border-red-200 bg-red-50/70 dark:bg-[#331B16]',
    badge: 'bg-red-600 text-white',
    title: 'text-red-700 dark:text-red-400',
    icon: <TriangleAlert className="h-4 w-4 shrink-0 text-red-600" />,
  },
  warn: {
    label: 'history.sevWarn',
    wrap: 'border-amber-200 bg-amber-50/70 dark:bg-[#3A2C14]',
    badge: 'bg-amber-500 text-white',
    title: 'text-amber-700 dark:text-amber-400',
    icon: <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />,
  },
  ok: {
    label: 'history.sevOk',
    wrap: 'border-emerald-200 bg-emerald-50/70 dark:bg-[#16302A]',
    badge: 'bg-emerald-600 text-white',
    title: 'text-emerald-700 dark:text-emerald-400',
    icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />,
  },
} as const

/** Вывод ИИ-анализа: что не так + краткое, как исправить. */
function InsightCard({ f }: { f: HistoryInsightDto }) {
  const t = useT()
  const meta = SEVERITY_META[f.severity]
  return (
    <div className={cn('rounded-2xl border p-3.5', meta.wrap)}>
      <div className="flex flex-wrap items-center gap-2">
        {meta.icon}
        <p className={cn('text-sm font-extrabold', meta.title)}>{f.title}</p>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide', meta.badge)}>
          {t(meta.label)}
        </span>
        {f.pointName && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-[#221814]">
            <Hexagon className="h-3 w-3 text-red-500" /> {f.pointName}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
        <span className="font-extrabold text-gray-700 dark:text-gray-200">{t('history.problemLabel')}</span>
        {f.problem}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
        <span className="font-extrabold text-gray-700 dark:text-gray-200">{t('history.fixLabel')}</span>
        {f.fix}
      </p>
      {f.metrics.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {f.metrics.map((m) => (
            <span key={m.label} className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-gray-600 shadow-sm dark:bg-[#221814]">
              <span className="text-gray-400">{m.label}: </span>{m.value}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Мини-карточка показаний одного улья в конкретный час. */
function HourCard({
  name,
  log,
  alarm,
  onHover,
  onLeave,
  onClick,
}: {
  name: string
  log: HistoryLogDto
  alarm: boolean
  onHover: (el: HTMLElement) => void
  onLeave: () => void
  onClick: (el: HTMLElement) => void
}) {
  const t = useT()
  return (
    <div
      onMouseEnter={(e) => onHover(e.currentTarget)}
      onMouseLeave={onLeave}
      onClick={(e) => onClick(e.currentTarget)}
      className={cn(
        'cursor-pointer rounded-xl border px-2.5 py-2 transition-shadow hover:shadow-md',
        alarm
          ? 'border-red-300 bg-red-50/70 dark:bg-[#331B16]'
          : 'border-red-100 bg-red-50/40 dark:bg-[#2C211C]',
      )}
    >
      <p className="flex items-center gap-1 truncate text-[10px] font-bold text-gray-500">
        {alarm && <TriangleAlert className="h-3 w-3 shrink-0 text-red-500" />}
        {name}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[11px] font-extrabold tabular-nums text-[#2A1A12] dark:text-[#E8D9CF]">
        <span className="inline-flex items-center gap-0.5">
          <Thermometer className="h-3 w-3 text-red-500" /> {log.tempC.toFixed(1)}°
        </span>
        <span className="inline-flex items-center gap-0.5">
          <Weight className="h-3 w-3 text-amber-500" /> {t('history.kgVal', { n: log.weightKg.toFixed(1) })}
        </span>
        <span className="inline-flex items-center gap-0.5">
          <Droplets className="h-3 w-3 text-sky-500" /> {log.humidityPct}%
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Основной экран                                                      */
/* ------------------------------------------------------------------ */

export function HistoryView() {
  const lang = useAppState((s) => s.lang)
  const t = useT()
  const [scope, setScope] = useState<HistoryScope>('day')
  /** Выбранный период: yyyy-MM-dd | yyyy-MM | yyyy; null — «последние записи». */
  const [dateKey, setDateKey] = useState<string | null>(null)
  /** Каскадный выбор: сначала пасека, потом конкретный улей. */
  const [groupFilter, setGroupFilter] = useState<'all' | string>('all')
  const [pointFilter, setPointFilter] = useState<'all' | string>('all')
  const [pickerOpen, setPickerOpen] = useState(false)
  /** Открытая пасека внутри выбора: 'root' — список пасек, id — список её ульев. */
  const [pickerLevel, setPickerLevel] = useState<'root' | string>('root')
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [calOpen, setCalOpen] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  const [hoverPop, setHoverPop] = useState<PopState | null>(null)
  const [pinnedPop, setPinnedPop] = useState<PopState | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const range = data?.range ?? { from: '2026-07-01', to: '2026-08-29' }

  /* Загрузка: состояние «загрузки/ошибки» производное от ключа периода —
     без setState внутри тела эффекта (правило react-hooks). */
  const defaultYear = range.to.slice(0, 4)
  const currentKey = `${scope}|${dateKey ?? (scope === 'year' ? defaultYear : 'latest')}|${reloadTick}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [errState, setErrState] = useState<{ key: string; message: string } | null>(null)
  const loading = loadedKey !== currentKey
  const error = errState && errState.key === currentKey ? errState.message : null

  useEffect(() => {
    const ctrl = new AbortController()
    const q = dateKey
      ? scope === 'day'
        ? `date=${dateKey}`
        : scope === 'month'
          ? `month=${dateKey}`
          : `year=${dateKey}`
      : scope === 'year'
        ? `year=${defaultYear}`
        : ''
    fetch(`/api/history?scope=${scope}${q ? `&${q}` : ''}`, { cache: 'no-store', signal: ctrl.signal })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as HistoryResponse & { error?: string }
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`)
        return j
      })
      .then((j) => {
        if (ctrl.signal.aborted) return
        setData(j)
        setHoverPop(null)
        setPinnedPop(null)
        setErrState(null)
        const resolvedDate = dateKey ?? j.date
        setLoadedKey(`${scope}|${resolvedDate}|${reloadTick}`)
        if (!dateKey) setDateKey(j.date)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setErrState({
          key: `${scope}|${dateKey ?? (scope === 'year' ? defaultYear : 'latest')}|${reloadTick}`,
          message: e instanceof Error ? e.message : t('history.loadFailed'),
        })
        setLoadedKey(`${scope}|${dateKey ?? (scope === 'year' ? defaultYear : 'latest')}|${reloadTick}`)
      })
    return () => ctrl.abort()
  }, [scope, dateKey, reloadTick, defaultYear])

  /* ИИ-анализ периода: запускается, когда журнал загружен, и следует за
     выбранным периодом и ульем. Анализ делает /api/history/ai — агент смотрит
     на те же данные, что и графики, и объясняет, как исправить отклонения. */
  const [aiData, setAiData] = useState<HistoryAiResponse | null>(null)
  const [aiKey, setAiKey] = useState<string | null>(null)
  const [aiErr, setAiErr] = useState<string | null>(null)
  const expectedAiKey = data ? `${scope}|${data.date}|${pointFilter}|${reloadTick}` : null
  const aiLoading = expectedAiKey !== null && aiKey !== expectedAiKey

  useEffect(() => {
    if (!data || loading) return
    const key = `${scope}|${data.date}|${pointFilter}|${reloadTick}`
    if (aiKey === key) return
    const ctrl = new AbortController()
    const dateParam =
      scope === 'day' ? `date=${data.date}` : scope === 'month' ? `month=${data.date}` : `year=${data.date}`
    const pointQ = pointFilter !== 'all' ? `&pointId=${encodeURIComponent(pointFilter)}` : ''
    fetch(`/api/history/ai?scope=${scope}&${dateParam}${pointQ}`, { cache: 'no-store', signal: ctrl.signal })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as HistoryAiResponse & { error?: string }
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`)
        return j
      })
      .then((j) => {
        if (ctrl.signal.aborted) return
        setAiData(j)
        setAiKey(key)
        setAiErr(null)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setAiKey(key)
        setAiErr(e instanceof Error ? e.message : t('history.aiFailed'))
      })
    return () => ctrl.abort()
  }, [data, loading, scope, pointFilter, reloadTick, aiKey])

  /* Всплывающие таблицы */
  const openPop = useCallback(
    (el: HTMLElement, title: string, subtitle: string | undefined, table: React.ReactNode) => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current)
        leaveTimer.current = null
      }
      const r = el.getBoundingClientRect()
      setHoverPop({ rect: { left: r.left, right: r.right, top: r.top }, title, subtitle, table })
    },
    [],
  )
  const closePopSoon = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => setHoverPop(null), 180)
  }, [])
  const keepPop = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }, [])
  const pinPop = useCallback(
    (el: HTMLElement, title: string, subtitle: string | undefined, table: React.ReactNode) => {
      const r = el.getBoundingClientRect()
      const st = { rect: { left: r.left, right: r.right, top: r.top }, title, subtitle, table }
      setPinnedPop((prev) =>
        prev && prev.title === title && prev.rect.top === st.rect.top ? null : st,
      )
    },
    [],
  )
  useEffect(() => () => void (leaveTimer.current && clearTimeout(leaveTimer.current)), [])

  /* Данные журнала с каскадным фильтром «пасека → улей» */
  const groups = data?.groups ?? []
  const pointName = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of data?.points ?? []) m.set(p.id, p.name)
    return m
  }, [data])

  /** Попадает ли улей в текущий выбор пасеки/улья. */
  const matchPoint = useCallback(
    (pid: string) => {
      if (pointFilter !== 'all') return pid === pointFilter
      if (groupFilter === 'all') return true
      return groups.find((g) => g.id === groupFilter)?.pointIds.includes(pid) ?? false
    },
    [pointFilter, groupFilter, groups],
  )

  const filteredLogs = useMemo(() => {
    if (!data?.logs) return []
    return data.logs.filter((l) => matchPoint(l.pointId))
  }, [data, matchPoint])

  /* День: группировка по часам */
  const dayHours = useMemo(() => {
    const map = new Map<number, HistoryLogDto[]>()
    for (const l of filteredLogs) {
      const h = new Date(l.recordedAt).getUTCHours()
      const arr = map.get(h)
      if (arr) arr.push(l)
      else map.set(h, [l])
    }
    return [...map.entries()].sort(([a], [b]) => a - b)
  }, [filteredLogs])

  /* Сводки периода */
  const daySummary = useMemo(() => {
    if (filteredLogs.length === 0) return null
    const avgT = filteredLogs.reduce((s, l) => s + l.tempC, 0) / filteredLogs.length
    const avgH = filteredLogs.reduce((s, l) => s + l.humidityPct, 0) / filteredLogs.length
    const byPoint = new Map<string, { first: number; last: number }>()
    for (const l of filteredLogs) {
      const acc = byPoint.get(l.pointId) ?? { first: l.weightKg, last: l.weightKg }
      acc.last = l.weightKg
      byPoint.set(l.pointId, acc)
    }
    const gain = [...byPoint.values()].reduce((s, v) => s + (v.last - v.first), 0)
    const alarms = filteredLogs.filter((l) => l.alarm).length
    return { avgT, avgH, gain, alarms, logs: filteredLogs.length }
  }, [filteredLogs])

  const monthSummary = useMemo(() => {
    const days = (data?.days ?? []).filter((d) => d.perPoint.some((p) => matchPoint(p.pointId)))
    if (days.length === 0) return null
    const pts = days.flatMap((d) => d.perPoint.filter((p) => matchPoint(p.pointId)))
    const avgT = pts.reduce((s, p) => s + p.avgTempC * p.logs, 0) / pts.reduce((s, p) => s + p.logs, 0)
    const avgH = pts.reduce((s, p) => s + p.avgHumidityPct * p.logs, 0) / pts.reduce((s, p) => s + p.logs, 0)
    const gain = pts.reduce((s, p) => s + p.deltaWeightKg, 0)
    const alarms = pts.reduce((s, p) => s + p.alarms, 0)
    const logs = pts.reduce((s, p) => s + p.logs, 0)
    return { days: days.length, avgT, avgH, gain, alarms, logs }
  }, [data, matchPoint])

  const yearSummary = useMemo(() => {
    const months = (data?.months ?? []).filter((m) => m.perPoint.some((p) => matchPoint(p.pointId)))
    if (months.length === 0) return null
    const pts = months.flatMap((m) => m.perPoint.filter((p) => matchPoint(p.pointId)))
    const avgT = pts.reduce((s, p) => s + p.avgTempC * p.logs, 0) / pts.reduce((s, p) => s + p.logs, 0)
    const avgH = pts.reduce((s, p) => s + p.avgHumidityPct * p.logs, 0) / pts.reduce((s, p) => s + p.logs, 0)
    const gain = pts.reduce((s, p) => s + p.deltaWeightKg, 0)
    const alarms = pts.reduce((s, p) => s + p.alarms, 0)
    const logs = pts.reduce((s, p) => s + p.logs, 0)
    return { months: months.length, avgT, avgH, gain, alarms, logs }
  }, [data, matchPoint])

  /* Таблицы для всплывающих окон */

  /** Почасовые изменения одной семьи за выбранный день. */
  const dayHiveTable = useCallback(
    (pointId: string, hour: number) => {
      const logs = data?.logs?.filter((l) => l.pointId === pointId) ?? []
      const rows = logs.map((l, i) => {
        const prev = i > 0 ? logs[i - 1] : null
        return [
          fmtTime(l.recordedAt),
          t('history.kgVal', { n: l.weightKg.toFixed(1) }),
          <Delta key="dw" v={prev ? l.weightKg - prev.weightKg : 0} unit="кг" />,
          `${l.tempC.toFixed(1)}°C`,
          <Delta key="dt" v={prev ? l.tempC - prev.tempC : 0} unit="°C" />,
          `${l.humidityPct}%`,
          <Delta key="dh" v={prev ? l.humidityPct - prev.humidityPct : 0} unit="%" />,
        ]
      })
      return (
        <MiniTable
          head={[t('history.th.hour'), t('history.th.weight'), 'Δ', t('history.th.temp'), 'Δ', t('history.th.hum'), 'Δ']}
          rows={rows}
          highlight={hour}
        />
      )
    },
    [data, t],
  )

  /** Снимок всех ульев в конкретный час (в рамках выбранной пасеки/улья). */
  const hourSnapshotTable = useCallback(
    (hour: number) => {
      const logs = filteredLogs.filter((l) => new Date(l.recordedAt).getUTCHours() === hour)
      const rows = logs.map((l) => [
        pointName.get(l.pointId) ?? t('history.hive'),
        t('history.kgVal', { n: l.weightKg.toFixed(1) }),
        `${l.tempC.toFixed(1)}°C`,
        `${l.humidityPct}%`,
        l.alarm ? <span key="a" className="inline-flex items-center gap-1 font-bold text-red-600"><TriangleAlert className="h-3 w-3" /> {t('history.alarm')}</span> : <span key="a" className="text-emerald-600">{t('history.ok')}</span>,
      ])
      return <MiniTable head={[t('history.th.hive'), t('history.th.weight'), t('history.th.temp'), t('history.th.hum'), t('history.th.status')]} rows={rows} />
    },
    [filteredLogs, pointName, t],
  )

  /** Сводка по ульям за день (месячный вид). */
  const monthDayTable = useCallback(
    (date: string) => {
      const day = data?.days?.find((d) => d.date === date)
      const per = (day?.perPoint ?? []).filter((p) => matchPoint(p.pointId))
      const rows = per.map((p) => [
        pointName.get(p.pointId) ?? t('history.hive'),
        t('history.kgVal', { n: p.startWeightKg.toFixed(1) }),
        t('history.kgVal', { n: p.endWeightKg.toFixed(1) }),
        <span key="d" className={cn('font-bold', p.deltaWeightKg >= 0 ? 'text-emerald-600' : 'text-red-600')}>
          {t('history.kgVal', { n: `${p.deltaWeightKg >= 0 ? '+' : ''}${p.deltaWeightKg.toFixed(1)}` })}
        </span>,
        `${p.avgTempC.toFixed(1)}°C`,
        `${p.minTempC.toFixed(1)}…${p.maxTempC.toFixed(1)}°C`,
        `${p.avgHumidityPct}%`,
        `${p.logs}`,
        p.alarms > 0 ? <span key="a" className="font-bold text-red-600">{p.alarms}</span> : <span key="a" className="text-gray-400">0</span>,
      ])
      return (
        <MiniTable
          head={[t('history.th.hive'), t('history.th.morningW'), t('history.th.eveningW'), t('history.th.dayDelta'), t('history.th.avgT'), t('history.th.tMinMax'), t('history.th.avgHum'), t('history.th.records'), t('history.th.events')]}
          rows={rows}
        />
      )
    },
    [data, matchPoint, pointName, t],
  )

  /** Сводка по ульям за месяц (годовой вид). */
  const yearMonthTable = useCallback(
    (month: string) => {
      const m = data?.months?.find((x) => x.month === month)
      const per = (m?.perPoint ?? []).filter((p) => matchPoint(p.pointId))
      const rows = per.map((p) => [
        pointName.get(p.pointId) ?? t('history.hive'),
        `${p.avgTempC.toFixed(1)}°C`,
        `${p.avgHumidityPct}%`,
        <span key="d" className={cn('font-bold', p.deltaWeightKg >= 0 ? 'text-emerald-600' : 'text-red-600')}>
          {t('history.kgVal', { n: `${p.deltaWeightKg >= 0 ? '+' : ''}${p.deltaWeightKg.toFixed(1)}` })}
        </span>,
        `${p.logs}`,
        p.alarms > 0 ? <span key="a" className="font-bold text-red-600">{p.alarms}</span> : <span key="a" className="text-gray-400">0</span>,
      ])
      return <MiniTable head={[t('history.th.hive'), t('history.th.avgT'), t('history.th.avgHum'), t('history.th.gain'), t('history.th.records'), t('history.th.events')]} rows={rows} />
    },
    [data, matchPoint, pointName, t],
  )

  /* Переключение периодов */

  const clampDayKey = (key: string) =>
    key < range.from ? range.from : key > range.to ? range.to : key

  /** «2026-08-29» / «2026-08» / «2026» → ключ дня в пределах диапазона журнала. */
  const asDayKey = (k: string) => {
    if (k.length === 10) return k
    if (k.length === 7) return `${k}-01`
    return `${k}-${range.from.slice(5, 7)}-01`
  }

  const clampMonthKey = (key: string) => {
    const from = range.from.slice(0, 7)
    const to = range.to.slice(0, 7)
    return key < from ? from : key > to ? to : key
  }

  const switchScope = (next: HistoryScope) => {
    if (next === scope) return
    const cur = dateKey ?? range.to
    let key: string
    if (next === 'day') key = clampDayKey(asDayKey(cur))
    else if (next === 'month') key = clampMonthKey(cur.slice(0, 7))
    else {
      const y = Number(cur.slice(0, 4))
      const minY = Number(range.from.slice(0, 4))
      const maxY = Number(range.to.slice(0, 4))
      key = String(Math.max(minY, Math.min(maxY, y)))
    }
    setScope(next)
    setDateKey(key)
  }

  const step = (dir: 1 | -1) => {
    const cur = dateKey ?? range.to
    if (scope === 'day') setDateKey(clampDayKey(addDaysKey(cur, dir)))
    else if (scope === 'month') {
      const mk = addMonthsKey(cur, dir)
      setDateKey(mk < range.from.slice(0, 7) ? range.to.slice(0, 7) : mk > range.to.slice(0, 7) ? range.from.slice(0, 7) : mk)
    } else {
      const y = Number(cur) + dir
      const minY = Number(range.from.slice(0, 4))
      const maxY = Number(range.to.slice(0, 4))
      setDateKey(String(Math.max(minY, Math.min(maxY, y))))
    }
  }

  const periodLabel = !dateKey
    ? t('history.latestRecords')
    : scope === 'day'
      ? fmtDateLabel(dateKey, lang)
      : scope === 'month'
        ? fmtMonthLabel(dateKey, lang)
        : t('history.yearLabel', { n: dateKey })

  const atStart = !dateKey
    ? false
    : scope === 'day'
      ? dateKey <= range.from
      : scope === 'month'
        ? dateKey <= range.from.slice(0, 7)
        : Number(dateKey) <= Number(range.from.slice(0, 4))
  const atEnd = !dateKey
    ? false
    : scope === 'day'
      ? dateKey >= range.to
      : scope === 'month'
        ? dateKey >= range.to.slice(0, 7)
        : Number(dateKey) >= Number(range.to.slice(0, 4))

  const calendarMonth = useMemo(() => {
    const base = dateKey ?? range.to
    const key = scope === 'day' ? base : scope === 'month' ? `${base}-01` : `${base}-${range.to.slice(5, 7)}-01`
    return parseDayKey(key)
  }, [dateKey, scope, calOpen, range])

  const hasSensorPoints = (data?.points.length ?? 0) > 0
  const showPop = pinnedPop ?? hoverPop

  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Стиль скроллбара журнала */}
      <style>{`
        .history-scroll::-webkit-scrollbar { width: 8px }
        .history-scroll::-webkit-scrollbar-thumb { background: #f0d5c8; border-radius: 999px }
        .history-scroll::-webkit-scrollbar-track { background: transparent }
        .dark .history-scroll::-webkit-scrollbar-thumb { background: #3a2a22 }
      `}</style>

      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[#2A1A12]">
            <History className="h-6 w-6 text-red-600" /> {t('history.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {t('history.subtitle')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-400 shadow-sm dark:bg-[#221814]">
          <MousePointerClick className="h-3.5 w-3.5 text-red-500" /> {t('history.clickPins')}
        </span>
      </div>

      {/* Панель периодов */}
      <Card className="border-red-100 dark:bg-[#221814]">
        <CardContent className="flex flex-wrap items-center gap-2.5 p-3.5">
          {/* День / Месяц / Год */}
          <div className="flex rounded-full border border-red-100 bg-red-50/50 p-1 dark:border-[#2C211C] dark:bg-[#2C211C]">
            {([
              { id: 'day', label: t('history.scope.day') },
              { id: 'month', label: t('history.scope.month') },
              { id: 'year', label: t('history.scope.year') },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => switchScope(t.id)}
                aria-pressed={scope === t.id}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-extrabold transition-all',
                  scope === t.id
                    ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md shadow-red-100'
                    : 'text-gray-500 hover:text-red-600',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Шаг назад/вперёд */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-full border-red-100"
              disabled={atStart}
              onClick={() => step(-1)}
              aria-label={t('history.prevPeriod')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[170px] text-center text-sm font-extrabold tabular-nums text-[#2A1A12] dark:text-[#E8D9CF]">
              {periodLabel}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-full border-red-100"
              disabled={atEnd}
              onClick={() => step(1)}
              aria-label={t('history.nextPeriod')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Календарь */}
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 gap-1.5 rounded-full border-red-100 text-xs font-bold">
                <CalendarDays className="h-4 w-4 text-red-600" /> {t('history.calendar')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                locale={LANG_DATE_LOCALE[lang]}
                captionLayout="dropdown"
                formatters={{
                  // подпись месяца в выпадающем списке — по-русски (в компоненте
                  // календаря локаль по умолчанию — «default» браузера)
                  formatMonthDropdown: (m) => tr(lang, MONTH_NOM_KEYS[m.getMonth()]),
                }}
                defaultMonth={calendarMonth}
                selected={scope === 'day' && dateKey ? parseDayKey(dateKey) : undefined}
                onSelect={(d) => {
                  if (!d) return
                  setScope('day')
                  setDateKey(dayKeyOf(d))
                  setCalOpen(false)
                }}
                disabled={[{ before: parseDayKey(range.from), after: parseDayKey(range.to) }]}
              />
              <p className="border-t border-red-50 px-3 py-2 text-[10px] leading-relaxed text-gray-400 dark:border-[#2C211C]">
                {t('history.calHint')}
              </p>
            </PopoverContent>
          </Popover>

          {/* Каскадный выбор: пасека → улей */}
          {hasSensorPoints && (
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => {
                  setPointFilter('all')
                  setGroupFilter('all')
                }}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[11px] font-bold transition',
                  pointFilter === 'all' && groupFilter === 'all'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-red-50 text-gray-500 hover:text-red-600 dark:bg-[#2C211C]',
                )}
              >
                {t('history.allHives')}
              </button>

              <Popover
                open={pickerOpen}
                onOpenChange={(v) => {
                  setPickerOpen(v)
                  if (!v) setPickerLevel('root')
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    aria-label={t('history.pickApiaryHive')}
                    className={cn(
                      'h-9 gap-1.5 rounded-full border-red-100 text-[11px] font-bold',
                      (pointFilter !== 'all' || groupFilter !== 'all') && 'border-red-300 bg-red-50 text-red-700',
                    )}
                  >
                    <Hexagon className="h-3.5 w-3.5 text-red-600" />
                    {pointFilter !== 'all'
                      ? (pointName.get(pointFilter) ?? t('history.hive'))
                      : groupFilter !== 'all'
                        ? (groups.find((g) => g.id === groupFilter)?.name ?? t('history.apiary'))
                        : t('history.apiaryAndHive')}
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-2">
                  {pickerLevel === 'root' ? (
                    <>
                      <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        {t('history.chooseApiary')}
                      </p>
                      <div className="space-y-0.5">
                        {groups.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => setPickerLevel(g.id)}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-red-50 dark:hover:bg-[#2C211C]"
                          >
                            <Hexagon className="h-4 w-4 shrink-0 text-red-500" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-extrabold text-[#2A1A12] dark:text-[#E8D9CF]">
                                {g.name}
                              </span>
                              <span className="text-[10px] font-semibold text-gray-400">
                                {t('history.hivesNext', { n: g.pointIds.length, word: hiveWord(g.pointIds.length) })}
                              </span>
                            </span>
                            {groupFilter === g.id && <Check className="h-4 w-4 shrink-0 text-red-600" />}
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 border-t border-red-50 px-2 pb-1 pt-2 text-[10px] leading-relaxed text-gray-400 dark:border-[#2C211C]">
                        {t('history.apiaryNote')}
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setPickerLevel('root')}
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-extrabold text-red-700 transition hover:bg-red-50 dark:hover:bg-[#2C211C]"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> {t('history.allApiaries')}
                      </button>
                      {(() => {
                        const g = groups.find((x) => x.id === pickerLevel)
                        if (!g) return null
                        const pts = g.pointIds
                          .map((pid) => ({ id: pid, name: pointName.get(pid) ?? t('history.hive') }))
                          .sort((a, b) => {
                            const ai = (data?.points ?? []).findIndex((p) => p.id === a.id)
                            const bi = (data?.points ?? []).findIndex((p) => p.id === b.id)
                            return ai - bi
                          })
                        return (
                          <>
                            <p className="flex items-center gap-2 px-2 pt-1 text-xs font-extrabold text-[#2A1A12] dark:text-[#E8D9CF]">
                              <Hexagon className="h-4 w-4 text-red-500" /> {g.name}
                            </p>
                            <button
                              onClick={() => {
                                setGroupFilter(g.id)
                                setPointFilter('all')
                                setPickerOpen(false)
                              }}
                              className={cn(
                                'mt-1.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-red-50 dark:hover:bg-[#2C211C]',
                                groupFilter === g.id && pointFilter === 'all' && 'bg-red-50 dark:bg-[#2C211C]',
                              )}
                            >
                              <span className="min-w-0 flex-1 text-xs font-bold text-gray-600 dark:text-gray-300">
                                {t('history.allApiaryHives', { n: pts.length })}
                              </span>
                              {groupFilter === g.id && pointFilter === 'all' && (
                                <Check className="h-4 w-4 shrink-0 text-red-600" />
                              )}
                            </button>
                            <div className="mt-0.5 space-y-0.5">
                              {pts.map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    setGroupFilter(g.id)
                                    setPointFilter(p.id)
                                    setPickerOpen(false)
                                  }}
                                  className={cn(
                                    'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-red-50 dark:hover:bg-[#2C211C]',
                                    pointFilter === p.id && 'bg-red-50 dark:bg-[#2C211C]',
                                  )}
                                >
                                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#2A1A12] dark:text-[#E8D9CF]">
                                    {p.name}
                                  </span>
                                  {pointFilter === p.id && <Check className="h-4 w-4 shrink-0 text-red-600" />}
                                </button>
                              ))}
                            </div>
                          </>
                        )
                      })()}
                    </>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Состояния */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <p className="text-sm font-semibold text-red-600">{t('history.loadFailedWith', { n: error })}</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setReloadTick((t) => t + 1)}>
              <RefreshCcw className="h-3.5 w-3.5" /> {t('history.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && !data && loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-red-100/50" />
          ))}
        </div>
      )}

      {!error && data && !hasSensorPoints && (
        <Card className="border-dashed border-red-200 bg-red-50/30 dark:bg-[#221814]">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <History className="h-8 w-8 text-red-300" />
            <p className="font-bold text-[#2A1A12]">{t('history.noJournalTitle')}</p>
            <p className="max-w-sm text-sm text-gray-500">{t('history.noJournalBody')}</p>
          </CardContent>
        </Card>
      )}

      {!error && data && hasSensorPoints && (
        <>
          {/* Сводка периода */}
          <div className="flex flex-wrap gap-2">
            {scope === 'day' && daySummary && (
              <>
                <SummaryChip icon={<Thermometer className="h-3.5 w-3.5" />} label={t('history.stat.avgDay')} value={`${daySummary.avgT.toFixed(1)}°C`} />
                <SummaryChip icon={<Droplets className="h-3.5 w-3.5" />} label={t('history.stat.avgHum')} value={`${Math.round(daySummary.avgH)}%`} />
                <SummaryChip icon={<Weight className="h-3.5 w-3.5" />} label={t('history.stat.gainDay')} value={t('history.kgVal', { n: `${daySummary.gain >= 0 ? '+' : ''}${daySummary.gain.toFixed(1)}` })} />
                <SummaryChip icon={<Clock3 className="h-3.5 w-3.5" />} label={t('history.stat.hourlyLogs')} value={daySummary.logs} />
                <SummaryChip
                  icon={<TriangleAlert className="h-3.5 w-3.5" />}
                  label={t('history.stat.alarms')}
                  value={<span className={daySummary.alarms > 0 ? 'text-red-600' : ''}>{daySummary.alarms}</span>}
                />
              </>
            )}
            {scope === 'month' && monthSummary && (
              <>
                <SummaryChip icon={<CalendarDays className="h-3.5 w-3.5" />} label={t('history.stat.daysWithLogs')} value={monthSummary.days} />
                <SummaryChip icon={<Thermometer className="h-3.5 w-3.5" />} label={t('history.stat.avgMonth')} value={`${monthSummary.avgT.toFixed(1)}°C`} />
                <SummaryChip icon={<Droplets className="h-3.5 w-3.5" />} label={t('history.stat.avgHum')} value={`${Math.round(monthSummary.avgH)}%`} />
                <SummaryChip icon={<Weight className="h-3.5 w-3.5" />} label={t('history.stat.gainMonth')} value={t('history.kgVal', { n: `${monthSummary.gain >= 0 ? '+' : ''}${monthSummary.gain.toFixed(1)}` })} />
                <SummaryChip
                  icon={<TriangleAlert className="h-3.5 w-3.5" />}
                  label={t('history.stat.alarms')}
                  value={<span className={monthSummary.alarms > 0 ? 'text-red-600' : ''}>{monthSummary.alarms}</span>}
                />
              </>
            )}
            {scope === 'year' && yearSummary && (
              <>
                <SummaryChip icon={<CalendarDays className="h-3.5 w-3.5" />} label={t('history.stat.monthsWithLogs')} value={yearSummary.months} />
                <SummaryChip icon={<Thermometer className="h-3.5 w-3.5" />} label={t('history.stat.avgYear')} value={`${yearSummary.avgT.toFixed(1)}°C`} />
                <SummaryChip icon={<Weight className="h-3.5 w-3.5" />} label={t('history.stat.gainYear')} value={t('history.kgVal', { n: `${yearSummary.gain >= 0 ? '+' : ''}${yearSummary.gain.toFixed(1)}` })} />
                <SummaryChip icon={<Clock3 className="h-3.5 w-3.5" />} label={t('history.stat.journalLogs')} value={yearSummary.logs} />
                <SummaryChip
                  icon={<TriangleAlert className="h-3.5 w-3.5" />}
                  label={t('history.stat.alarms')}
                  value={<span className={yearSummary.alarms > 0 ? 'text-red-600' : ''}>{yearSummary.alarms}</span>}
                />
              </>
            )}
            {(scope === 'day' && !daySummary) || (scope === 'month' && !monthSummary) || (scope === 'year' && !yearSummary) ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-red-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-400 dark:bg-[#221814]">
                {t('history.noRecordsChip')}
              </span>
            ) : null}
          </div>

          {/* ИИ-анализ периода: агент смотрит на те же данные, что и графики */}
          {data && hasSensorPoints && !aiLoading && aiData && aiData.findings.length > 0 && (
            <Card className="border-red-100 dark:bg-[#221814]">
              <CardContent className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                    <Sparkles className="h-3.5 w-3.5 text-red-500" />
                    {t('history.aiTitle')}
                  </p>
                  <span className="text-[11px] font-semibold text-gray-400">
                    {periodLabel}
                    {aiData.pointName ? ` · ${aiData.pointName}` : t('history.aiAllHives')}
                  </span>
                  {aiErr && (
                    <span className="text-[11px] font-semibold text-red-500">{t('history.aiError', { n: aiErr })}</span>
                  )}
                </div>
                <div className="grid gap-2.5 md:grid-cols-2">
                  {aiData.findings.map((f) => (
                    <InsightCard key={f.id + (f.pointName ?? '')} f={f} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {data && hasSensorPoints && aiLoading && (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-red-100 bg-red-50/30 px-4 py-3 dark:bg-[#221814]">
              <Loader2 className="h-4 w-4 animate-spin text-red-500" />
              <p className="text-xs font-semibold text-gray-400">
                {t('history.aiLoading')}
              </p>
            </div>
          )}

          {/* Пустой период */}
          {((scope === 'day' && filteredLogs.length === 0) ||
            (scope === 'month' && monthSummary === null) ||
            (scope === 'year' && yearSummary === null)) && (
            <Card className="border-dashed border-red-200 bg-red-50/30 dark:bg-[#221814]">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <Clock3 className="h-8 w-8 text-red-300" />
                <p className="font-bold text-[#2A1A12]">{t('history.emptyTitle')}</p>
                <p className="max-w-sm text-sm text-gray-500">{t('history.emptyBody')}</p>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-red-600 to-orange-500 font-bold"
                  onClick={() => {
                    setScope('day')
                    setDateKey(range.to)
                  }}
                >
                  {t('history.toLatest')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ДЕНЬ: почасовой таймлайн */}
          {scope === 'day' && dayHours.length > 0 && (
            <Card className="border-red-100 dark:bg-[#221814]">
              <CardContent className="p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                  <Clock3 className="h-3.5 w-3.5 text-red-500" />
                  {t('history.dayTimelineTitle', { n: fmtDateLabel(data.date, lang) })}
                  <span className="font-semibold normal-case text-gray-400">{t('history.dayTimelineHint')}</span>
                </p>
                <div className="history-scroll max-h-[540px] space-y-2 overflow-y-auto pr-1">
                  {dayHours.map(([hour, logs]) => (
                    <motion.div
                      key={hour}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={ease}
                      className="flex items-stretch gap-2.5"
                    >
                      <button
                        onMouseEnter={(e) =>
                          openPop(e.currentTarget, t('history.snapAll', { n: pad2(hour) }), t('history.snapOn', { n: fmtDateLabel(data.date, lang) }), hourSnapshotTable(hour))
                        }
                        onMouseLeave={closePopSoon}
                        onClick={(e) =>
                          pinPop(e.currentTarget, t('history.snapAll', { n: pad2(hour) }), t('history.snapOn', { n: fmtDateLabel(data.date, lang) }), hourSnapshotTable(hour))
                        }
                        className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-red-100 transition hover:ring-red-300 dark:bg-[#2C211C] dark:ring-[#2C211C]"
                        aria-label={t('history.snapAria', { n: pad2(hour) })}
                      >
                        <span className="text-sm font-extrabold tabular-nums text-[#2A1A12] dark:text-[#E8D9CF]">
                          {pad2(hour)}:00
                        </span>
                        <span className="text-[9px] font-semibold text-gray-400">{t('history.everyHour')}</span>
                      </button>
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {logs.map((l) => (
                          <HourCard
                            key={`${l.pointId}-${l.recordedAt}`}
                            name={pointName.get(l.pointId) ?? t('history.hive')}
                            log={l}
                            alarm={l.alarm}
                            onHover={(el) =>
                              openPop(
                                el,
                                t('history.hiveDayChanges', { n: pointName.get(l.pointId) ?? t('history.hive') }),
                                t('history.hourHighlighted', { d: fmtDateLabel(data.date, lang), h: pad2(hour) }),
                                dayHiveTable(l.pointId, hour),
                              )
                            }
                            onLeave={closePopSoon}
                            onClick={(el) =>
                              pinPop(
                                el,
                                t('history.hiveDayChanges', { n: pointName.get(l.pointId) ?? t('history.hive') }),
                                t('history.hourHighlighted', { d: fmtDateLabel(data.date, lang), h: pad2(hour) }),
                                dayHiveTable(l.pointId, hour),
                              )
                            }
                          />
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* МЕСЯЦ: сетка дней */}
          {scope === 'month' && monthSummary !== null && (
            <Card className="border-red-100 dark:bg-[#221814]">
              <CardContent className="p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                  <CalendarDays className="h-3.5 w-3.5 text-red-500" />
                  {t('history.monthGridTitle', { n: fmtMonthLabel(data.date, lang) })}
                  <span className="font-semibold normal-case text-gray-400">{t('history.monthGridHint')}</span>
                </p>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAY_KEYS.map((k) => (
                    <span key={k} className="pb-1 text-[10px] font-bold uppercase text-gray-400">
                      {t(k)}
                    </span>
                  ))}
                  {(() => {
                    const [y, m] = data.date.split('-').map(Number)
                    const first = new Date(Date.UTC(y, m - 1, 1))
                    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
                    const shift = (first.getUTCDay() + 6) % 7
                    const byDay = new Map((data.days ?? []).map((d) => [d.date, d]))
                    const cells: React.ReactNode[] = []
                    for (let i = 0; i < shift; i++) cells.push(<span key={`e${i}`} />)
                    for (let d = 1; d <= daysInMonth; d++) {
                      const key = `${data.date}-${pad2(d)}`
                      const summary = byDay.get(key)
                      const per = (summary?.perPoint ?? []).filter((p) => matchPoint(p.pointId))
                      const gain = per.reduce((s, p) => s + p.deltaWeightKg, 0)
                      const avgT = per.length > 0 ? per.reduce((s, p) => s + p.avgTempC * p.logs, 0) / per.reduce((s, p) => s + p.logs, 0) : null
                      const alarms = per.reduce((s, p) => s + p.alarms, 0)
                      cells.push(
                        <div
                          key={key}
                          onMouseEnter={(e) =>
                            per.length > 0 &&
                            openPop(e.currentTarget, fmtDateLabel(key, lang), t('history.daySummaryPop'), monthDayTable(key))
                          }
                          onMouseLeave={closePopSoon}
                          onClick={() => {
                            if (per.length === 0) return
                            setScope('day')
                            setDateKey(key)
                          }}
                          className={cn(
                            'min-h-[76px] rounded-xl border p-1.5 text-left transition',
                            per.length > 0
                              ? 'cursor-pointer border-red-100 bg-white shadow-sm hover:border-red-300 hover:shadow-md dark:bg-[#2C211C]'
                              : 'border-transparent bg-red-50/30 dark:bg-transparent',
                          )}
                          role={per.length > 0 ? 'button' : undefined}
                        >
                          <p className="flex items-center justify-between text-[11px] font-extrabold tabular-nums">
                            <span className={per.length > 0 ? 'text-[#2A1A12] dark:text-[#E8D9CF]' : 'text-gray-300'}>{d}</span>
                            {alarms > 0 && <TriangleAlert className="h-3 w-3 text-red-500" />}
                          </p>
                          {per.length > 0 && (
                            <div className="mt-1 space-y-0.5 text-[10px] font-bold tabular-nums">
                              <p className={gain >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                {t('history.kgVal', { n: `${gain >= 0 ? '+' : ''}${gain.toFixed(1)}` })}
                              </p>
                              {avgT !== null && <p className="text-red-500">{avgT.toFixed(1)}°C</p>}
                              <p className="text-gray-400">{t('history.logsShort', { n: per.reduce((s, p) => s + p.logs, 0) })}</p>
                            </div>
                          )}
                        </div>,
                      )
                    }
                    return cells
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ГОД: карточки месяцев */}
          {scope === 'year' && yearSummary !== null && (
            <Card className="border-red-100 dark:bg-[#221814]">
              <CardContent className="p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                  <CalendarDays className="h-3.5 w-3.5 text-red-500" />
                  {t('history.yearGridTitle', { n: data.date })}
                  <span className="font-semibold normal-case text-gray-400">{t('history.yearGridHint')}</span>
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {MONTH_NOM_KEYS.map((mkey, idx) => {
                    const mk = `${data.date}-${pad2(idx + 1)}`
                    const m = (data.months ?? []).find((x) => x.month === mk)
                    const per = (m?.perPoint ?? []).filter((p) => matchPoint(p.pointId))
                    const has = per.length > 0
                    const avgT = has ? per.reduce((s, p) => s + p.avgTempC * p.logs, 0) / per.reduce((s, p) => s + p.logs, 0) : null
                    const avgH = has ? per.reduce((s, p) => s + p.avgHumidityPct * p.logs, 0) / per.reduce((s, p) => s + p.logs, 0) : null
                    const gain = per.reduce((s, p) => s + p.deltaWeightKg, 0)
                    const alarms = per.reduce((s, p) => s + p.alarms, 0)
                    const logs = per.reduce((s, p) => s + p.logs, 0)
                    return (
                      <div
                        key={mk}
                        onMouseEnter={(e) =>
                          has && openPop(e.currentTarget, t('history.monthYear', { month: t(mkey), y: data.date }), t('history.monthSummaryPop'), yearMonthTable(mk))
                        }
                        onMouseLeave={closePopSoon}
                        onClick={() => {
                          if (!has) return
                          setScope('month')
                          setDateKey(mk)
                        }}
                        className={cn(
                          'rounded-2xl border p-3 transition',
                          has
                            ? 'cursor-pointer border-red-100 bg-white shadow-sm hover:border-red-300 hover:shadow-md dark:bg-[#2C211C]'
                            : 'border-dashed border-red-100 bg-red-50/30 dark:bg-transparent',
                        )}
                        role={has ? 'button' : undefined}
                      >
                        <p className="flex items-center justify-between text-sm font-extrabold text-[#2A1A12] dark:text-[#E8D9CF]">
                          {t(mkey)}
                          {alarms > 0 && <TriangleAlert className="h-3.5 w-3.5 text-red-500" />}
                        </p>
                        {has ? (
                          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-bold tabular-nums">
                            <span className="text-red-500">{t('history.avgTCard', { n: avgT!.toFixed(1) })}</span>
                            <span className="text-sky-500">{t('history.avgHCard', { n: Math.round(avgH!) })}</span>
                            <span className={gain >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                              {t('history.kgVal', { n: `${gain >= 0 ? '+' : ''}${gain.toFixed(1)}` })}
                            </span>
                            <span className="text-gray-400">{t('history.logsCount', { n: logs })}</span>
                          </div>
                        ) : (
                          <p className="mt-2 text-[11px] font-semibold text-gray-300">{t('history.noRecordsShort')}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-xs leading-relaxed text-gray-400">
            {t('history.footerNote')}
          </p>
        </>
      )}

      {/* Закреплённая таблица: клик по фону закрывает */}
      {pinnedPop && <div className="fixed inset-0 z-[60]" onClick={() => setPinnedPop(null)} aria-hidden />}

      {/* Всплывающая таблица изменений */}
      <AnimatePresence>
        {showPop && (
          <DetailPopup
            key={`pop-${showPop.title}-${showPop.rect.top}`}
            pop={showPop}
            pinned={pinnedPop !== null}
            onEnter={keepPop}
            onLeave={pinnedPop ? undefined : closePopSoon}
            onClose={() => setPinnedPop(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
