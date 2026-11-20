'use client'

/**
 * Демо-режим «Мои пасеки» — Bento-дашборд «Пасека Уфа» с живой телеметрией
 * (тик каждые 2 секунды). Структура экрана:
 *   1) срочный пестицидный баннер (рапс «Заречное», 2,4 км, ветер к пасеке);
 *   2) заголовок + компактный погодный виджет (город из профиля) + режим;
 *   3) лента-переключатель ульев [Вся пасека | №1 | №2 | №3 | №4 | +];
 *   4) БЛОК 1 — паспорт улья + цветной статус + индекс + живые плитки
 *      (темп. внутри, влажность, масса, заклещенность ±0,02 %, гул, CO₂, трафик);
 *   5) БЛОК 2 — привес за сутки 50/50 накоплено за взяток (прогресс магазинов);
 *   6) БЛОК 3 — график привесов за 7 дней (столбцы + ночная температура);
 *   7) ряд из 3 графиков — температура | влажность | динамика заклещенности
 *      (красный пунктир порога 3 % + пунктирный прогноз);
 *   8) БЛОК 4 — микроклимат гнезда 50/50 заклещёванность (замер клеща);
 *   9) камера летка | акустика | качество воздуха;
 *  10) погода на пасеке | цветение медоносов (GDD);
 *  11) БЛОК 5 — предписания ИИ-агента (с кнопкой «Провести обработку»:
 *      заклещенность №3 падает до 0,4 %) + умные напоминания и события.
 */
import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowUpRight,
  AudioLines,
  BatteryCharging,
  Bug,
  CalendarDays,
  Cctv,
  CheckCircle2,
  ClipboardList,
  Droplets,
  FlaskConical,
  Flower2,
  Gauge,
  Hexagon,
  MapPin,
  MessageSquareText,
  Plus,
  Scale,
  Search,
  Sprout,
  Split,
  Sun,
  Thermometer,
  TrendingUp,
  Wind,
  Wrench,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { fmtNum, fmtSigned } from '@/lib/hive-model'
import {
  BASIS_KEY,
  DEMO_HIVES,
  GDD_CURRENT,
  GDD_PER_DAY,
  demoClimateSeries,
  demoGaugeInfo,
  demoGainSeries,
  demoHiveById,
  demoVarroaSeries,
  demoWeightSeries,
  gddForecast,
  trafficState,
  varroaStatus,
  vocState,
  type DemoFinding,
  type DemoHive,
  type DemoScenario,
  type LiveDemoValues,
} from '@/lib/demo-hives'
import { liveForHive, useLiveTelemetry, type LiveTelemetry } from '@/hooks/use-live-demo'
import { seasonInfo, seasonPhase } from '@/lib/season'
import { useAppState } from '@/lib/store'
import { tr, useT, LANG_DATE_LOCALE } from '@/lib/i18n'
import { WeatherPanel, WeatherChip } from './WeatherPanel'
import { StatusGauge } from './StatusGauge'
import { ModeSwitcher } from './ModeSwitcher'
import { UrgencyBadge } from './decor'
import {
  AcousticSpark,
  AnimatedNumber,
  DemoClimateMini,
  DemoWeightBars,
  GainComboChart,
  LiveTile,
  LiveValue,
  MiniCard,
  Rise,
  SensorCardIcon,
  VarroaChart,
} from './DemoCharts'
import { EvidenceDialog, EveningReportDialog, MeasureDialog, PesticideDialog } from './DemoDialogs'

/* ------------------------------------------------------------------ */
/* Перевод демо-данных: ключ → словарь, при отсутствии ключа —        */
/* канонический русский текст из demo-hives.ts (фолбэк данных)         */
/* ------------------------------------------------------------------ */

function useTF() {
  const lang = useAppState((s) => s.lang)
  return useCallback(
    (key: string, fallback: string, vars?: Record<string, string | number>) => {
      const s = tr(lang, key, vars)
      return s === key ? fallback : s
    },
    [lang],
  )
}

/* ------------------------------------------------------------------ */
/* Баннер статуса по сценарию улья                                     */
/* ------------------------------------------------------------------ */

type BannerKey = DemoScenario | 'all'

const SCENARIO_BANNER: Record<
  BannerKey,
  { cls: string; icon: typeof Sun; titleKey: string; textKey: string; ctaKey: string }
> = {
  norm: {
    cls: 'bg-gradient-to-r from-emerald-600 to-teal-500 shadow-emerald-100',
    icon: Sun,
    titleKey: 'dash.banner.norm.title',
    textKey: 'dash.banner.norm.text',
    ctaKey: 'dash.banner.cta.evidence',
  },
  flow: {
    cls: 'bg-gradient-to-r from-amber-500 to-orange-400 shadow-amber-100',
    icon: TrendingUp,
    titleKey: 'dash.banner.flow.title',
    textKey: 'dash.banner.flow.text',
    ctaKey: 'dash.banner.cta.evidence',
  },
  varroa: {
    cls: 'bg-gradient-to-r from-[#D93E00] to-[#FF5A1F] shadow-red-100',
    icon: AlertTriangle,
    titleKey: 'dash.banner.varroa.title',
    textKey: 'dash.banner.varroa.text',
    ctaKey: 'dash.banner.cta.why',
  },
  swarm: {
    cls: 'bg-gradient-to-r from-[#C23000] to-[#F2542D] shadow-red-100',
    icon: Split,
    titleKey: 'dash.banner.swarm.title',
    textKey: 'dash.banner.swarm.text',
    ctaKey: 'dash.banner.cta.why',
  },
  all: {
    cls: 'bg-gradient-to-r from-amber-600 to-orange-500 shadow-amber-100',
    icon: Hexagon,
    titleKey: 'dash.banner.all.title',
    textKey: 'dash.banner.all.text',
    ctaKey: 'dash.banner.cta.evidence',
  },
}

/** Зимние версии баннеров (клуб, без взятка и роения). */
const WINTER_BANNER: Record<BannerKey, { titleKey: string; textKey: string }> = {
  norm: { titleKey: 'dash.banner.winter.norm.title', textKey: 'dash.banner.winter.norm.text' },
  flow: { titleKey: 'dash.banner.winter.flow.title', textKey: 'dash.banner.winter.flow.text' },
  varroa: { titleKey: 'dash.banner.winter.varroa.title', textKey: 'dash.banner.winter.varroa.text' },
  swarm: { titleKey: 'dash.banner.winter.swarm.title', textKey: 'dash.banner.winter.swarm.text' },
  all: { titleKey: 'dash.banner.winter.all.title', textKey: 'dash.banner.winter.all.text' },
}

/** Цвета точек ленты-переключателя (как на референсе: №3 — жёлтый, №4 — красный). */
const RIBBON_DOT: Record<number, string> = {
  0: 'bg-gradient-to-br from-red-500 to-orange-400',
  1: 'bg-emerald-500',
  2: 'bg-emerald-500',
  3: 'bg-amber-400',
  4: 'bg-red-500',
}

const SCEN_GAUGE_KEY: Record<string, string> = {
  alert: 'dash.gauge.alert',
  watch: 'dash.gauge.watch',
  normal: 'dash.gauge.normal',
  ok: 'dash.gauge.ok',
}

/* ------------------------------------------------------------------ */
/* Живые значения для сводного вида «Вся пасека»                       */
/* ------------------------------------------------------------------ */

function liveForSelection(live: LiveTelemetry, hive: DemoHive): LiveDemoValues {
  if (hive.id !== 0) return liveForHive(live, hive)
  const vals = DEMO_HIVES.map((h) => live.values[h.id] ?? h.base)
  const avg = (f: (v: LiveDemoValues) => number) => vals.reduce((s, v) => s + f(v), 0) / vals.length
  return {
    tempC: avg((v) => v.tempC),
    humidityPct: avg((v) => v.humidityPct),
    weightKg: vals.reduce((s, v) => s + v.weightKg, 0),
    soundHz: avg((v) => v.soundHz),
    co2Ppm: avg((v) => v.co2Ppm),
    vocIndex: avg((v) => v.vocIndex),
    trafficPerMin: avg((v) => v.trafficPerMin),
    varroaPct: avg((v) => v.varroaPct),
  }
}

/* ------------------------------------------------------------------ */
/* Мелкие блоки                                                        */
/* ------------------------------------------------------------------ */

/** GDD-прогресс до цветения ближайших медоносов (зимой — вегетация остановлена). */
function GddCard() {
  const t = useT()
  const tf = useTF()
  const crops = gddForecast()
  const paused = crops[0]?.paused ?? false
  const soon = crops.filter((c) => c.soon)
  return (
    <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
        <Flower2 className="h-4 w-4 text-red-500" /> {t('dash.gdd.title')}
      </h2>
      <p className="mt-1 text-[11px] text-gray-400">
        {paused ? t('dash.gdd.notePaused', { cur: GDD_CURRENT }) : t('dash.gdd.note', { cur: GDD_CURRENT, per: GDD_PER_DAY })}
      </p>
      <ul className="mt-3 space-y-3">
        {crops.map((c) => (
          <li key={c.key}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-800">{tf(`demo.crop.${c.key}`, c.name)}</span>
              <span className={cn('font-semibold', c.paused ? 'text-gray-300' : c.soon ? 'text-amber-600' : 'text-gray-400')}>
                {c.paused ? t('dash.gdd.paused') : t('dash.gdd.in', { n: c.daysLeft })}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-red-50 dark:bg-[#2C211C]">
              <motion.div
                className={cn(
                  'bar-shine h-full rounded-full bg-gradient-to-r',
                  c.paused ? 'from-gray-300 to-gray-400' : c.soon ? 'from-amber-400 to-orange-500' : 'from-emerald-400 to-emerald-500',
                )}
                initial={{ width: 0 }}
                animate={{ width: `${c.pct}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
              />
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              {tf(`dash.gdd.note.${c.key}`, c.note)} · {t('dash.gdd.pct', { n: c.pct })}
            </p>
          </li>
        ))}
      </ul>
      {soon.length > 0 && !paused && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-800">
          {t('dash.gdd.auto', { name: tf(`demo.crop.${soon[0].key}`, soon[0].name), n: soon[0].daysLeft })}
        </p>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Демо-дашборд                                                        */
/* ------------------------------------------------------------------ */

export function DemoDashboard() {
  const hiveId = useAppState((s) => s.hiveId)
  const setHive = useAppState((s) => s.setHive)
  const ask = useAppState((s) => s.ask)
  const setView = useAppState((s) => s.setView)
  const lang = useAppState((s) => s.lang)
  const city = useAppState((s) => s.city)
  const reminders = useAppState((s) => s.reminders)
  const { toast } = useToast()
  const t = useT()
  const tf = useTF()

  const live = useLiveTelemetry()
  const hive = demoHiveById(hiveId)
  const isAll = hive.id === 0
  const liveV = liveForSelection(live, hive)
  const winter = seasonPhase() === 'winter_rest'

  // выполненные предписания (улей → список id) и проведенные обработки (улей → 0,4 %)
  const [done, setDone] = useState<Record<number, string[]>>({})
  const [treated, setTreated] = useState<Record<number, number>>({})
  // ручные замеры клеща: улей → результат (пересчитывает карточку и график)
  const [measures, setMeasures] = useState<Record<number, { pct: number; mites: number; bees: number }>>({})
  const [evidence, setEvidence] = useState<DemoFinding | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [measureOpen, setMeasureOpen] = useState(false)
  const [pesticideOpen, setPesticideOpen] = useState(false)

  const doneForHive = (id: number) => done[id] ?? []
  const indexWithBoost = (id: number) => {
    const h = demoHiveById(id)
    const boosts = h.prescriptions
      .filter((f) => doneForHive(id).includes(f.id))
      .reduce((s, f) => s + f.boost, 0)
    return Math.min(10, h.index + boosts)
  }
  const gaugeValue = indexWithBoost(hive.id)
  const gauge = demoGaugeInfo(gaugeValue)

  /** Текущая заклещенность: ручной замер → обработка → база сценария. */
  const currentVarroaBase = (id: number) =>
    measures[id]?.pct ?? treated[id] ?? demoHiveById(id).base.varroaPct
  const baseVarroa = isAll
    ? Math.round((DEMO_HIVES.reduce((s, h) => s + currentVarroaBase(h.id), 0) / DEMO_HIVES.length) * 10) / 10
    : currentVarroaBase(hive.id)
  // живое колебание ±0,02 % вокруг текущего значения (сохраняем дрейф тика)
  const varroaLive = Math.max(0.05, baseVarroa + (liveV.varroaPct - hive.base.varroaPct))
  const varroa = varroaStatus(baseVarroa)
  const varroaStatusLabel = t(`dash.varroa.status.${varroa.level}`)
  const forecast14 =
    measures[hive.id] || treated[hive.id] !== undefined
      ? Math.round((baseVarroa + (treated[hive.id] !== undefined ? 0.1 : 0.2)) * 10) / 10
      : hive.base.varroaForecast14d

  const climate = demoClimateSeries(hive)
  const weight = demoWeightSeries(hive)
  const gain7 = demoGainSeries(hive)
  const varroaSeries = demoVarroaSeries(hive, 30, {
    overridePct: baseVarroa,
    treatedToday: treated[hive.id] !== undefined,
  })
  // живой спарклайн гула: буфер последних тиков (для «Всей пасеки» — среднее по ульям)
  const sparkHz = isAll
    ? (() => {
        const len = Math.min(30, ...DEMO_HIVES.map((h) => live.spark[h.id]?.length ?? 0))
        const out: number[] = []
        for (let i = 0; i < len; i++) {
          out.push(DEMO_HIVES.reduce((s, h) => s + (live.spark[h.id]?.[i]?.soundHz ?? 0), 0) / DEMO_HIVES.length)
        }
        return out
      })()
    : (live.spark[hive.id] ?? []).map((v) => v.soundHz)

  const bannerBase = SCENARIO_BANNER[isAll ? 'all' : hive.scenario]
  const banner = winter
    ? { ...bannerBase, ...WINTER_BANNER[isAll ? 'all' : hive.scenario] }
    : bannerBase
  const BannerIcon = banner.icon
  const voc = vocState(liveV.vocIndex)
  const traffic = trafficState(liveV.trafficPerMin)
  const crops = gddForecast()
  const nearest = [...crops].sort((a, b) => a.daysLeft - b.daysLeft)[0]
  const sunflower = crops.find((c) => c.key === 'sunflower')

  const todayLabel = format(new Date(), 'EEEE, d MMMM yyyy', { locale: LANG_DATE_LOCALE[lang] })
  const roleKey = isAll ? 'dash.passport.all' : `dash.role.${hive.scenario}`

  // тренд температуры: сравниваем средние последних тиков (только для отдельного улья)
  const sparkBuf = isAll ? [] : (live.spark[hive.id] ?? [])
  const tempRising =
    sparkBuf.length >= 6 &&
    sparkBuf.slice(-3).reduce((s, v) => s + v.tempC, 0) / 3 >
      sparkBuf.slice(-6, -3).reduce((s, v) => s + v.tempC, 0) / 3 + 0.03

  const complete = (f: DemoFinding) => {
    const targetHive = f.sourceHive ?? hive.id
    const before = indexWithBoost(targetHive)
    const varroaBefore = currentVarroaBase(targetHive)
    setDone((prev) => {
      const cur = prev[targetHive] ?? []
      if (cur.includes(f.id)) return prev
      return { ...prev, [targetHive]: [...cur, f.id] }
    })
    if (f.treatVarroa !== undefined) {
      setTreated((prev) => ({ ...prev, [targetHive]: f.treatVarroa as number }))
    }
    setEvidence(null)
    const after = Math.min(10, before + f.boost)
    toast({
      title: t('dash.agent.doneToast'),
      description:
        f.treatVarroa !== undefined
          ? t('dash.agent.doneToastVarroa', {
              action: tf(`demo.finding.${f.id}.action`, f.action),
              n: targetHive,
              a: fmtNum(varroaBefore),
              b: fmtNum(f.treatVarroa),
              x: fmtNum(before),
              y: fmtNum(after),
            })
          : t('dash.agent.doneToastPlain', {
              action: tf(`demo.finding.${f.id}.action`, f.action),
              n: targetHive,
              x: fmtNum(before),
              y: fmtNum(after),
            }),
    })
  }

  const saveMeasure = (pct: number, mites: number, bees: number) => {
    setMeasures((prev) => ({ ...prev, [hive.id]: { pct, mites, bees } }))
    const st = varroaStatus(pct)
    toast({
      title: t('dash.measure.saved'),
      description: t('dash.measure.savedDesc', {
        n: hive.id,
        p: fmtNum(pct, 1),
        status: t(`dash.varroa.status.${st.level}`),
      }),
    })
  }

  const upcomingReminders = reminders
    .filter((r) => !r.done)
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
    .slice(0, 3)

  return (
    <div className="space-y-4">
      {/* ── Срочное предупреждение: пестициды — только в сезон лёта;
           зимой пчёлы в клубе и обработок полей не показываем ── */}
      {!winter && (
        <Rise delay={0}>
          <div className="hazard-stripes animate-sheen relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#C23000] to-[#F2542D] p-4 text-white shadow-lg md:p-4.5">
            <AlertTriangle className="absolute -right-3 -top-3 h-28 w-28 rotate-12 text-white/15" />
            <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="animate-heartbeat mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <p className="text-[13px] font-extrabold uppercase tracking-wide text-white/95">
                    {t('dash.pesticide.badge')}
                  </p>
                  <p className="mt-1 max-w-3xl text-sm leading-snug">{t('dash.pesticide.text')}</p>
                </div>
              </div>
              <Button
                className="w-fit shrink-0 bg-white font-bold text-red-700 hover:bg-red-50"
                onClick={() => setPesticideOpen(true)}
              >
                {t('dash.pesticide.cta')}
              </Button>
            </div>
          </div>
        </Rise>
      )}

      {/* ── Заголовок «Пасека Уфа» + погода города + режим ── */}
      <Rise delay={0.05}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#2A1A12] md:text-3xl">
              {t('dash.title')} · <span className="text-shine">{t('dash.demoBadge')}</span>
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <FlaskConical className="h-3.5 w-3.5 text-red-500" /> {t('dash.tiles.telemetry')}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-red-500" /> {city.name}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-red-500" /> {todayLabel}
              </span>
              {/* Сезонный бейдж: приложение понимает время года (п. 1 ТЗ) */}
              <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700">
                <Sprout className="h-3.5 w-3.5" /> {t(seasonInfo().titleKey)}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WeatherChip coords={[city.lat, city.lon]} place={city.name} />
            <ModeSwitcher />
          </div>
        </div>
      </Rise>

      {/* ── Лента-переключатель ульев ── */}
      <Rise delay={0.1}>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('dash.state.title')}>
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
            <span className="text-xs font-extrabold text-red-600">{fmtNum(indexWithBoost(0))}</span>
          </button>
          {DEMO_HIVES.map((h) => (
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
              <span className={cn('h-2.5 w-2.5 rounded-full', RIBBON_DOT[h.id])} />
              №{h.id} · {winter ? h.shortLabel : t(`dash.short.${h.scenario}`)}
              <span className="text-xs font-extrabold text-red-600">{fmtNum(indexWithBoost(h.id))}</span>
            </button>
          ))}
          <button
            onClick={() => setView('sensors')}
            title={t('dash.addHive')}
            className="pop-in inline-flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-red-300 text-red-500 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Rise>
      {/* ── БЛОК 1: паспорт улья + статус + индекс + живые плитки ── */}
      <Rise delay={0.12}>
        <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
          <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
            {/* Индекс состояния */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-red-50 bg-red-50/30 p-3 dark:bg-[#2C211C]">
              <StatusGauge info={{ value: gaugeValue, label: t(SCEN_GAUGE_KEY[gauge.tone]), tone: gauge.tone }} />
              <p className="mt-2 text-center text-[11px] font-semibold text-gray-400">{t('dash.gauge.label')}</p>
            </div>

            <div className="min-w-0">
              {/* Паспорт */}
              <p className="text-sm font-extrabold uppercase tracking-wide text-gray-500">
                {t('dash.passport')}
              </p>
              <p className="mt-1 text-base font-extrabold text-[#2A1A12] md:text-lg">
                {tf(`demo.hive.${hive.id}.label`, hive.label).toUpperCase()} ({t(roleKey)})
                {hive.queen && (
                  <span className="ml-2 text-sm font-semibold text-gray-600">
                    · {' '}
                    {t('dash.queen', {
                      breed: tf(`demo.hive.${hive.id}.queenBreed`, hive.queen.breed),
                      year: hive.queen.year,
                      mark: tf(`demo.hive.${hive.id}.queenMark`, hive.queen.mark),
                    })}
                  </span>
                )}
                {!hive.queen && <span className="ml-2 text-sm font-semibold text-gray-600">· {t('dash.queens.all')}</span>}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {tf(`demo.hive.${hive.id}.scenarioHint`, hive.scenarioHint)} ·{' '}
                {t('dash.corps', { corps: tf(`demo.hive.${hive.id}.corps`, hive.base.corps) })}
              </p>

              {/* Статус-баннер */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={hive.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    'animate-sheen relative mt-3 overflow-hidden rounded-2xl p-4 text-white shadow-lg',
                    banner.cls,
                  )}
                >
                  <BannerIcon className="absolute -right-3 -top-3 h-24 w-24 rotate-12 text-white/15" />
                  <div className="relative flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <BannerIcon
                        className={cn(
                          'mt-0.5 h-6 w-6 shrink-0',
                          !isAll && (hive.scenario === 'varroa' || hive.scenario === 'swarm') && 'animate-heartbeat',
                        )}
                      />
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-white/90">
                          {t(banner.titleKey)}
                        </p>
                        <p className="mt-1 max-w-2xl text-sm leading-snug">{t(banner.textKey)}</p>
                      </div>
                    </div>
                    <Button
                      className="w-fit shrink-0 bg-white font-semibold text-red-700 hover:bg-red-50"
                      onClick={() => setEvidence(hive.prescriptions[0])}
                    >
                      <Search className="h-4 w-4" /> {t(banner.ctaKey)}
                    </Button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Живые плитки показателей */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
              <TrendingUp className="h-4 w-4 text-red-500" /> {t('dash.state.title')}
            </h2>
            <span
              title={t('dash.liveHint')}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
            >
              <span className="live-dot h-2 w-2 rounded-full bg-emerald-500" />
              {t('dash.liveBadge')}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
            <LiveTile
              icon={<Thermometer className="h-3.5 w-3.5" />}
              label={t('dash.tiles.temp')}
              num={liveV.tempC}
              suffix="°C"
              hint={isAll ? t('demo.hives.all4') : t('dash.tiles.tempHint', { n: hive.id })}
            />
            <LiveTile
              icon={<Droplets className="h-3.5 w-3.5" />}
              label={t('dash.tiles.hum')}
              num={liveV.humidityPct}
              digits={0}
              suffix="%"
              hint={!isAll && hive.scenario === 'flow' ? t('dash.tiles.humHint.flow') : t('dash.tiles.humHint.norm')}
            />
            <LiveTile
              icon={<Scale className="h-3.5 w-3.5" />}
              label={isAll ? t('dash.tiles.weightAll') : t('dash.tiles.weight')}
              num={liveV.weightKg}
              suffix={t('demo.unit.kg')}
              hint={tf(`demo.hive.${hive.id}.corps`, hive.base.corps)}
            />
            <LiveTile
              icon={<Bug className="h-3.5 w-3.5" />}
              label={t('dash.tiles.varroa')}
              num={varroaLive}
              digits={2}
              suffix="%"
              tone={varroa.level === 'crit' ? 'red' : varroa.level === 'risk' ? 'amber' : 'emerald'}
              hint={t('dash.tiles.varroaHint', { status: varroaStatusLabel, p: fmtNum(forecast14) })}
              badge={
                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-extrabold', varroa.cls)}>
                  {varroaStatusLabel}
                </span>
              }
            />
            <LiveTile
              icon={<AudioLines className="h-3.5 w-3.5" />}
              label={t('dash.tiles.sound')}
              num={liveV.soundHz}
              digits={0}
              suffix={t('demo.unit.hz')}
              hint={t('dash.tiles.soundHint')}
            />
            <LiveTile
              icon={<Wind className="h-3.5 w-3.5" />}
              label="CO₂"
              num={liveV.co2Ppm}
              digits={0}
              suffix="ppm"
              hint={t('dash.tiles.co2Hint')}
            />
            <LiveTile
              icon={<Cctv className="h-3.5 w-3.5" />}
              label={t('dash.tiles.traffic')}
              num={liveV.trafficPerMin}
              digits={0}
              suffix={t('demo.unit.beesMin')}
              hint={tf(`demo.traffic.${traffic.key}`, traffic.label).toLowerCase()}
            />
          </div>
        </section>
      </Rise>

      {/* ── БЛОК 2: привес за сутки | накоплено за взяток ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Rise delay={0.05} className="h-full">
          <section className="flex h-full flex-col rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('dash.gain.title')}</h2>
            <p className="mt-2 flex items-center gap-2 text-5xl font-extrabold leading-none text-[#2A1A12]">
              {fmtSigned(hive.base.dailyGainKg, 2)}
              <span className="text-xl font-bold text-gray-400">{t('demo.unit.kg')}</span>
              <ArrowUpRight
                className={cn(
                  'h-8 w-8',
                  hive.base.dailyGainKg >= 0.15 ? 'text-emerald-500' : 'text-amber-500',
                )}
              />
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-600">
              {t('dash.gain.pure', { n: fmtNum(hive.base.dailyGainKg * 0.75, 1) })}
            </p>
            <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
              <div className="rounded-xl bg-red-50 px-3 py-2 dark:bg-[#2C211C]">
                <p className="text-[10px] font-semibold text-gray-400">{t('dash.scales.morning')}</p>
                <p className="text-sm font-extrabold text-sky-600">
                  −{fmtNum(hive.base.morningDropKg)} {t('demo.unit.kg')}
                </p>
              </div>
              <div className="rounded-xl bg-red-50 px-3 py-2 dark:bg-[#2C211C]">
                <p className="text-[10px] font-semibold text-gray-400">{t('dash.scales.filter')}</p>
                <p className="text-sm font-extrabold text-gray-700">{t('dash.scales.filterOk')}</p>
              </div>
            </div>
          </section>
        </Rise>

        <Rise delay={0.1} className="h-full">
          <section className="flex h-full flex-col rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('dash.season.title')}</h2>
            <p className="mt-2 flex items-center gap-2 text-5xl font-extrabold leading-none text-[#2A1A12]">
              {winter ? fmtSigned(hive.base.dailyGainKg, 1) : `+${fmtNum(hive.base.seasonGainKg, 1)}`}
              <span className="text-xl font-bold text-gray-400">
                {t('demo.unit.kg')}
                {winter ? t('dash.season.perDay') : ''}
              </span>
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-600">
              {winter ? t('dash.season.winterNote') : t('dash.season.total', { n: fmtNum(liveV.weightKg) })}
            </p>
            <div className="mt-auto pt-3">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                <span>{t('dash.season.volume', { n: hive.base.storePct })}</span>
                <span className="text-red-600">{hive.base.storePct}%</span>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-red-50 dark:bg-[#2C211C]">
                <motion.div
                  className="bar-shine h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${hive.base.storePct}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400">{t('dash.corps', { corps: tf(`demo.hive.${hive.id}.corps`, hive.base.corps) })}</p>
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
            <span
              title={t('dash.scales.quietHint')}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700"
            >
              <Gauge className="h-3 w-3" /> {t('dash.scales.quiet')}
            </span>
          </div>
          <div className="mt-2">
            <GainComboChart data={gain7} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-gradient-to-t from-amber-300 to-orange-500" />
              {t('dash.chart.gain7.gain')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-red-500" />
              {t('dash.chart.gain7.temp')}
            </span>
            <span className="ml-auto text-[11px] text-gray-400">{t('dash.chart.days', { n: 7 })}</span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-gray-400">{t('dash.chart.gain7.note')}</p>
        </section>
      </Rise>

      {/* ── Ряд из 3 графиков: температура | влажность | заклещенность ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Rise delay={0.05} className="h-full">
          <MiniCard
            title={t('dash.chart.temp')}
            icon={<Thermometer className="h-4 w-4" />}
            value={`${fmtNum(liveV.tempC)} °C`}
            note={t('dash.chart.temp.note')}
          >
            <DemoClimateMini data={climate} metric="tempInC" />
          </MiniCard>
        </Rise>
        <Rise delay={0.1} className="h-full">
          <MiniCard
            title={t('dash.chart.hum')}
            icon={<Droplets className="h-4 w-4" />}
            value={`${fmtNum(liveV.humidityPct, 0)} %`}
            note={!isAll && hive.scenario === 'flow' ? t('dash.chart.hum.note.flow') : t('dash.chart.hum.note.norm')}
          >
            <DemoClimateMini data={climate} metric="humidityPct" />
          </MiniCard>
        </Rise>
        <Rise delay={0.15} className="h-full md:col-span-2 xl:col-span-1">
          <div className="h-full rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:bg-[#221814]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
                <Bug className="h-4 w-4 text-red-500" /> {t('dash.chart.varroa')}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold', varroa.cls)}>
                  {varroaStatusLabel}
                </span>
                <span className="rounded-full border border-red-100 bg-red-50/60 px-2 py-0.5 text-[11px] font-bold text-red-700">
                  {t('dash.varroa.forecast', { p: fmtNum(forecast14) })}
                </span>
              </div>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-gray-400">{t('dash.chart.varroa.note')}</p>
            <div className="mt-1.5">
              <VarroaChart data={varroaSeries} />
            </div>
          </div>
        </Rise>
      </div>

      {/* ── БЛОК 4: микроклимат гнезда | заклещёванность ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Rise delay={0.05} className="h-full">
          <section className="flex h-full flex-col rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
              <Thermometer className="h-4 w-4 text-red-500" /> {t('dash.micro.title')}
            </h2>
            <ul className="mt-3 space-y-2.5">
              <li className="flex items-center justify-between gap-3 rounded-xl bg-red-50/60 px-3 py-2.5 dark:bg-[#2C211C]">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Thermometer className="h-4 w-4 text-red-400" /> {t('dash.micro.temp')}
                </span>
                <span className="text-base font-extrabold text-[#2A1A12]">
                  <AnimatedNumber value={liveV.tempC} /> °C
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-bold',
                    tempRising
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  )}
                >
                  {tempRising ? t('dash.micro.rising') : t('dash.micro.stable')}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-xl bg-red-50/60 px-3 py-2.5 dark:bg-[#2C211C]">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Droplets className="h-4 w-4 text-red-400" /> {t('dash.micro.hum')}
                </span>
                <span className="text-base font-extrabold text-[#2A1A12]">
                  <AnimatedNumber value={liveV.humidityPct} digits={0} /> %
                </span>
                {!isAll && hive.scenario === 'flow' && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    ↑ {t('dash.micro.drying')}
                  </span>
                )}
              </li>
              <li className="flex items-center justify-between gap-3 rounded-xl bg-red-50/60 px-3 py-2.5 dark:bg-[#2C211C]">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <AudioLines className="h-4 w-4 text-red-400" /> {t('dash.micro.acoustics')}
                </span>
                <span className="min-w-0 truncate text-right text-[13px] font-bold text-[#2A1A12]">
                  {tf(`demo.hive.${hive.id}.acousticLabel`, hive.base.acousticLabel)}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-xl bg-red-50/60 px-3 py-2.5 dark:bg-[#2C211C]">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <BatteryCharging className="h-4 w-4 text-red-400" /> {t('dash.micro.battery')}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-24 overflow-hidden rounded-full bg-red-100 dark:bg-[#3E201A]">
                    <motion.span
                      className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${hive.base.sensorBatteryPct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    />
                  </span>
                  <span className="text-base font-extrabold text-emerald-600">
                    {hive.base.sensorBatteryPct}%
                  </span>
                </span>
              </li>
            </ul>
          </section>
        </Rise>

        <Rise delay={0.1} className="h-full">
          <section className="flex h-full flex-col rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
                <Bug className="h-4 w-4 text-red-500" /> {t('dash.varroacard.title')}
              </h2>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-extrabold', varroa.cls)}>
                {varroa.level === 'crit' ? '🔴' : varroa.level === 'risk' ? '🟡' : '🟢'} {varroaStatusLabel}
              </span>
            </div>
            <p className="mt-3 text-4xl font-extrabold leading-none text-[#2A1A12]">
              <AnimatedNumber value={varroaLive} digits={2} />
              <span className="ml-1 text-sm font-bold text-gray-400">%</span>
              <span className="ml-3 align-middle text-xs font-bold text-red-500">
                {t('dash.varroa.forecast', { p: fmtNum(forecast14) })}
              </span>
            </p>
            <div className="mt-3 space-y-1.5 text-xs text-gray-600">
              <p className="flex items-center justify-between gap-2">
                <span>
                  {measures[hive.id]
                    ? t('dash.varroacard.measureJust', { n: measures[hive.id].mites, bees: measures[hive.id].bees })
                    : t('dash.varroacard.measure', { n: hive.base.lastMiteCount, d: hive.base.lastMiteDaysAgo })}
                </span>
                <span className="font-bold text-gray-700">📋</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>{t('dash.varroacard.measureCamera', { n: hive.base.mitesCounted })}</span>
                <span
                  className={cn(
                    'font-extrabold',
                    hive.base.mitesCounted === 0
                      ? 'text-emerald-600'
                      : hive.base.mitesCounted >= 5
                        ? 'text-red-600'
                        : 'text-amber-600',
                  )}
                >
                  {hive.base.mitesCounted}
                </span>
              </p>
            </div>
            <div className="mt-auto pt-3">
              <Button
                onClick={() => setMeasureOpen(true)}
                className="w-full gap-1.5 bg-gradient-to-r from-red-600 to-orange-500 font-bold shadow-md shadow-red-100 hover:from-red-700 hover:to-orange-600"
              >
                <Plus className="h-4 w-4" /> {t('dash.varroacard.add')}
              </Button>
            </div>
          </section>
        </Rise>
      </div>

      {/* ── Камера | Акустика | Качество воздуха ── */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
        <Rise delay={0.05} className="h-full">
          <section className="flex h-full flex-col rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:bg-[#221814]">
            <div className="flex items-center gap-2">
              <SensorCardIcon tone="red">
                <Cctv className="h-4 w-4" />
              </SensorCardIcon>
              <div>
                <h3 className="text-sm font-bold text-[#2A1A12]">{t('dash.camera.title')}</h3>
                <p className="text-[10px] text-gray-400">{t('dash.camera.hint')}</p>
              </div>
            </div>
            <p className="mt-3 text-2xl font-extrabold leading-none text-[#2A1A12]">
              <AnimatedNumber value={liveV.trafficPerMin} digits={0} />
              <span className="ml-1 text-xs font-bold text-gray-400">{t('demo.unit.beesMin')}</span>
            </p>
            <div className="mt-2 space-y-1.5 text-xs text-gray-600">
              <p className="flex items-center justify-between gap-2">
                <span>{t('dash.camera.mites')}</span>
                <span
                  className={cn(
                    'font-extrabold',
                    hive.base.mitesCounted === 0
                      ? 'text-emerald-600'
                      : hive.base.mitesCounted >= 5
                        ? 'text-red-600'
                        : 'text-amber-600',
                  )}
                >
                  {hive.base.mitesCounted}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>{t('dash.camera.avg')}</span>
                <span className="font-extrabold text-gray-700">45 {t('demo.unit.beesMin')}</span>
              </p>
            </div>
            <p
              className={cn(
                'mt-auto rounded-xl px-3 py-2 text-[11px] font-bold leading-snug',
                hive.base.entranceLevel === 'beard'
                  ? 'border border-red-200 bg-red-50 text-red-700'
                  : hive.base.entranceLevel === 'weak'
                    ? 'border border-amber-200 bg-amber-50 text-amber-700'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700',
              )}
            >
              {tf(`demo.hive.${hive.id}.entranceLabel`, hive.base.entranceLabel)}
            </p>
          </section>
        </Rise>

        <Rise delay={0.1} className="h-full">
          <section className="flex h-full flex-col rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:bg-[#221814]">
            <div className="flex items-center gap-2">
              <SensorCardIcon tone="amber">
                <AudioLines className="h-4 w-4" />
              </SensorCardIcon>
              <div>
                <h3 className="text-sm font-bold text-[#2A1A12]">{t('dash.acoustics.title')}</h3>
                <p className="text-[10px] text-gray-400">{t('dash.acoustics.hint')}</p>
              </div>
            </div>
            <p className="mt-3 text-2xl font-extrabold leading-none text-[#2A1A12]">
              <AnimatedNumber value={liveV.soundHz} digits={0} />
              <span className="ml-1 text-xs font-bold text-gray-400">{t('demo.unit.hz')}</span>
            </p>
            <div className="mt-2">
              <AcousticSpark data={sparkHz} />
            </div>
            <p className="mt-auto rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-snug text-amber-700">
              {tf(`demo.hive.${hive.id}.acousticLabel`, hive.base.acousticLabel)}
            </p>
          </section>
        </Rise>

        <Rise delay={0.15} className="h-full">
          <section className="flex h-full flex-col rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:bg-[#221814]">
            <div className="flex items-center gap-2">
              <SensorCardIcon tone="sky">
                <Wind className="h-4 w-4" />
              </SensorCardIcon>
              <div>
                <h3 className="text-sm font-bold text-[#2A1A12]">{t('dash.air.title')}</h3>
                <p className="text-[10px] text-gray-400">{t('dash.air.hint')}</p>
              </div>
            </div>
            <p className="mt-3 text-2xl font-extrabold leading-none text-[#2A1A12]">
              <AnimatedNumber value={liveV.co2Ppm} digits={0} />
              <span className="ml-1 text-xs font-bold text-gray-400">ppm CO₂</span>
            </p>
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2 text-gray-600">
                <span>{t('dash.air.voc')}</span>
                <span className={cn('font-extrabold', voc.cls)}>{Math.round(liveV.vocIndex)} / 100</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-red-50 dark:bg-[#2C211C]">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    liveV.vocIndex > 60 ? 'bg-red-500' : liveV.vocIndex > 30 ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  animate={{ width: `${Math.min(100, liveV.vocIndex)}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
            <p
              className={cn(
                'mt-auto rounded-xl border border-red-100 bg-red-50/50 px-3 py-2 text-[11px] font-bold leading-snug',
                voc.cls,
              )}
            >
              {tf(`demo.voc.${voc.key}`, voc.label)}
            </p>
          </section>
        </Rise>
      </div>

      {/* ── Погода на пасеке | Цветение GDD ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Rise delay={0.05}>
          <WeatherPanel coords={[city.lat, city.lon]} place={city.name} />
        </Rise>
        <Rise delay={0.1}>
          <GddCard />
        </Rise>
      </div>

      {/* ── БЛОК 5: предписания агента | умные напоминания и события ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Rise delay={0.05}>
          <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
                <MessageSquareText className="h-4 w-4 text-red-500" /> {t('dash.agent.title')}
              </h2>
              <span className="text-[11px] text-gray-400">
                {isAll ? t('dash.agent.contextAll') : t('dash.agent.context', { n: hive.id })}
              </span>
            </div>

            {/* Вечерний отчет (21:00) */}
            <Button
              variant="outline"
              onClick={() => setReportOpen(true)}
              className="mt-3 w-full gap-2 border-red-200 font-bold text-red-700 hover:bg-red-50 hover:text-red-700"
            >
              <ClipboardList className="h-4 w-4" /> {t('dash.agent.evening')}
            </Button>

            <ol className="mt-3 space-y-2">
              {hive.prescriptions.map((f, i) => {
                const targetHive = f.sourceHive ?? hive.id
                const isDone = doneForHive(targetHive).includes(f.id)
                const fTitle = tf(`demo.finding.${f.id}.title`, f.title)
                return (
                  <li
                    key={f.id}
                    className={cn(
                      'rise-in overflow-hidden rounded-xl border transition-shadow',
                      isDone
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : f.urgency === 'act-now'
                          ? 'border-red-200 hover:shadow-md hover:shadow-red-100'
                          : 'border-red-100 hover:shadow-md hover:shadow-red-50',
                    )}
                  >
                    <button
                      onClick={() => setEvidence(f)}
                      aria-label={`${t('dash.banner.cta.why')}: ${fTitle}`}
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold',
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : f.urgency === 'act-now'
                              ? 'bg-red-600 text-white'
                              : 'bg-red-100 text-red-700',
                        )}
                      >
                        {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {isAll && (
                            <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                              №{targetHive}
                            </span>
                          )}
                          <span
                            className={cn(
                              'text-[13px] font-bold leading-snug',
                              isDone ? 'text-emerald-800 line-through decoration-emerald-300' : 'text-gray-800',
                            )}
                          >
                            {fTitle}
                          </span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-gray-500">
                          {tf(`demo.finding.${f.id}.summary`, f.summary)}
                        </span>
                        {isDone && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> {t('dash.agent.done', { n: fmtNum(f.boost) })}
                          </span>
                        )}
                      </span>
                    </button>
                    <div className="flex flex-wrap gap-1 px-3 pb-2">
                      {f.basis.map((b) => (
                        <span
                          key={b}
                          className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700 dark:bg-[#2C211C]"
                        >
                          {tf(`demo.basis.${BASIS_KEY[b] ?? b}`, b)}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-red-50 px-3 py-2">
                      <UrgencyBadge
                        urgency={f.urgency}
                        note={tf(`demo.finding.${f.id}.urgencyNote`, f.urgencyNote)}
                      />
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setEvidence(f)}
                        >
                          <Search className="h-3.5 w-3.5" /> {t('dash.agent.why')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hidden gap-1 text-gray-500 hover:bg-red-50 hover:text-red-700 sm:inline-flex"
                          onClick={() => ask(t('demo.agent.discussMsg', { n: targetHive, title: fTitle }))}
                        >
                          {t('dash.agent.discuss')}
                        </Button>
                      </div>
                    </div>
                    {/* Кнопка действия прямо на предписании */}
                    {!isDone && (
                      <div className="border-t border-red-50 px-3 py-2">
                        <Button
                          size="sm"
                          onClick={() => complete(f)}
                          className={cn(
                            'w-full gap-1.5 font-bold',
                            f.urgency === 'act-now'
                              ? 'bg-gradient-to-r from-red-600 to-orange-500 shadow-md shadow-red-100 hover:from-red-700 hover:to-orange-600'
                              : 'bg-red-600 hover:bg-red-700',
                          )}
                        >
                          <Wrench className="h-3.5 w-3.5" /> {tf(`demo.finding.${f.id}.action`, f.action)}
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
            <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{t('dash.agent.note')}</p>
          </section>
        </Rise>

        <Rise delay={0.1}>
          <div className="space-y-4">
            {/* Умные напоминания */}
            <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
                <ClipboardList className="h-4 w-4 text-red-500" /> {t('dash.smart.title')}
              </h2>
              <ul className="mt-2.5 space-y-2">
                <li className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <p className="text-[13px] font-semibold leading-snug text-gray-800">{t('dash.smart.1')}</p>
                </li>
                <li className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <p className="text-[13px] font-semibold leading-snug text-gray-800">{t('dash.smart.2')}</p>
                </li>
                <li className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                  <p className="text-[13px] font-semibold leading-snug text-gray-800">
                    {t('dash.smart.3', { n: sunflower?.daysLeft ?? 6 })}
                  </p>
                </li>
              </ul>
            </section>

            {/* Ближайшие события */}
            <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
                  <Flower2 className="h-4 w-4 text-red-500" /> {t('dash.events.title')}
                </h2>
                <button
                  onClick={() => setView('reminders')}
                  className="text-[11px] font-bold text-red-600 hover:text-red-700"
                >
                  {t('dash.events.all')}
                </button>
              </div>

              {/* GDD-событие: предупреждение за 5–7 дней до цветения (зимой вегетация остановлена) */}
              {nearest.paused ? (
                <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <Sprout className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-snug text-gray-600">
                      {t('dash.events.gddPaused')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                  <Flower2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-snug text-gray-800">
                      {t('dash.events.gdd', {
                        name: tf(`demo.crop.${nearest.key}`, nearest.name),
                        n: nearest.daysLeft,
                      })}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {t('dash.events.gddNote', { cur: GDD_CURRENT, need: nearest.need, per: GDD_PER_DAY })}
                    </p>
                  </div>
                </div>
              )}

              {upcomingReminders.length === 0 ? (
                <p className="mt-2 text-sm text-gray-400">{t('dash.events.none')}</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {upcomingReminders.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-2.5 rounded-xl bg-red-50/50 px-3 py-2 dark:bg-[#2C211C]"
                    >
                      <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug text-gray-800">{r.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-4 flex items-center gap-1.5 text-xs font-bold text-gray-500">
                <Hexagon className="h-3.5 w-3.5" /> {t('dash.scenarios.title')}
              </h3>
              <ul className="mt-1.5 space-y-1.5">
                {DEMO_HIVES.map((h) => (
                  <li key={h.id}>
                    <button
                      onClick={() => setHive(h.id)}
                      className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-red-50 px-3 py-2 text-[13px] transition-colors hover:bg-red-50/60"
                    >
                      <span className={cn('h-2 w-2 rounded-full', RIBBON_DOT[h.id])} />
                      <span className="font-semibold text-gray-700">{tf(`demo.hive.${h.id}.label`, h.label)}</span>
                      <span className="text-gray-500">{t(`dash.scen.${h.scenario}`).toLowerCase()}</span>
                      <span className="ml-auto text-[11px] font-bold text-red-600">
                        {t('dash.gauge.label').toLowerCase()} {fmtNum(indexWithBoost(h.id))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </Rise>
      </div>

      {/* Диалоги: доказательства, вечерний отчет, замер клеща, пестициды */}
      <EvidenceDialog
        finding={evidence}
        hive={hive}
        done={
          evidence ? doneForHive(evidence.sourceHive ?? hive.id).includes(evidence.id) : false
        }
        onComplete={complete}
        onOpenChange={(v) => !v && setEvidence(null)}
      />
      <EveningReportDialog open={reportOpen} onOpenChange={setReportOpen} doneList={done} />
      <MeasureDialog open={measureOpen} onOpenChange={setMeasureOpen} hiveName={hive.label} onSave={saveMeasure} />
      <PesticideDialog
        open={pesticideOpen}
        onOpenChange={setPesticideOpen}
        onMigrate={() => setView('migration')}
      />
    </div>
  )
}
