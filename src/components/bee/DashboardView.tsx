'use client'

/**
 * Экран «Мои пасеки». Два режима:
 *  — «Демо» → DemoDashboard (сценарные ульи с живой телеметрией);
 *  — «Мои данные» → RealDashboard — ТОТ ЖЕ Bento-стиль, что в демо, но все
 *    числа честные: с датчиков ульев, привязанных на карте.
 *
 * Структура экрана «Мои данные» (совпадает с демо):
 *   1) баннер срочности по данным датчиков (риск роения / наблюдение / норма);
 *   2) заголовок + погодный чип + режим «Демо / Мои данные»;
 *   3) лента-переключатель ульев [Вся пасека | №1 | №2 … | +];
 *   4) БЛОК 1 — шкала состояния + паспорт + статус-баннер + LIVE-плитки
 *      (температура, влажность, масса, шум, заклещенность, датчики, дни);
 *   5) БЛОК 2 — привес за 2 дня 50/50 накоплено за период (прогресс к лидеру);
 *   6) БЛОК 3 — график привесов за 7 дней (столбцы + температура гнезда);
 *   7) ряд из 3 графиков — температура | влажность | масса;
 *   8) БЛОК 4 — микроклимат гнезда 50/50 заклещёванность (ручные замеры,
 *      замкнутый цикл: замер → статус → предписание → «Провести обработку»);
 *   9) погода на пасеке | сводка ульев + лидер пасеки;
 *  10) БЛОК 5 — предписания ИИ-агента (с вечерним отчетом и действиями)
 *      | напоминания и журнал.
 *
 * Заклещенность в реальном режиме — только ручные замеры пчеловода
 * (localStorage по id точки карты): никаких выдуманных чисел.
 * Погода берётся по фактическому центру пасеки — среднему координат точек.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlarmClock,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Bug,
  CalendarDays,
  ClipboardList,
  Droplets,
  Hexagon,
  MapPin,
  MessageSquareText,
  Plus,
  Scale,
  Sun,
  Thermometer,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { UrgencyBadge } from './decor'
import { WeatherPanel, WeatherChip } from './WeatherPanel'
import { StatusGauge, apiaryGauge } from './StatusGauge'
import { useAppState } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  bestHiveOf,
  fmtNum,
  fmtSigned,
  hiveStatus,
  type Hive,
  type MigrationSite,
  type WeatherDay,
} from '@/lib/hive-model'
import {
  findingsFor,
  makeContext,
  type AgentContext,
  type AgentFinding,
  type Urgency,
} from '@/lib/agent'
import { hiveWord, pointsCenter, pointsToHives } from '@/lib/hive-sync'
import { siteDtoToSite, useRealData, weightDeltaSafe } from '@/lib/real-data'
import { varroaStatus } from '@/lib/demo-hives'
import {
  addVarroaMeasure,
  markVarroaTreated,
  varroaSeriesOf,
  varroaStateOf,
  type VarroaState,
} from '@/lib/varroa-store'
import { DEFAULT_PLACE } from '@/lib/sensor-catalog'
import { weatherResponseToDays } from '@/lib/weather-days'
import { whenLabelShort } from './reminders-utils'
import { DemoDashboard } from './DemoDashboard'
import { ModeSwitcher } from './ModeSwitcher'
import { MeasureDialog } from './DemoDialogs'
import {
  AcousticSpark,
  AnimatedNumber,
  DemoClimateMini,
  DemoWeightBars,
  GainComboChart,
  LiveTile,
  MiniCard,
  Rise,
  type GainPoint,
} from './DemoCharts'
import { LANG_DATE_LOCALE, useT } from '@/lib/i18n'
import type { EventDto, MapPointDto, WeatherResponse } from '@/lib/api-types'

const STATUS_STYLES = {
  risk: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 border-red-200' },
  watch: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  ok: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
} as const

/** Цветная лента статуса выбранного улья (как статус-баннер в демо). */
const HIVE_BANNER = {
  risk: 'bg-gradient-to-r from-[#D93E00] to-[#FF5A1F] text-white shadow-red-100',
  watch: 'bg-gradient-to-r from-amber-500 to-orange-400 text-white shadow-amber-100',
  ok: 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-emerald-100',
} as const

/* ------------------------------------------------------------------ */
/* Контейнер дашборда                                                  */
/* ------------------------------------------------------------------ */

export function DashboardView() {
  const mode = useAppState((s) => s.mode)
  // «Демо» — сценарные ульи с живой телеметрией; «Мои данные» — реальный режим,
  // где все диаграммы берутся с датчиков ульев на карте.
  if (mode === 'demo') return <DemoDashboard />
  return <RealDashboard />
}

function RealDashboard() {
  const setView = useAppState((s) => s.setView)
  const hiveId = useAppState((s) => s.hiveId)
  const setHive = useAppState((s) => s.setHive)
  const lang = useAppState((s) => s.lang)
  const t = useT()
  const { status, data, reload } = useRealData()

  // Синхронизация с картой: ульи дашборда = точки на карте, показания — с
  // датчиков. Опрос каждые 5 секунд — числа «живут» вместе с картой.
  const [points, setPoints] = useState<MapPointDto[] | null>(null)
  const [weather, setWeather] = useState<WeatherResponse | null>(null)
  // буфер шума (гул) для живого спарклайна: точка → последние ~30 опросов
  const [noiseSpark, setNoiseSpark] = useState<Record<string, number[]>>({})
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/map-points', { cache: 'no-store' })
        if (!res.ok) return
        const j = (await res.json()) as { points: MapPointDto[] }
        if (!alive) return
        setPoints(j.points)
        // копим живой спарклайн шума по каждой точке
        setNoiseSpark((prev) => {
          const next = { ...prev }
          for (const p of j.points) {
            if (p.sensor.on && p.sensor.noiseDb !== null) {
              next[p.id] = [...(next[p.id] ?? []), p.sensor.noiseDb].slice(-30)
            }
          }
          return next
        })
      } catch {
        // датчики подтянутся на следующем опросе
      }
    }
    void load()
    const timer = setInterval(() => void load(), 5000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  // Погода по фактическому центру пасеки (среднее координат точек).
  // Эффект зависит от ЧИСЕЛ координат: пересчёт центра при каждом опросе
  // точек не вызывает перезапрос погоды, пока координаты не изменились.
  const center = useMemo<[number, number]>(
    () =>
      (points && points.length > 0 ? pointsCenter(points) : null) ?? DEFAULT_PLACE.center,
    [points],
  )
  const [wLat, wLon] = center
  useEffect(() => {
    let alive = true
    const sp = new URLSearchParams({ lat: String(wLat), lon: String(wLon), place: 'Моя пасека' })
    const load = async () => {
      try {
        const res = await fetch(`/api/weather?${sp.toString()}`, { cache: 'no-store' })
        if (!res.ok) return
        const j = (await res.json()) as WeatherResponse
        if (alive) setWeather(j)
      } catch {
        // агент честно скажет, если погоды нет
      }
    }
    void load()
    const timer = setInterval(() => void load(), 10 * 60 * 1000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [wLat, wLon])
  const agentWeather = useMemo(() => (weather ? weatherResponseToDays(weather) : null), [weather])

  const syncedHives = useMemo(() => (points ? pointsToHives(points) : null), [points])

  // выбранный улей всегда существует в синхронизированном наборе
  // (hiveId 0 — сводный вид «Вся пасека», его не сбрасываем)
  useEffect(() => {
    if (syncedHives && syncedHives.length > 0 && hiveId !== 0 && !syncedHives.some((h) => h.id === hiveId)) {
      setHive(syncedHives[0].id)
    }
  }, [syncedHives, hiveId, setHive])

  const headerNote =
    status === 'error' ? t('real.note.error') : syncedHives?.length === 0 ? t('real.note.unbound') : null

  if (status === 'idle' || status === 'loading') {
    return <DashboardSkeleton />
  }
  if (status === 'error') {
    return (
      <div className="space-y-5">
        <RealHeaderWithSwitcher note={t('real.note.error')} />
        <Card className="mx-auto max-w-lg border-red-100">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
            <h2 className="mt-2 font-bold text-gray-900">{t('real.error.title')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('real.error.text')}</p>
            <Button onClick={reload} className="mt-4 bg-red-600 hover:bg-red-700">
              {t('real.error.retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  // Схема и диаграммы — ТО ЖЕ точки, что на карте пасеки: один набор ульев
  // для карты, вкладки «Датчики» и дашборда. Из базы — журнал и площадки кочёвки.
  if (!points || !data || syncedHives === null) return <DashboardSkeleton />
  if (syncedHives.length === 0) {
    return (
      <div className="space-y-5">
        <RealHeaderWithSwitcher note={t('real.note.unbound')} />
        <EmptyMapState onOpenMap={() => setView('map')} />
      </div>
    )
  }
  return (
    <RealContent
      hives={syncedHives}
      points={points}
      sites={data.sites.map((s, i) => siteDtoToSite(s, i))}
      weather={agentWeather?.days ?? null}
      events={data.events}
      center={center}
      noiseSpark={noiseSpark}
      lang={lang}
    />
  )
}

function DashboardSkeleton() {
  const t = useT()
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <div className="h-96 animate-pulse rounded-2xl bg-red-50/70" />
      <div className="h-96 animate-pulse rounded-2xl bg-red-50/50" />
      <div className="h-96 animate-pulse rounded-2xl bg-red-50/40" />
      <p className="col-span-full text-center text-sm text-gray-400">{t('real.skeleton')}</p>
    </div>
  )
}

/** Шапка реального режима с переключателем «Демо / Мои данные» — чтобы вернуться
 *  в демо можно было с любого экрана (пустой база, ошибка, обычный дашборд). */
function RealHeaderWithSwitcher({ note }: { note: string }) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2A1A12] md:text-3xl">
          {t('real.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{note}</p>
      </div>
      <ModeSwitcher />
    </div>
  )
}

/** Карта пуста — диаграммам не с чего брать данные: честный экран-подсказка. */
function EmptyMapState({ onOpenMap }: { onOpenMap: () => void }) {
  const t = useT()
  return (
    <Card className="mx-auto max-w-lg border-dashed border-red-300 bg-red-50/40">
      <CardContent className="p-8 text-center">
        <MapPin className="mx-auto h-8 w-8 text-red-300" />
        <h2 className="mt-3 text-lg font-extrabold text-[#2A1A12]">{t('real.empty.title')}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500">{t('real.empty.text')}</p>
        <Button
          onClick={onOpenMap}
          className="mt-5 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
        >
          {t('real.empty.cta')}
        </Button>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Содержимое дашборда                                                 */
/* ------------------------------------------------------------------ */

interface ContentProps {
  hives: Hive[]
  /** Точки карты — параллельны hives (id = индекс + 1); живые показания датчиков. */
  points: MapPointDto[]
  sites: MigrationSite[]
  weather: WeatherDay[] | null
  events: EventDto[]
  /** Центр пасеки (среднее координат точек на карте) — для панели погоды. */
  center: [number, number]
  /** Буферы шума по точкам — живой спарклайн гула. */
  noiseSpark: Record<string, number[]>
  lang: 'ru' | 'en' | 'fr' | 'kk' | 'be' | 'zh'
}

function RealContent({ hives, points, sites, weather, events, center, noiseSpark, lang }: ContentProps) {
  const t = useT()
  const hiveId = useAppState((s) => s.hiveId)
  const setHive = useAppState((s) => s.setHive)
  const setView = useAppState((s) => s.setView)
  const ask = useAppState((s) => s.ask)
  const reminders = useAppState((s) => s.reminders)
  const { toast } = useToast()
  const [openFinding, setOpenFinding] = useState<string | null>(null)
  const [measureOpen, setMeasureOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  // версия хранилища замеров: мутации bump'ают счётчик и пересчитывают данные
  const [varroaV, setVarroaV] = useState(0)

  const isAll = hiveId === 0
  const hive = hives.find((x) => x.id === hiveId) ?? hives[0]

  /** Ключ хранилища замеров — стабильный id точки на карте. */
  const pointKeyOf = useCallback((h: Hive) => points[h.id - 1]?.id ?? `hive-${h.id}`, [points])

  /** Живое показание датчика точки (опрос каждые 5 с). */
  const sensorOf = useCallback((h: Hive) => points[h.id - 1]?.sensor, [points])

  const status = hiveStatus(hive, hives)
  const statuses = useMemo(() => hives.map((h) => ({ h, st: hiveStatus(h, hives) })), [hives])
  const riskyHive = statuses.find((x) => x.st.level === 'risk')
  const watchHive = statuses.find((x) => x.st.level === 'watch' && x.h.id !== riskyHive?.h.id)

  // семьи с телеметрией — источник средних значений для «Всей пасеки»
  const active = useMemo(
    () => hives.filter((h) => h.series.length > 0 && h.series[h.series.length - 1].weightKg !== null),
    [hives],
  )
  const mean = useCallback(
    (f: (h: Hive) => number | null): number | null => {
      const vals = active.map(f).filter((v): v is number => v !== null)
      if (vals.length === 0) return null
      return vals.reduce((s, v) => s + v, 0) / vals.length
    },
    [active],
  )
  const lastOf = useCallback(
    (h: Hive) => h.series[h.series.length - 1] ?? null,
    [],
  )

  // ── живые значения выбранного набора (улей / вся пасека) ──
  const lastTemp = isAll ? mean((h) => lastOf(h)?.tempInC ?? null) : lastOf(hive)?.tempInC ?? null
  const lastHum = isAll ? mean((h) => lastOf(h)?.humidityPct ?? null) : lastOf(hive)?.humidityPct ?? null
  // масса: для «Всей пасеки» — сумма весов семей с телеметрией (пасека целиком)
  const lastWeight = isAll
    ? (() => {
        const vals = active.map((h) => lastOf(h)?.weightKg ?? null).filter((v): v is number => v !== null)
        return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) * 10) / 10 : null
      })()
    : lastOf(hive)?.weightKg ?? null
  const noiseNow = isAll
    ? mean((h) => {
        const s = sensorOf(h)
        return s && s.on ? s.noiseDb : null
      })
    : (() => {
        const s = sensorOf(hive)
        return s && s.on ? s.noiseDb : null
      })()

  // ── привесы ──
  const d2 = isAll
    ? (() => {
        let s = 0
        let c = 0
        for (const h of active) {
          const v = weightDeltaSafe(h, 2)
          if (v !== null) {
            s += v
            c++
          }
        }
        return c > 0 ? Math.round(s * 10) / 10 : null
      })()
    : weightDeltaSafe(hive, 2)

  /** Итоговое изменение веса за период наблюдений. */
  const weightTotal = (h: Hive): number | null => {
    const w = h.series[h.series.length - 1]?.weightKg ?? null
    const first = h.series[0]?.weightKg ?? null
    if (w === null || first === null) return null
    return Math.round((w - first) * 10) / 10
  }
  const periodGain = isAll
    ? (() => {
        let s = 0
        let c = 0
        for (const h of active) {
          const v = weightTotal(h)
          if (v !== null) {
            s += v
            c++
          }
        }
        return c > 0 ? Math.round(s * 10) / 10 : null
      })()
    : weightTotal(hive)

  const leader = active.length > 0 ? bestHiveOf(active) : null
  const leaderGain = leader ? (weightDeltaSafe(leader, 30) ?? weightTotal(leader) ?? 0) : 0
  const progressPct =
    !isAll && leaderGain > 0 && periodGain !== null
      ? Math.min(100, Math.max(0, Math.round((periodGain / leaderGain) * 100)))
      : null

  // ── длительность наблюдений ──
  const periodDays = (() => {
    const s = isAll ? Math.max(0, ...hives.map((h) => h.series.length)) : hive.series.length
    if (s < 2) return null
    return s
  })()
  const periodLabel =
    periodDays === null
      ? t('real.passport.fewDays')
      : periodDays >= 25
        ? t('real.passport.month')
        : t('real.passport.days', { n: periodDays })

  // ── шкала состояния ──
  const gauge = isAll
    ? apiaryGauge(statuses.map((x) => x.st.level), hives.length)
    : apiaryGauge([status.level], 1)

  // ── заклещенность: ручные замеры (localStorage по точкам карты) ──
  const varroaRows = useMemo(() => {
    void varroaV
    return hives.map((h) => ({ h, key: pointKeyOf(h), state: varroaStateOf(pointKeyOf(h)) }))
  }, [hives, pointKeyOf, varroaV])
  const selVarroa = isAll ? null : varroaRows.find((x) => x.h.id === hive.id) ?? null
  const curVarroa = isAll
    ? (() => {
        const ps = varroaRows.map((x) => x.state.pct).filter((v): v is number => v !== null)
        return ps.length ? Math.round((ps.reduce((s, v) => s + v, 0) / ps.length) * 10) / 10 : null
      })()
    : selVarroa?.state.pct ?? null
  const curVarroaForecast = isAll
    ? (() => {
        const ps = varroaRows.map((x) => x.state.forecast14).filter((v): v is number => v !== null)
        return ps.length ? Math.round((ps.reduce((s, v) => s + v, 0) / ps.length) * 10) / 10 : null
      })()
    : selVarroa?.state.forecast14 ?? null
  const varroaSt = curVarroa !== null ? varroaStatus(curVarroa) : null
  const varroaStatusLabel = varroaSt ? t(`dash.varroa.status.${varroaSt.level}`) : ''
  const varroaSeries = isAll ? [] : varroaSeriesOf(pointKeyOf(hive))

  // самый проблемный по клещу улей — для предписания в сводном виде
  const worstVarroa = (() => {
    const rows = varroaRows.filter((x) => x.state.pct !== null)
    if (rows.length === 0) return null
    return rows.sort((a, b) => (b.state.pct ?? 0) - (a.state.pct ?? 0))[0]
  })()
  const varroaTargetHive = !isAll ? hive : worstVarroa?.h ?? null

  /** Провести обработку: заклещенность падает до 0,4 % (честный сценарий
   *  «замер после обработки» — пчеловод вносит контрольный замер). */
  const treatNow = () => {
    const target = varroaTargetHive ?? hive
    const key = pointKeyOf(target)
    const before = varroaStateOf(key).pct ?? 0
    markVarroaTreated(key, 0.4)
    setVarroaV((v) => v + 1)
    toast({
      title: t('real.varroa.action'),
      description: t('real.varroa.treatToast', { a: fmtNum(before), b: fmtNum(0.4) }),
    })
  }

  const saveMeasure = (pct: number, mites: number, bees: number) => {
    addVarroaMeasure(pointKeyOf(hive), { pct, mites, bees })
    setVarroaV((v) => v + 1)
    const st = varroaStatus(pct)
    toast({
      title: t('dash.measure.saved'),
      description: t('real.varroa.measureToast', {
        p: fmtNum(pct, 1),
        status: t(`dash.varroa.status.${st.level}`),
      }),
    })
  }

  // ── предписания агента: базовые + живое предписание по заклещенности ──
  const ctx: AgentContext = makeContext(hives, { weather, sites, apiaryName: 'Моя пасека' })
  const baseFindings = findingsFor(hive.id, ctx)
  // Предписание по заклещенности появляется только в «желтой» и «красной» зонах:
  // после обработки (норма) цикл замкнут — предписание исчезает.
  const varroaFinding: AgentFinding | null =
    varroaSt && varroaSt.level !== 'ok' && curVarroa !== null && varroaTargetHive
      ? {
          id: 'varroa-live',
          scenario: 'care',
          hiveId: varroaTargetHive.id,
          title: t(
            varroaSt.level === 'crit' ? 'real.varroa.f1.title' : 'real.varroa.f2.title',
            { p: fmtNum(curVarroa) },
          ),
          text: t(varroaSt.level === 'crit' ? 'real.varroa.f1.text' : 'real.varroa.f2.text'),
          basis: [
            selVarroa?.state.last
              ? t('real.varroa.basisMeasure', { d: selVarroa.state.last.date })
              : t('real.varroa.basisMeasure', { d: worstVarroa?.state.last?.date ?? '' }),
            t('real.varroa.basisThreshold'),
          ],
          urgency: varroaSt.level === 'crit' ? 'act-now' : 'today',
          urgencyNote: t('real.varroa.urgencyNote'),
          metrics: [
            { label: 'Varroa', value: `${fmtNum(curVarroa)} %` },
            { label: t('real.varroa.basisThreshold'), value: '> 3 %' },
          ],
          prefill: t('real.varroa.prefill', { n: varroaTargetHive.id, p: fmtNum(curVarroa) }),
        }
      : null
  const findings = (() => {
    const rank: Record<Urgency, number> = { 'act-now': 0, today: 1, 'this-week': 2, ok: 3 }
    return [...(varroaFinding ? [varroaFinding] : []), ...baseFindings].sort(
      (a, b) => rank[a.urgency] - rank[b.urgency],
    )
  })()

  // ── серии для графиков (улей или среднее по пасеке) ──
  const climate14 = (() => {
    const src = isAll ? active : [hive]
    const lens = src.map((h) => h.series.length).filter((n) => n > 0)
    if (lens.length === 0) return []
    const n = Math.min(14, Math.min(...lens))
    const out: Array<{ label: string; tempInC: number | null; humidityPct: number | null }> = []
    for (let k = n; k >= 1; k--) {
      let tS = 0
      let tC = 0
      let hS = 0
      let hC = 0
      let label = ''
      for (const h of src) {
        const p = h.series[h.series.length - k]
        if (!p) continue
        if (!label) label = p.label
        if (p.tempInC !== null) {
          tS += p.tempInC
          tC++
        }
        if (p.humidityPct !== null) {
          hS += p.humidityPct
          hC++
        }
      }
      out.push({
        label,
        tempInC: tC ? Math.round((tS / tC) * 10) / 10 : null,
        humidityPct: hC ? Math.round(hS / hC) : null,
      })
    }
    return out
  })()

  const weight14 = (() => {
    const src = isAll ? active : [hive]
    const lens = src.map((h) => h.series.length).filter((n) => n > 0)
    if (lens.length === 0) return []
    const n = Math.min(14, Math.min(...lens))
    const out: Array<{ label: string; weightKg: number | null }> = []
    for (let k = n; k >= 1; k--) {
      let s = 0
      let c = 0
      let label = ''
      for (const h of src) {
        const p = h.series[h.series.length - k]
        if (!p) continue
        if (!label) label = p.label
        if (p.weightKg !== null) {
          s += p.weightKg
          c++
        }
      }
      out.push({ label, weightKg: c ? Math.round((s / c) * 10) / 10 : null })
    }
    return out
  })()

  const gain7 = (() => {
    const src = isAll ? active.filter((h) => h.series.length > 1) : hive.series.length > 1 ? [hive] : []
    if (src.length === 0) return []
    const out: GainPoint[] = []
    for (let back = 6; back >= 0; back--) {
      let gS = 0
      let gC = 0
      let tS = 0
      let tC = 0
      let label = ''
      for (const h of src) {
        const i = h.series.length - 1 - back
        if (i < 1) continue
        const cur = h.series[i]
        const prev = h.series[i - 1]
        if (cur.weightKg === null || prev.weightKg === null) continue
        gS += cur.weightKg - prev.weightKg
        gC++
        if (cur.tempInC !== null) {
          tS += cur.tempInC
          tC++
        } else if (prev.tempInC !== null) {
          tS += prev.tempInC
          tC++
        }
        if (!label) label = cur.label
      }
      if (gC > 0) {
        out.push({
          label,
          gainKg: Math.round((gS / gC) * 100) / 100,
          nightTempC: tC ? Math.round((tS / tC) * 10) / 10 : 35.0,
        })
      }
    }
    return out
  })()

  // живой спарклайн шума выбранного улья (или средний по пасеке)
  const spark = (() => {
    if (isAll) {
      const arrs = active.map((h) => noiseSpark[pointKeyOf(h)] ?? []).filter((a) => a.length > 0)
      if (arrs.length === 0) return []
      const len = Math.min(...arrs.map((a) => a.length))
      return Array.from({ length: len }, (_, i) =>
        arrs.reduce((s, a) => s + a[a.length - len + i], 0) / arrs.length,
      )
    }
    return noiseSpark[pointKeyOf(hive)] ?? []
  })()

  // последнее обновление датчиков выбранного набора
  const updatedAt = (() => {
    const sensors = isAll ? points.map((p) => p.sensor) : [sensorOf(hive)].filter(Boolean)
    const times = sensors
      .map((s) => (s && s.on ? s.updatedAt : null))
      .filter((v): v is string => Boolean(v))
    if (times.length === 0) return null
    return [...times].sort()[times.length - 1]
  })()

  const upcomingReminders = useMemo(
    () =>
      reminders
        .filter((r) => !r.done)
        .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
        .slice(0, 3),
    [reminders],
  )

  const todayLabel = format(new Date(), 'EEEE, d MMMM yyyy', { locale: LANG_DATE_LOCALE[lang] })

  // ── статус-баннер выбранного набора ──
  const bannerStatus = isAll ? (riskyHive?.st ?? watchHive?.st ?? status) : status
  const bannerText = isAll
    ? riskyHive
      ? t('real.banner.risk.text', {
          n: riskyHive.h.id,
          w: fmtSigned(weightDeltaSafe(riskyHive.h, 2) ?? 0),
        })
      : watchHive
        ? t('real.banner.watch', { n: watchHive.h.id, label: watchHive.st.label.toLowerCase() })
        : t('real.banner.ok')
    : status.level === 'risk'
      ? t('real.banner.risk.text', { n: hive.id, w: fmtSigned(d2 ?? 0) })
      : status.level === 'watch'
        ? t('real.banner.watch', { n: hive.id, label: status.label.toLowerCase() })
        : hive.familyNote

  return (
    <div className="space-y-4">
      {/* ── Баннер срочности по данным датчиков ── */}
      <Rise delay={0}>
        {riskyHive ? (
          <div className="hazard-stripes animate-sheen relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#D93E00] to-[#FF5A1F] p-4 text-white shadow-lg md:p-4.5">
            <TrendingUp className="absolute -right-3 -top-3 h-28 w-28 rotate-12 text-white/15" />
            <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="animate-heartbeat mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <p className="text-[13px] font-extrabold uppercase tracking-wide text-white/95">
                    {t('real.banner.risk.badge')}
                  </p>
                  <p className="mt-1 max-w-3xl text-sm leading-snug">
                    {t('real.banner.risk.text', {
                      n: riskyHive.h.id,
                      w: fmtSigned(weightDeltaSafe(riskyHive.h, 2) ?? 0),
                    })}
                  </p>
                </div>
              </div>
              <Button
                className="w-fit shrink-0 bg-white font-bold text-red-700 hover:bg-red-50"
                onClick={() => ask(`Что происходит с ульем №${riskyHive.h.id}?`)}
              >
                {t('real.banner.cta')} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : watchHive ? (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-sm">
              {t('real.banner.watch', { n: watchHive.h.id, label: watchHive.st.label.toLowerCase() })}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
            <Sun className="h-5 w-5 shrink-0 text-emerald-500" />
            <p className="text-sm">{t('real.banner.ok')}</p>
          </div>
        )}
      </Rise>

      {/* ── Заголовок + погодный чип + режим ── */}
      <Rise delay={0.05}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#2A1A12] md:text-3xl">{t('real.title')}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-red-500" />
                {`${hives.length} ${hiveWord(hives.length)} · ${t('real.state.sensorsOn')}`}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-red-500" /> {todayLabel}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WeatherChip coords={center} place="Моя пасека" />
            <ModeSwitcher />
          </div>
        </div>
      </Rise>

      {/* ── Лента-переключатель ульев ── */}
      <Rise delay={0.1}>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('real.ribbon.aria')}>
          <button
            onClick={() => setHive(0)}
            aria-pressed={isAll}
            className={cn(
              'pop-in inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
              isAll
                ? 'border-red-500 bg-red-50/80 text-red-700 ring-2 ring-red-500/60'
                : 'border-red-100 bg-white text-gray-600 hover:border-red-200',
            )}
          >
            <Hexagon className="h-4 w-4 text-red-500" />
            {t('dash.hivesAll')}
            <span className="text-xs font-extrabold text-red-600">
              {active.length}/{hives.length}
            </span>
          </button>
          {hives.map((h) => {
            const st = hiveStatus(h, hives)
            const dd = weightDeltaSafe(h, 2)
            return (
              <button
                key={h.id}
                onClick={() => setHive(h.id)}
                aria-pressed={h.id === hive.id}
                className={cn(
                  'pop-in inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                  h.id === hive.id
                    ? 'border-red-500 bg-red-50/80 text-red-700 ring-2 ring-red-500/60'
                    : 'border-red-100 bg-white text-gray-600 hover:border-red-200',
                )}
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_STYLES[st.level].dot)} />
                {h.label.replace('Улей №', '№')}
                <span className="text-xs font-extrabold text-red-600">
                  {dd !== null ? fmtSigned(dd) : '—'}
                </span>
              </button>
            )
          })}
          <button
            onClick={() => setView('sensors')}
            title={t('dash.addHive')}
            className="pop-in inline-flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-red-300 text-red-500 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Rise>

      {/* ── БЛОК 1: шкала + паспорт + статус-баннер + живые плитки ── */}
      <Rise delay={0.12}>
        <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
          <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
            {/* Шкала состояния */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-red-50 bg-red-50/30 p-3 dark:bg-[#2C211C]">
              <StatusGauge info={gauge} />
              <p className="mt-2 text-center text-[11px] font-semibold text-gray-400">
                {t('dash.gauge.label')}
              </p>
            </div>

            <div className="min-w-0">
              {/* Паспорт */}
              <p className="text-sm font-extrabold uppercase tracking-wide text-gray-500">
                {isAll ? t('dash.passport.all') : t('real.passport.title')}
              </p>
              <p className="mt-1 text-base font-extrabold text-[#2A1A12] md:text-lg">
                {isAll ? (
                  <>
                    {t('dash.hivesAll')} ({hives.length} {hiveWord(hives.length)})
                  </>
                ) : (
                  <>
                    {hive.label} <span className="font-bold text-gray-500">· {hive.familyNote}</span>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {t('real.passport.period')}: {periodLabel}
              </p>

              {/* Статус-баннер выбранного улья */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${hive.id}-${bannerStatus.level}`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    'animate-sheen relative mt-3 overflow-hidden rounded-2xl p-4 text-white shadow-lg',
                    HIVE_BANNER[bannerStatus.level],
                  )}
                >
                  <span className="absolute -right-3 -top-3 h-24 w-24 rotate-12">
                    {bannerStatus.level === 'ok' ? (
                      <Sun className="h-24 w-24 text-white/15" />
                    ) : (
                      <AlertTriangle className="h-24 w-24 text-white/15" />
                    )}
                  </span>
                  <div className="relative flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      {bannerStatus.level === 'ok' ? (
                        <Sun className="mt-0.5 h-6 w-6 shrink-0" />
                      ) : (
                        <AlertTriangle className="animate-heartbeat mt-0.5 h-6 w-6 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-white/90">
                          {bannerStatus.label}
                        </p>
                        <p className="mt-1 max-w-2xl text-sm leading-snug">{bannerText}</p>
                      </div>
                    </div>
                    {bannerStatus.level !== 'ok' && (
                      <Button
                        className="w-fit shrink-0 bg-white font-semibold text-red-700 hover:bg-red-50"
                        onClick={() => ask(`Что происходит с ульем №${(isAll ? riskyHive?.h.id : hive.id) ?? hive.id}?`)}
                      >
                        <Bug className="h-4 w-4" /> {t('real.banner.cta')}
                      </Button>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Живые плитки показателей */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
              <TrendingUp className="h-4 w-4 text-red-500" /> {t('real.state.title')}
            </h2>
            <span
              title={t('real.liveHint')}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
            >
              <span className="live-dot h-2 w-2 rounded-full bg-emerald-500" />
              {t('dash.liveBadge')}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
            <LiveTile
              icon={<Thermometer className="h-3.5 w-3.5" />}
              label={t('real.tiles.temp')}
              num={lastTemp ?? undefined}
              value={lastTemp === null ? '—' : undefined}
              suffix="°C"
              hint={isAll ? t('real.tiles.avg', { n: active.length }) : t('real.hint.hiveN', { n: hive.id })}
            />
            <LiveTile
              icon={<Droplets className="h-3.5 w-3.5" />}
              label={t('real.tiles.hum')}
              num={lastHum ?? undefined}
              value={lastHum === null ? '—' : undefined}
              digits={0}
              suffix="%"
              hint={t('real.charts.humOk')}
            />
            <LiveTile
              icon={<Scale className="h-3.5 w-3.5" />}
              label={t('real.tiles.mass')}
              num={lastWeight ?? undefined}
              value={lastWeight === null ? '—' : undefined}
              suffix={t('real.micro.unit')}
              hint={isAll ? t('real.tiles.sum', { n: active.length }) : t('real.mass.now')}
            />
            <LiveTile
              icon={<AudioLines className="h-3.5 w-3.5" />}
              label={t('real.tiles.sound')}
              num={noiseNow ?? undefined}
              value={noiseNow === null ? '—' : undefined}
              digits={0}
              suffix="дБ"
              hint={t('real.tiles.soundHint')}
            />
            <LiveTile
              icon={<Bug className="h-3.5 w-3.5" />}
              label={t('dash.tiles.varroa')}
              num={curVarroa ?? undefined}
              value={curVarroa === null ? '—' : undefined}
              digits={1}
              suffix="%"
              tone={varroaSt ? (varroaSt.level === 'crit' ? 'red' : varroaSt.level === 'risk' ? 'amber' : 'emerald') : 'red'}
              hint={
                curVarroa === null
                  ? t('real.varroa.tileNone')
                  : t('dash.tiles.varroaHint', {
                      status: varroaStatusLabel,
                      p: curVarroaForecast !== null ? fmtNum(curVarroaForecast) : '—',
                    })
              }
              badge={
                varroaSt ? (
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-extrabold', varroaSt.cls)}>
                    {varroaStatusLabel}
                  </span>
                ) : undefined
              }
            />
            <LiveTile
              icon={<Activity className="h-3.5 w-3.5" />}
              label={t('real.tiles.sensors')}
              num={active.length}
              digits={0}
              suffix={`/ ${hives.length}`}
              hint={t('real.state.telemetry', { n: active.length, m: hives.length })}
            />
            <LiveTile
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label={t('real.passport.period')}
              num={periodDays ?? undefined}
              value={periodDays === null ? '—' : undefined}
              digits={0}
              hint={periodDays === null ? t('real.passport.fewDays') : t('real.passport.days', { n: periodDays })}
            />
          </div>
        </section>
      </Rise>

      {/* ── БЛОК 2: привес за 2 дня | накоплено за период ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Rise delay={0.05} className="h-full">
          <section className="flex h-full flex-col rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('real.gain2.title')}</h2>
            <p className="mt-2 flex items-center gap-2 text-5xl font-extrabold leading-none text-[#2A1A12]">
              {d2 !== null ? (
                <AnimatedNumber value={d2} digits={1} className={d2 < 0 ? 'text-red-600' : 'text-emerald-600'} />
              ) : (
                <span className="text-gray-300">—</span>
              )}
              <span className="text-xl font-bold text-gray-400">{t('real.micro.unit')}</span>
              <ArrowUpRight
                className={cn('h-8 w-8', (d2 ?? 0) >= 0.15 ? 'text-emerald-500' : 'text-amber-500')}
              />
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-600">
              {d2 !== null ? t('dash.gain.pure', { n: fmtNum(Math.round(d2 * 0.75 * 100) / 100, 1) }) : t('real.mass.noData')}
            </p>
            <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
              <div className="rounded-xl bg-red-50 px-3 py-2 dark:bg-[#2C211C]">
                <p className="text-[10px] font-semibold text-gray-400">{t('real.mass.title')}</p>
                <p className="text-sm font-extrabold text-sky-600">
                  {lastWeight !== null ? `${fmtNum(lastWeight)} ${t('real.micro.unit')}` : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-red-50 px-3 py-2 dark:bg-[#2C211C]">
                <p className="text-[10px] font-semibold text-gray-400">
                  {leader ? t('real.tiles.leader', { n: leader.id }) : t('real.leader.noTele')}
                </p>
                <p className="text-sm font-extrabold text-gray-700">
                  {leader ? `${fmtSigned(leaderGain)} ${t('real.micro.unit')}` : '—'}
                </p>
              </div>
            </div>
          </section>
        </Rise>

        <Rise delay={0.1} className="h-full">
          <section className="flex h-full flex-col rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('real.season.title')}</h2>
            <p className="mt-2 flex items-center gap-2 text-5xl font-extrabold leading-none text-[#2A1A12]">
              {periodGain !== null ? (
                <AnimatedNumber value={periodGain} digits={1} className={periodGain < 0 ? 'text-red-600' : undefined} />
              ) : (
                <span className="text-gray-300">—</span>
              )}
              <span className="text-xl font-bold text-gray-400">{t('real.micro.unit')}</span>
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-600">
              {t('real.gain.note')}
            </p>
            <div className="mt-auto pt-3">
              {progressPct !== null && (
                <>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                    <span>{t('real.season.progress')}</span>
                    <span className="text-red-600">{progressPct}%</span>
                  </div>
                  <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-red-50 dark:bg-[#2C211C]">
                    <motion.div
                      className="bar-shine h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                </>
              )}
              <p className="mt-1.5 text-[11px] text-gray-400">
                {leader
                  ? t('real.gain.leaderNote', { n: leader.id, w: fmtSigned(leaderGain) })
                  : t('real.leader.noTele')}
              </p>
            </div>
          </section>
        </Rise>
      </div>

      {/* ── БЛОК 3: график привесов за 7 дней ── */}
      <Rise delay={0.1}>
        <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
              <Scale className="h-4 w-4 text-red-500" /> {t('dash.chart.gain7')}
            </h3>
            {isAll && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50/60 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                {t('real.tiles.avg', { n: active.length })}
              </span>
            )}
          </div>
          <div className="mt-2">
            {gain7.length > 0 ? (
              <GainComboChart
                data={gain7}
                gainLabel={t('dash.chart.gain7.gain')}
                tempLabel={t('real.chart.gainTemp')}
              />
            ) : (
              <div className="flex h-[210px] items-center justify-center text-sm text-gray-400">
                {t('real.mass.noData')}
              </div>
            )}
          </div>
          {gain7.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-full bg-gradient-to-t from-amber-300 to-orange-500" />
                {t('dash.chart.gain7.gain')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-red-500" />
                {t('real.chart.gainTemp')}
              </span>
              <span className="ml-auto text-[11px] text-gray-400">
                {isAll ? t('real.tiles.avg', { n: active.length }) : t('real.hint.hiveN', { n: hive.id })}
              </span>
            </div>
          )}
          <p className="mt-1 text-[11px] leading-snug text-gray-400">{t('real.chart.gainNote')}</p>
        </section>
      </Rise>

      {/* ── Ряд из 3 графиков: температура | влажность | масса ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Rise delay={0.05} className="h-full">
          <MiniCard
            title={t('real.charts.temp')}
            icon={<Thermometer className="h-4 w-4" />}
            value={lastTemp !== null ? `${fmtNum(lastTemp)} °C` : '—'}
            note={t('real.charts.tempNote')}
          >
            {climate14.some((p) => p.tempInC !== null) ? (
              <DemoClimateMini data={climate14} metric="tempInC" />
            ) : (
              <ChartEmpty />
            )}
          </MiniCard>
        </Rise>
        <Rise delay={0.1} className="h-full">
          <MiniCard
            title={t('real.charts.hum')}
            icon={<Droplets className="h-4 w-4" />}
            value={lastHum !== null ? `${fmtNum(lastHum, 0)} %` : '—'}
            note={hive.humiditySensorOk || (isAll && active.length > 0) ? t('real.charts.humOk') : t('real.charts.humOffline')}
          >
            {climate14.some((p) => p.humidityPct !== null) ? (
              <DemoClimateMini data={climate14} metric="humidityPct" />
            ) : (
              <ChartEmpty />
            )}
          </MiniCard>
        </Rise>
        <Rise delay={0.15} className="h-full md:col-span-2 xl:col-span-1">
          <MiniCard
            title={t('real.charts.weight')}
            icon={<Scale className="h-4 w-4" />}
            value={lastWeight !== null ? `${fmtNum(lastWeight)} ${t('real.micro.unit')}` : '—'}
            note={d2 !== null ? t('real.mass.delta', { w: fmtSigned(d2) }) : t('real.mass.noData')}
          >
            {weight14.some((p) => p.weightKg !== null) ? (
              <DemoWeightBars data={weight14} />
            ) : (
              <ChartEmpty />
            )}
          </MiniCard>
        </Rise>
      </div>

      {/* ── БЛОК 4: микроклимат гнезда | заклещёванность ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Rise delay={0.05} className="h-full">
          <section className="flex h-full flex-col rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
              <Thermometer className="h-4 w-4 text-red-500" /> {t('real.micro.title')}
            </h2>
            <ul className="mt-3 space-y-2.5">
              <li className="flex items-center justify-between gap-3 rounded-xl bg-red-50/60 px-3 py-2.5 dark:bg-[#2C211C]">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Thermometer className="h-4 w-4 text-red-400" /> {t('real.micro.temp')}
                </span>
                <span className="text-base font-extrabold text-[#2A1A12]">
                  {lastTemp !== null ? <AnimatedNumber value={lastTemp} /> : '—'} °C
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-bold',
                    lastTemp !== null && lastTemp >= 34 && lastTemp <= 36
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700',
                  )}
                >
                  {lastTemp !== null && lastTemp >= 34 && lastTemp <= 36
                    ? t('real.micro.tempOk')
                    : t('real.micro.tempOff')}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-xl bg-red-50/60 px-3 py-2.5 dark:bg-[#2C211C]">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Droplets className="h-4 w-4 text-red-400" /> {t('real.micro.hum')}
                </span>
                <span className="text-base font-extrabold text-[#2A1A12]">
                  {lastHum !== null ? <AnimatedNumber value={lastHum} digits={0} /> : '—'} %
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-bold',
                    hive.humiditySensorOk || (isAll && active.length > 0)
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700',
                  )}
                >
                  {hive.humiditySensorOk || (isAll && active.length > 0)
                    ? t('real.micro.humOk')
                    : t('real.charts.humOffline')}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-xl bg-red-50/60 px-3 py-2.5 dark:bg-[#2C211C]">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <AudioLines className="h-4 w-4 text-red-400" /> {t('real.micro.acousticsDb')}
                </span>
                {spark.length > 1 && (
                  <span className="w-24 shrink-0">
                    <AcousticSpark data={spark} />
                  </span>
                )}
                <span className="text-base font-extrabold text-[#2A1A12]">
                  {noiseNow !== null ? <AnimatedNumber value={noiseNow} digits={0} /> : '—'} дБ
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-bold',
                    noiseNow !== null && noiseNow >= 38 && noiseNow <= 55
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700',
                  )}
                >
                  {noiseNow !== null ? t('real.micro.noiseOk') : t('real.micro.tempOff')}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-xl bg-red-50/60 px-3 py-2.5 dark:bg-[#2C211C]">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Activity className="h-4 w-4 text-red-400" /> {t('real.micro.updated')}
                </span>
                <span className="text-[13px] font-bold text-[#2A1A12]">
                  {updatedAt ? format(new Date(updatedAt), 'HH:mm:ss') : '—'}
                </span>
              </li>
            </ul>
            <p className="mt-auto pt-2.5 text-[11px] leading-relaxed text-gray-400">{t('real.micro.note')}</p>
          </section>
        </Rise>

        <Rise delay={0.1} className="h-full">
          <VarroaCard
            isAll={isAll}
            hiveLabel={hive.label}
            pct={curVarroa}
            forecast={curVarroaForecast}
            status={varroaSt}
            statusLabel={varroaStatusLabel}
            state={selVarroa?.state ?? null}
            series={varroaSeries}
            rows={varroaRows}
            canMeasure={!isAll}
            onOpenMeasure={() => setMeasureOpen(true)}
            onSelectHive={(id) => setHive(id)}
          />
        </Rise>
      </div>

      {/* ── Погода на пасеке | сводка ульев и лидер ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Rise delay={0.05}>
          <WeatherPanel coords={center} place="Моя пасека" />
        </Rise>
        <Rise delay={0.1}>
          <div className="space-y-4">
            <HiveSummaryCard
              rows={statuses.map((x) => ({
                id: x.h.id,
                label: x.h.label,
                level: x.st.level,
                statusLabel: x.st.label,
                gain: weightDeltaSafe(x.h, 2),
              }))}
              currentId={hive.id}
              onSelect={(id) => setHive(id)}
            />
            {leader && (
              <LeaderCard
                id={leader.id}
                label={leader.label}
                gain={leaderGain}
                mass={lastOf(leader)?.weightKg ?? null}
                onSelect={() => setHive(leader.id)}
              />
            )}
          </div>
        </Rise>
      </div>

      {/* ── БЛОК 5: предписания агента | напоминания и журнал ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Rise delay={0.05}>
          <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
                <MessageSquareText className="h-4 w-4 text-red-500" /> {t('real.agent.title')}
              </h2>
              <span className="text-[11px] text-gray-400">
                {isAll ? t('dash.hivesAll').toLowerCase() : t('real.agent.context', { n: hive.id })}
              </span>
            </div>

            {/* Вечерний отчет — собран из реальных данных датчиков */}
            <Button
              variant="outline"
              onClick={() => setReportOpen(true)}
              className="mt-3 w-full gap-2 border-red-200 font-bold text-red-700 hover:bg-red-50 hover:text-red-700"
            >
              <ClipboardList className="h-4 w-4" /> {t('dash.agent.evening')}
            </Button>

            <ol className="mt-3 space-y-2">
              {findings.map((f, i) => {
                const open = openFinding === f.id
                const isVarroa = f.id === 'varroa-live'
                return (
                  <li
                    key={f.id}
                    className={cn(
                      'rise-in overflow-hidden rounded-xl border transition-shadow',
                      f.urgency === 'act-now'
                        ? 'border-red-200 hover:shadow-md hover:shadow-red-100'
                        : 'border-red-100 hover:shadow-md hover:shadow-red-50',
                      open && 'border-red-200 bg-red-50/40',
                    )}
                  >
                    <button
                      onClick={() => setOpenFinding(open ? null : f.id)}
                      aria-expanded={open}
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold',
                          f.urgency === 'act-now' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700',
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {(isAll || (f.hiveId !== null && f.hiveId !== hive.id)) && f.hiveId !== null && (
                            <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                              №{f.hiveId}
                            </span>
                          )}
                          <span className="text-[13px] font-bold leading-snug text-gray-800">{f.title}</span>
                        </span>
                        {!open && (
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-gray-500">
                            {f.text}
                          </span>
                        )}
                      </span>
                      <ArrowRight
                        className={cn(
                          'mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform',
                          open && 'rotate-90',
                        )}
                      />
                    </button>
                    {open && (
                      <div className="rise-in border-t border-red-100 px-3 pb-3 pt-2">
                        <p className="text-[13px] leading-relaxed text-gray-600">{f.text}</p>
                        {f.metrics.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {f.metrics.map((m) => (
                              <span
                                key={m.label}
                                className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                              >
                                {m.label}: <b>{m.value}</b>
                              </span>
                            ))}
                          </div>
                        )}
                        {f.basis.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {f.basis.map((b) => (
                              <span key={b} className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700">
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                          <UrgencyBadge urgency={f.urgency} note={f.urgencyNote ?? ''} />
                          <div className="ml-auto flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => ask(f.prefill)}
                            >
                              {t('real.agent.discuss')} <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {/* Кнопка действия для предписания по заклещенности */}
                        {isVarroa && varroaSt && (
                          <div className="mt-2 border-t border-red-50 pt-2">
                            <Button
                              size="sm"
                              onClick={treatNow}
                              className="w-full gap-1.5 bg-gradient-to-r from-red-600 to-orange-500 font-bold shadow-md shadow-red-100 hover:from-red-700 hover:to-orange-600"
                            >
                              <Wrench className="h-3.5 w-3.5" /> {t('real.varroa.action')}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
            <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{t('real.agent.note')}</p>
          </section>
        </Rise>

        <Rise delay={0.1}>
          <div className="space-y-4">
            {/* Напоминания */}
            <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
                  <AlarmClock className="h-4 w-4 text-red-500" /> {t('real.events.title')}
                </h2>
                <button
                  onClick={() => setView('reminders')}
                  className="text-[11px] font-bold text-red-600 hover:text-red-700"
                >
                  {t('real.events.all')}
                </button>
              </div>

              {upcomingReminders.length === 0 ? (
                <p className="mt-2 text-sm text-gray-400">{t('real.events.empty')}</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {upcomingReminders.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-2.5 rounded-xl bg-red-50/50 px-3 py-2 dark:bg-[#2C211C]"
                    >
                      <AlarmClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug text-gray-800">{r.text}</p>
                        <p className="text-[11px] text-gray-400">{whenLabelShort(r.remindAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-4 flex items-center gap-1.5 text-xs font-bold text-gray-500">
                <ClipboardList className="h-3.5 w-3.5" /> {t('real.journal.title')}
              </h3>
              {events.length === 0 ? (
                <p className="mt-1.5 text-sm text-gray-400">{t('real.journal.empty')}</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {events.slice(0, 3).map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-red-50 px-3 py-2 text-[13px]"
                    >
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                        {e.type}
                      </span>
                      <span className="font-semibold text-gray-700">{e.hiveName}</span>
                      <span className="text-gray-500">{e.note}</span>
                      <span className="ml-auto text-[11px] text-gray-400">
                        {format(new Date(e.ts), 'd MMM, HH:mm', { locale: LANG_DATE_LOCALE[lang] })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </Rise>
      </div>

      {/* Диалоги: замер заклещенности + вечерний отчет */}
      <MeasureDialog
        open={measureOpen}
        onOpenChange={setMeasureOpen}
        hiveName={hive.label}
        onSave={saveMeasure}
      />
      <RealReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        hives={hives}
        weather={weather}
        lang={lang}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Вспомогательные блоки                                               */
/* ------------------------------------------------------------------ */

/** Пустой график — честная подсказка вместо выдуманных данных. */
function ChartEmpty() {
  const t = useT()
  return (
    <div className="flex h-full items-center justify-center">
      <p className="rounded-xl border border-dashed border-red-200 bg-red-50/40 px-4 py-3 text-center text-xs text-gray-400">
        {t('real.mass.noData')}
      </p>
    </div>
  )
}

/**
 * Карточка заклещенности (замкнутый цикл Varroa): текущее значение по
 * ручным замерам, прогноз +14 дней, история, кнопка «Внести замер».
 * В сводном виде «Вся пасека» — среднее + список семей с их статусами.
 */
function VarroaCard({
  isAll,
  hiveLabel,
  pct,
  forecast,
  status,
  statusLabel,
  state,
  series,
  rows,
  canMeasure,
  onOpenMeasure,
  onSelectHive,
}: {
  isAll: boolean
  hiveLabel: string
  pct: number | null
  forecast: number | null
  status: ReturnType<typeof varroaStatus> | null
  statusLabel: string
  state: VarroaState | null
  series: ReturnType<typeof varroaSeriesOf>
  rows: Array<{ h: Hive; key: string; state: VarroaState }>
  canMeasure: boolean
  onOpenMeasure: () => void
  onSelectHive: (id: number) => void
}) {
  const t = useT()
  const em = status ? (status.level === 'crit' ? '🔴' : status.level === 'risk' ? '🟡' : '🟢') : '⚪'
  return (
    <section className="flex h-full flex-col rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
          <Bug className="h-4 w-4 text-red-500" /> {t('dash.varroacard.title')}
        </h2>
        {status && (
          <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-extrabold', status.cls)}>
            {em} {statusLabel}
          </span>
        )}
      </div>

      {pct === null ? (
        /* Замеров не было — честная подсказка вместо выдуманных чисел */
        <div className="mt-3 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-6 text-center">
          <Bug className="h-7 w-7 text-red-200" />
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-gray-500">{t('real.varroa.noData')}</p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-4xl font-extrabold leading-none text-[#2A1A12]">
            <AnimatedNumber value={pct} digits={1} />
            <span className="ml-1 text-sm font-bold text-gray-400">%</span>
            <span className="ml-3 align-middle text-xs font-bold text-red-500">
              {forecast !== null
                ? t('dash.varroa.forecast', { p: fmtNum(forecast) })
                : t('real.varroa.noTrend')}
            </span>
          </p>
          {state?.last && (
            <div className="mt-3 space-y-1.5 text-xs text-gray-600">
              <p className="flex items-center justify-between gap-2">
                <span>
                  {state.treatedLast
                    ? t('real.varroa.treated', { p: fmtNum(state.pct ?? pct) })
                    : t('real.varroa.last', {
                        n: state.last.mites,
                        b: state.last.bees,
                        d: state.last.date,
                      })}
                </span>
                <span className="font-bold text-gray-700">📋</span>
              </p>
            </div>
          )}
        </>
      )}

      {/* Динамика по замерам */}
      {!isAll && series.length > 0 && (
        <div className="mt-2 h-[150px]">
          <VarroaMiniChart data={series} />
        </div>
      )}

      {/* Сводный вид: статус каждой семьи с замерами */}
      {isAll && (
        <ul className="mt-3 space-y-1.5">
          {rows
            .filter((r) => r.state.pct !== null)
            .map((r) => {
              const st = r.state.status
              return (
                <li key={r.key}>
                  <button
                    onClick={() => onSelectHive(r.h.id)}
                    className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-red-50 px-3 py-2 text-[13px] transition-colors hover:bg-red-50/60"
                  >
                    <span className="font-semibold text-gray-700">{r.h.label.replace('Улей №', '№')}</span>
                    {st && (
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-extrabold', st.cls)}>
                        {t(`dash.varroa.status.${st.level}`)}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] font-bold text-red-600">
                      {fmtNum(r.state.pct ?? 0)} %
                    </span>
                  </button>
                </li>
              )
            })}
          {rows.every((r) => r.state.pct === null) && (
            <li className="rounded-xl border border-dashed border-red-200 bg-red-50/40 px-3 py-2 text-center text-xs text-gray-400">
              {t('real.varroa.tileNone')}
            </li>
          )}
        </ul>
      )}

      <div className="mt-auto pt-3">
        <Button
          onClick={onOpenMeasure}
          disabled={!canMeasure}
          className="w-full gap-1.5 bg-gradient-to-r from-red-600 to-orange-500 font-bold shadow-md shadow-red-100 hover:from-red-700 hover:to-orange-600"
        >
          <Plus className="h-4 w-4" /> {t('dash.varroacard.add')}
          {canMeasure && <span className="sr-only">· {hiveLabel}</span>}
        </Button>
        {!canMeasure && (
          <p className="mt-1.5 text-center text-[10px] text-gray-400">{t('real.varroa.pickHive')}</p>
        )}
      </div>
    </section>
  )
}

/** Компактный график динамики заклещенности по замерам (порог 3 %). */
function VarroaMiniChart({ data }: { data: ReturnType<typeof varroaSeriesOf> }) {
  const maxVal = Math.max(3.5, ...data.map((d) => Math.max(d.pct ?? 0, d.forecast ?? 0)))
  const W = 300
  const H = 120
  const pad = { l: 26, r: 8, t: 8, b: 16 }
  const x = (i: number) =>
    pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) =>
    H - pad.b - (v / maxVal) * (H - pad.t - pad.b)
  const histPts = data
    .filter((d) => d.pct !== null)
    .map((d, i) => ({ cx: x(i), cy: y(d.pct as number) }))
  const forePts = data
    .map((d, i) => ({ v: d.forecast, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null)
    .map((p) => ({ cx: x(p.i), cy: y(p.v) }))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-hidden="true">
      {/* сетка */}
      {[0, 1, 2, 3].map((v) => (
        <line
          key={v}
          x1={pad.l}
          x2={W - pad.r}
          y1={y(v)}
          y2={y(v)}
          stroke="#F0E4DC"
          strokeDasharray="3 3"
        />
      ))}
      {/* критический порог 3 % */}
      <line x1={pad.l} x2={W - pad.r} y1={y(3)} y2={y(3)} stroke="#E93A2D" strokeDasharray="6 4" strokeOpacity={0.75} />
      <text x={W - pad.r} y={y(3) - 3} textAnchor="end" fontSize="9" fill="#E93A2D">
        3 %
      </text>
      {/* история */}
      {histPts.length > 1 && (
        <polyline
          points={histPts.map((p) => `${p.cx},${p.cy}`).join(' ')}
          fill="none"
          stroke="#E9A03B"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {histPts.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r="3" fill="#E9A03B" />
      ))}
      {/* прогноз пунктиром */}
      {forePts.length > 1 && (
        <polyline points={forePts.join(' ')} fill="none" stroke="#E93A2D" strokeWidth="2" strokeDasharray="5 5" />
      )}
      {forePts.length > 0 && (
        <circle cx={forePts[forePts.length - 1].cx} cy={forePts[forePts.length - 1].cy} r="3.5" fill="#E93A2D" />
      )}
      {/* подписи первых/последних точек */}
      {data.length > 0 && (
        <>
          <text x={pad.l} y={H - 4} fontSize="9" fill="#A8968A">
            {data[0].label}
          </text>
          <text x={W - pad.r} y={H - 4} textAnchor="end" fontSize="9" fill="#A8968A">
            {data[data.length - 1].label}
          </text>
        </>
      )}
    </svg>
  )
}

/** Сводка ульев: статус каждой семьи, привес за 2 дня, клик — открыть улей. */
function HiveSummaryCard({
  rows,
  currentId,
  onSelect,
}: {
  rows: Array<{ id: number; label: string; level: 'risk' | 'watch' | 'ok'; statusLabel: string; gain: number | null }>
  currentId: number
  onSelect: (id: number) => void
}) {
  const t = useT()
  return (
    <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
        <Hexagon className="h-4 w-4 text-red-500" /> {t('real.summary.title')}
      </h2>
      <p className="mt-0.5 text-[11px] text-gray-400">{t('real.summary.hint')}</p>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => onSelect(r.id)}
              className={cn(
                'flex w-full flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-[13px] transition-colors hover:bg-red-50/60',
                r.id === currentId ? 'border-red-200 bg-red-50/50' : 'border-red-50',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', STATUS_STYLES[r.level].dot)} />
              <span className="font-semibold text-gray-700">{r.label.replace('Улей №', '№')}</span>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                  STATUS_STYLES[r.level].chip,
                )}
              >
                {r.statusLabel}
              </span>
              <span className="ml-auto text-[11px] font-bold text-red-600">
                {r.gain !== null ? fmtSigned(r.gain) : '—'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Лидер пасеки: лучший привес за период наблюдений (честно из данных весов). */
function LeaderCard({
  id,
  label,
  gain,
  mass,
  onSelect,
}: {
  id: number
  label: string
  gain: number
  mass: number | null
  onSelect: () => void
}) {
  const t = useT()
  return (
    <section className="rounded-2xl border border-red-100 bg-gradient-to-br from-white to-red-50/50 p-4 shadow-sm md:p-5 dark:bg-[#221814]">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
        <ArrowUpRight className="h-4 w-4 text-emerald-500" /> {t('real.leader.title')}
      </h2>
      <p className="mt-0.5 text-[11px] text-gray-400">{t('real.leader.hint')}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-3xl font-extrabold leading-none text-emerald-600">
            {fmtSigned(gain)} <span className="text-sm font-bold text-gray-400">{t('real.micro.unit')}</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-600">
            {label.replace('Улей №', '№')} · {t('real.gain.total', { w: fmtNum(mass ?? 0) })}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onSelect} className="gap-1 border-red-200 text-red-700 hover:bg-red-50">
          {t('real.leader.open')} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </section>
  )
}

/** Вечерний отчет: автосборка по фактическим данным датчиков пасеки. */
function RealReportDialog({
  open,
  onOpenChange,
  hives,
  weather,
  lang,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  hives: Hive[]
  weather: WeatherDay[] | null
  lang: 'ru' | 'en' | 'fr' | 'kk' | 'be' | 'zh'
}) {
  const t = useT()
  const today = weather?.[0] ?? null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left text-[15px] text-[#2A1A12]">
            <ClipboardList className="h-4 w-4 text-red-500" />
            {t('real.report.for', {
              date: format(new Date(), 'd MMMM yyyy', { locale: LANG_DATE_LOCALE[lang] }),
            })}
          </DialogTitle>
          <DialogDescription className="text-left">{t('real.report.footer')}</DialogDescription>
        </DialogHeader>

        <ul className="max-h-[45vh] space-y-1.5 overflow-auto">
          {hives.map((h) => {
            const st = hiveStatus(h, hives)
            const dd = weightDeltaSafe(h, 2)
            const w = h.series[h.series.length - 1]?.weightKg ?? null
            return (
              <li
                key={h.id}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50/60 px-3 py-2 text-[13px] dark:bg-[#2C211C]"
              >
                <span className="font-bold text-gray-800">{h.label.replace('Улей №', '№')}</span>
                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', STATUS_STYLES[st.level].chip)}>
                  {st.label}
                </span>
                <span className="ml-auto text-gray-600">
                  {t('real.mass.delta', { w: dd !== null ? fmtSigned(dd) : '—' })}
                </span>
                <span className="font-bold text-gray-800">
                  {w !== null ? `${fmtNum(w)} ${t('real.micro.unit')}` : '—'}
                </span>
              </li>
            )
          })}
        </ul>

        {today && (
          <p className="rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs font-semibold text-sky-800">
            {t('real.report.weather', {
              t: `${today.tMax > 0 ? '+' : ''}${today.tMax}°C`,
              w: fmtNum(today.windMs, 0),
            })}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
